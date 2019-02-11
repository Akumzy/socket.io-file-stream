import { uuid } from './uuid'
import { Readable } from 'stream'
import differenceInSeconds from 'date-fns/difference_in_seconds'
import addMinutes from 'date-fns/add_minutes'
import addMilliseconds from 'date-fns/add_milliseconds'
import isAfter from 'date-fns/is_after'

interface UploadRecord {
  uploadedChunks: number
  expire: Date
  event: string
  active: boolean
  paused: boolean
  dirty: boolean
  id: string
}

interface cb {
  (...data: any): void
}
type Handler = (stream: Readable, data: any, resumeAt?: number, ack?: cb) => void
const records: Map<string, UploadRecord> = new Map()
class Server {
  streams: Map<string, Readable> = new Map()
  handlers: Map<string, Handler> = new Map()
  io: SocketIO.Socket
  cleaner: NodeJS.Timeout | null = null
  constructor(io: SocketIO.Socket) {
    this.io = io
    //create id
    this.io.on('__akuma_::new::id__', (ack: cb) => {
      this.__createNew(ack)
    })
    //resume
    this.io.on(`__akuma_::resume::__`, (id: string) => {
      //on resume check is this id instance still available
      //then return the total transfered buffer else
      //return nothing
      let record = this.records.get(id)
      if (record) {
        this.io.emit(`__akuma_::resume::${id}__`, record.uploadedChunks)
        let streamInstance = this.streams.get(id)
        if (!streamInstance) {
          this.__createNew(id)
        }
      } else {
        this.__createNew(id)
        this.io.emit(`__akuma_::resume::${id}__`)
      }
    })
  }
  get records() {
    return records
  }
  private __createNew(ack?: cb | string, id?: string) {
    if (typeof id === 'string' || typeof ack === 'string') {
      let _id = typeof ack === 'string' ? ack : (id as string)
      this.__listener(_id, true)
      this.__cleaner()
    } else {
      if (typeof ack === 'function') {
        let id = uuid()
        while (this.records.has(id)) {
          id = uuid()
        }
        ack(id)
        this.__listener(id)
        this.__cleaner()
      }
    }
  }

  public on(event: string, handler: Handler) {
    if (typeof event !== 'string') throw new Error(`${event} must be typeof string`)
    if (!this.handlers.has(event)) {
      this.handlers.set(event, handler)
    }
  }
  private __listener(id: string, resume = false) {
    const stream = new Readable()
    stream._read = () => {}
    this.io.on(`__akuma_::data::${id}__`, ({ chunk, info, event, withAck }: any) => {
      if (!this.cleaner) this.__cleaner()
      let //
        uploadedChunks = chunk.length,
        streamInstance = this.streams.get(id),
        record = this.records.get(id)
      if (streamInstance) {
        if (record) {
          record.active = true
          uploadedChunks = record.uploadedChunks + chunk.length
          let newRecord = { ...record, uploadedChunks, expire: this.__addTime(record.expire) }
          this.records.set(id, newRecord)
        }
      } else {
        if (record) {
          this.records.set(id, {
            ...record,
            dirty: false,
            expire: this.__addTime(new Date(), true)
          })
          uploadedChunks = record.uploadedChunks + chunk.length
        } else {
          this.records.set(id, {
            event,
            uploadedChunks: chunk.length,
            paused: false,
            dirty: false,
            expire: this.__addTime(new Date(), true),
            active: true,
            id
          })
          uploadedChunks = chunk.length
        }
        this.streams.set(id, stream)
        record = this.records.get(id) as UploadRecord
        streamInstance = this.streams.get(id) as Readable
      }

      if (record && record.dirty) {
        let buf = Buffer.from(chunk)
        streamInstance.push(buf, 'binary')
      } else {
        if (record) {
          let handler = this.handlers.get(record.event)
          const self = this
          if (handler) {
            if (resume) {
              if (withAck) {
                handler(stream, info.data, record.uploadedChunks, (...ack: any[]) => {
                  let r = self.records.get(id) as UploadRecord
                  self.io.emit(`__akuma_::end::${id}__`, { payload: ack, total: r.uploadedChunks })
                })
              } else handler(stream, info.data, record.uploadedChunks)
            } else {
              if (withAck) {
                handler(stream, info.data, record.uploadedChunks, (...ack: any[]) => {
                  let r = self.records.get(id) as UploadRecord
                  self.io.emit(`__akuma_::end::${id}__`, { payload: ack, total: r.uploadedChunks })
                })
              } else handler(stream, info.data)
            }
            let buf = Buffer.from(chunk)
            stream.push(buf, 'binary')
            this.records.set(id, { ...record, dirty: true, uploadedChunks })
          }
        }
      }

      /**
       * Check if transfered buffers are equal to
       * file size then emit end else request for more
       */
      if (uploadedChunks < info.size) {
        this.io.emit(`__akuma_::more::${id}__`, uploadedChunks)
      } else {
        streamInstance.push(null)
        this.__done(id)
      }
    })

    this.io.on(`__akuma_::stop::__`, (id: string) => {
      //close the stream
      if (this.records.has(id)) {
        let streamInstance = this.streams.get(id) as Readable
        streamInstance.push(null)
        this.__done(id)
      }
    })
  }
  private __cleaner() {
    this.cleaner = setInterval(() => {
      let s = this.records.size
      if (s) {
        this.records.forEach(val => {
          if (isAfter(new Date(), val.expire)) {
            this.records.delete(val.id)
            let stream = this.streams.get(val.id)
            if (stream) {
              stream.destroy(new Error('Reconnect timeout'))
              this.streams.delete(val.id)
              this.handlers.delete(val.id)
            }
            if (this.cleaner) clearInterval(this.cleaner)
          }
        })
      } else {
        if (this.cleaner) clearInterval(this.cleaner)
        this.cleaner = null
      }
    }, 10000)
  }
  private __done(id: string) {
    setTimeout(() => {
      this.records.delete(id)
      this.handlers.delete(id)
      this.streams.delete(id)
    }, 1000)
  }
  private __addTime(date: Date, isNew = false) {
    if (isNew) {
      return addMinutes(date, 5)
    }
    let diff = differenceInSeconds(date, new Date())
    if (diff <= 60) return addMilliseconds(date, 60)
    return date
  }
}
export default Server
