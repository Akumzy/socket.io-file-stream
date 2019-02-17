import { EventEmitter } from 'events'
import { createReadStream, existsSync, statSync, readFileSync } from 'fs'
import { addSeconds } from 'date-fns'
interface options {
  filepath: string
  data?: any
  highWaterMark?: number
  withStats?: boolean
  maxWait?: number
}

interface cb {
  (...data: any): void
}
export default class Client extends EventEmitter {
  filesize = 0
  private chunks = 0
  id: string | null = null
  private bytesPerChunk = 102400 //100kb
  filepath: string
  data: any
  isPaused: boolean = false
  event: string = ''
  private withStats: boolean
  private maxWait: number
  private isResume = true
  private isFirst = true
  private maxWaitCounter = 0
  private maxWaitTimer: NodeJS.Timeout | null = null
  constructor(
    private socket: SocketIOClient.Socket,
    { filepath, maxWait = 60, data, highWaterMark, withStats = false }: options,
    private eventNamespace = 'akuma'
  ) {
    super()
    this.filepath = filepath
    this.data = data
    this.bytesPerChunk = highWaterMark || this.bytesPerChunk
    this.withStats = withStats
    this.maxWait = maxWait
  }
  private __getId() {
    this.socket.emit(`__${this.eventNamespace}_::new::id__`, (id: string) => {
      if (this.id) return
      this.id = id
      this.emit('ready')
    })
  }
  private __read(start: number, end: number, withAck = false) {
    if (this.isPaused) return
    if (this.filesize < this.bytesPerChunk) {
      let chunk = readFileSync(this.filepath)
      this.socket.emit(`__${this.eventNamespace}_::data::${this.id}__`, {
        chunk,
        info: {
          size: this.filesize,
          data: this.data
        },
        event: this.event,
        withAck
      })
      this.emit('progress', { size: this.filesize, total: chunk.length })
      this.__maxWaitMonitor()
      return
    }
    const stream = createReadStream(this.filepath, {
      highWaterMark: this.bytesPerChunk,
      start,
      end
    })
    stream.read(end - start)
    //
    stream.once('data', (chunk: Buffer) => {
      // avoid resend extra infos after first
      // emit
      if (this.isFirst || this.isResume) {
        this.socket.emit(`__${this.eventNamespace}_::data::${this.id}__`, {
          chunk,
          info: {
            size: this.filesize,
            data: this.data
          },
          event: this.event,
          withAck
        })
      } else {
        this.socket.emit(`__${this.eventNamespace}_::data::${this.id}__`, { chunk })
      }
      stream.close()
      this.emit('progress', { size: this.filesize, total: this.chunks })
      this.isFirst = false
      this.isResume = false
      this.__maxWaitMonitor()
    })
  }
  private __maxWaitMonitor() {
    this.maxWaitTimer = setInterval(() => {
      this.maxWaitCounter += 1
      if (this.isPaused) {
        this.__clearMaxWaitMonitor()
        return
      }
      if (this.maxWaitCounter >= this.maxWait) {
        this.socket.emit(`__${this.eventNamespace}_::stop::__`, this.id)
        this.__destroy()
        this.emit('cancel', 'Response timeout')
      }
    }, 1000)
  }
  private __clearMaxWaitMonitor() {
    if (this.maxWaitTimer) clearInterval(this.maxWaitTimer)
  }
  private __start(cb: cb) {
    this.filesize = statSync(this.filepath).size
    let withAck = typeof cb === 'function'
    this.__read(0, this.bytesPerChunk, withAck)

    // listen for new request
    this.socket
      .on(`__${this.eventNamespace}_::more::${this.id}__`, (chunks: number) => {
        if (!chunks) return
        this.chunks = chunks
        let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks)
        this.__read(chunks, toChunk + chunks, withAck)
        this.__clearMaxWaitMonitor()
      })
      // listen for resume request
      .on(`__${this.eventNamespace}_::resume::${this.id}__`, (chunks: number | null) => {
        this.isResume = true
        this.__maxWaitMonitor()
        if (typeof chunks === 'number') {
          this.chunks = chunks
          let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks)
          this.__read(chunks, toChunk + chunks, withAck)
        } else this.__read(0, this.bytesPerChunk, withAck)
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
  public upload(event: string, cb: cb) {
    this.event = event
    if (typeof this.filepath === 'string') {
      if (existsSync(this.filepath)) {
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
                  this.emit('cancel')
                }
              }
            }, 5000)
          this.once('ready', () => {
            clearInterval(timer)
            this.__start(cb)
          })
        }
      } else {
        let text = `${this.filepath} does not exist.`
        throw new Error(text)
      }
    } else {
      let text = `${this.filepath} must be typeof string.`
      throw new Error(text)
    }

    return this
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
    this.emit('cancel')
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
