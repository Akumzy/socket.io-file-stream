import { EventEmitter } from 'events'
import { createReadStream, existsSync, statSync, readFileSync } from 'fs'
import { addSeconds } from 'date-fns'
interface options {
  filepath: string
  data?: any
  highWaterMark?: number
  withStats?: boolean
}

interface cb {
  (...data: any): void
}
class Client extends EventEmitter {
  filesize: number = 0
  chunks: number = 0
  id: string | null = null
  bytesPerChunk: number = 102400 //100kb
  filepath: string
  data: any
  isPaused: boolean = false
  event: string = ''
  withStats = false
  constructor(private socket: SocketIOClient.Socket, { filepath, data, highWaterMark, withStats = false }: options) {
    super()
    this.filepath = filepath
    this.data = data
    this.bytesPerChunk = highWaterMark || this.bytesPerChunk
    this.withStats = withStats
  }
  private __getId() {
    this.socket.emit('__akuma_::new::id__', (id: string) => {
      if (this.id) return
      this.id = id
      this.emit('ready')
    })
  }
  private __read(start: number, end: number, withAck = false) {
    if (this.isPaused) return
    if (this.filesize < this.bytesPerChunk) {
      let chunk = readFileSync(this.filepath)
      this.socket.emit(`__akuma_::data::${this.id}__`, {
        chunk,
        info: {
          size: this.filesize,
          data: this.data
        },
        event: this.event,
        withAck
      })
      this.emit('progress', { size: this.filesize, total: chunk.length })
      return
    }
    const stream = createReadStream(this.filepath, {
      highWaterMark: this.bytesPerChunk,
      start,
      end
    })
    stream.read(end - start)
    stream.once('data', (chunk: Buffer) => {
      this.socket.emit(`__akuma_::data::${this.id}__`, {
        chunk,
        info: {
          size: this.filesize,
          data: this.data
        },
        event: this.event,
        withAck
      })
      stream.close()
      this.emit('progress', { size: this.filesize, total: this.chunks })
    })
  }
  private __start(cb: cb) {
    this.filesize = statSync(this.filepath).size
    let withAck = typeof cb === 'function'
    this.__read(0, this.bytesPerChunk, withAck)
    this.socket
      .on(`__akuma_::more::${this.id}__`, (chunks: number) => {
        if (!chunks) return
        this.chunks = chunks
        let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks)
        this.__read(chunks, toChunk + chunks, withAck)
      })
      .on(`__akuma_::resume::${this.id}__`, (chunks: number | null) => {
        if (typeof chunks === 'number') {
          this.chunks = chunks
          let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks)
          this.__read(chunks, toChunk + chunks, withAck)
        } else this.__read(0, this.bytesPerChunk, withAck)
      })
      .on(`__akuma_::end::${this.id}__`, ({ total, payload }: any) => {
        this.emit('progress', { size: this.filesize, total })
        let data = { size: this.filesize, total, payload }
        this.emit('done', data, {})

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
    this.socket.emit(`__akuma_::resume::__`, this.id)
  }
  public stop() {
    this.socket.emit(`__akuma_::stop::__`, this.id)
    this.__destroy()
    this.emit('cancel')
  }
  public __destroy() {
    this.socket.off(`__akuma_::more::${this.id}__`, () => {})
    this.socket.off(`__akuma_::data::${this.id}__`, () => {})
    this.socket.off(`__akuma_::resume::${this.id}__`, () => {})
    this.socket.off(`__akuma_::end::${this.id}__`, () => {})
    this.data = null
    this.id = null
  }
}
export default Client
