import addSeconds from 'date-fns/add_seconds'
type cb = (...data: any) => void
interface options {
  file: File
  data?: any
  highWaterMark?: number
  withStats?: boolean
}
class ClientWeb {
  private isResume: boolean
  filesize = 0
  private chunks = 0
  id: string | null = null
  private bytesPerChunk = 102400 //100kb
  file: File
  data: any
  isPaused: boolean = false
  event: string = ''
  events: Map<string, cb[]> = new Map()
  fileReader: FileReader = new FileReader()
  private withStats: boolean
  private maxWait: number
  private isFirst = true
  private maxWaitCounter = 0
  private maxWaitTimer: NodeJS.Timeout | null = null
  constructor(
    private socket: SocketIOClient.Socket,
    { file, data, highWaterMark, withStats = false }: options,
    private eventNamespace = 'akuma'
  ) {
    this.file = file
    this.filesize = file.size
    this.socket = socket
    this.data = data
    this.bytesPerChunk = highWaterMark || this.bytesPerChunk
    this.withStats = withStats
  }
  private __getId() {
    this.socket.emit(`__${this.eventNamespace}_::new::id__`, (id: string) => {
      if (this.id) return
      this.id = id
      this.emit('ready')
    })
  }

  __read(start: number, end: number) {
    if (this.isPaused) return
    const slice = this.file.slice(start, end)
    this.fileReader.readAsArrayBuffer(slice)

    this.fileReader.onload = () => {
      // avoid resending extra infos after first upload
      if (this.isFirst || this.isResume) {
        this.socket.emit(`__${this.eventNamespace}_::data::${this.id}__`, {
          chunk: this.fileReader.result,
          info: {
            size: this.filesize,
            data: this.data
          },
          event: this.event
        })
      } else {
        this.socket.emit(`__${this.eventNamespace}_::data::${this.id}__`, { chunk: this.fileReader.result })
      }
      this.emit('progress', { size: this.filesize, total: this.chunks })
      this.isFirst = false
      this.isResume = false
      this.__maxWaitMonitor()
    }
  }
  __start(cb: cb) {
    this.__read(0, this.bytesPerChunk)
    this.__read(0, this.bytesPerChunk)

    // listen for new request
    this.socket
      .on(`__${this.eventNamespace}_::more::${this.id}__`, (chunks: number) => {
        if (!chunks) return
        this.chunks = chunks
        let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks)
        this.__clearMaxWaitMonitor()
        this.__read(chunks, toChunk + chunks)
      })
      // listen for resume request
      .on(`__${this.eventNamespace}_::resume::${this.id}__`, (chunks: number | null) => {
        this.isResume = true
        this.__maxWaitMonitor()
        if (typeof chunks === 'number') {
          this.chunks = chunks
          let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks)
          this.__read(chunks, toChunk + chunks)
        } else this.__read(0, this.bytesPerChunk)
      })
      // listen for end event
      .on(`__${this.eventNamespace}_::end::${this.id}__`, ({ total, payload }: any) => {
        this.emit('progress', { size: this.filesize, total })
        let data = { size: this.filesize, total, payload }
        this.emit('done', data)
        this.__clearMaxWaitMonitor()
        if (typeof cb === 'function') {
          if (this.withStats) cb(data)
          else cb(...payload)
        }
        this.__destroy()
      })
  }
  upload(event: string, cb: cb) {
    this.event = event
    if (this.id) this.__start(cb)
    else {
      // get an id from server
      this.__getId()
      let whenToAbort = addSeconds(new Date(), 30).getTime(),
        timer = setInterval(() => {
          if (this.id) clearInterval(timer)
          else {
            this.__getId()
            if (Date.now() >= whenToAbort) {
              this.__destroy()
              this.emit('cancel', 'Get id timeout id=' + this.id)
            }
          }
        }, 5000)
      this.on('ready', () => {
        clearInterval(timer)
        this.__start(cb)
      })
    }

    return this
  }
  private __maxWaitMonitor() {
    if (this.maxWaitTimer) clearInterval(this.maxWaitTimer)
    this.maxWaitTimer = setInterval(() => {
      this.maxWaitCounter += 1
      if (this.isPaused) {
        this.__clearMaxWaitMonitor()
        return
      }
      if (this.maxWaitCounter >= this.maxWait) {
        this.socket.emit(`__${this.eventNamespace}_::stop::__`, this.id)
        this.emit('cancel', '[local] Response timeout id=' + this.id)
        this.__destroy()
      }
    }, 1000)
  }
  private __clearMaxWaitMonitor() {
    if (this.maxWaitTimer) {
      clearInterval(this.maxWaitTimer)
      this.maxWaitTimer = null
      this.maxWaitCounter = 0
    }
  }
  on(eventName: string, cb: cb) {
    if (!this.events.get(eventName)) {
      this.events.set(eventName, [cb])
    } else {
      let e = this.events.get(eventName)
      //@ts-ignore
      e.push(cb)
    }
  }
  emit(eventName: string, data?: any) {
    const event = this.events.get(eventName)
    if (event) {
      event.forEach(cb => {
        cb.call(null, data)
      })
    }
  }

  public pause() {
    this.isPaused = true
    this.emit('pause')
  }
  public resume() {
    if (!this.id) return
    this.isPaused = false
    this.emit('resume')
    this.socket.emit(`__${this.eventNamespace}_::resume::__`, this.id)
  }
  public stop() {
    this.socket.emit(`__${this.eventNamespace}_::stop::__`, this.id)
    this.__destroy()
    this.emit('cancel', 'Stopped id=' + this.id)
  }
  public __destroy() {
    this.socket.off(`__${this.eventNamespace}_::more::${this.id}__`, () => {})
    this.socket.off(`__${this.eventNamespace}_::data::${this.id}__`, () => {})
    this.socket.off(`__${this.eventNamespace}_::resume::${this.id}__`, () => {})
    this.socket.off(`__${this.eventNamespace}_::end::${this.id}__`, () => {})
    this.data = null
    this.id = null
    this.__clearMaxWaitMonitor()
  }
}
export default ClientWeb
