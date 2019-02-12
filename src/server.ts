import { uuid } from './uuid'
import differenceInSeconds from 'date-fns/difference_in_seconds'
import addMinutes from 'date-fns/add_minutes'
import addMilliseconds from 'date-fns/add_milliseconds'
import isAfter from 'date-fns/is_after'
import { Subject } from 'rxjs'

interface UploadRecord {
  uploadedChunks: number
  expire: Date
  event: string
  active?: boolean
  paused: boolean
  dirty: boolean
  id: string
}

interface cb {
  (...data: any): void
}
interface StreamPayload {
  buffer: Buffer
  fileSize: number
  uploadedChunks: number
  flag: string | undefined
}
interface OnDataPayload {
  chunk: Buffer
  info: { size: number; data: any }
  event: string
  withAck: boolean
}
type IStream = Subject<StreamPayload>
type Handler = (stream: IStream, data: any, resumeAt?: number, ack?: cb) => void
// Store all the record out the Server class to persist the state
// because this Server will be instantiate inside onconnection event
const records: Map<string, UploadRecord> = new Map()

class Server {
  private streams: Map<string, IStream> = new Map()
  private handlers: Map<string, Handler> = new Map()
  private cleaner: NodeJS.Timeout | null = null
  constructor(private io: SocketIO.Socket) {
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
        this.records.set(id, { ...record, active: false })
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
    const stream = new Subject<StreamPayload>()
    let isFirst = true

    this.io.on(`__akuma_::data::${id}__`, ({ chunk, info, event, withAck }: OnDataPayload) => {
      if (!this.cleaner) this.__cleaner()
      let //
        uploadedChunks = 0,
        streamInstance = this.streams.get(id),
        record = this.records.get(id)
      if (streamInstance) {
        if (record) {
          record.active = true
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
        } else {
          this.records.set(id, {
            event,
            uploadedChunks: 0,
            paused: false,
            dirty: false,
            expire: this.__addTime(new Date(), true),
            id
          })
        }
        this.streams.set(id, stream)
        record = this.records.get(id) as UploadRecord
        streamInstance = stream
      }
      let streamPayload: StreamPayload
      if (record) {
        let flag: string | undefined
        if (!resume && isFirst) {
          isFirst = false
          flag = 'w'
        }
        // Invoke this handler once by checking if
        // it's record instance active field is truthy
        if (!record.active) {
          let handler = this.handlers.get(record.event)
          const self = this
          // check if this has handler
          if (handler) {
            // check if this just resume of an disconnected connection
            const callHandler = (handler: Handler, streamInstance: IStream) => {
              handler(streamInstance, info.data, 0, (...ack: any[]) => {
                let r = self.records.get(id)
                if (r) self.io.emit(`__akuma_::end::${id}__`, { payload: ack, total: r.uploadedChunks })
              })
            }
            if (resume) {
              // check if this has an acknowledgement
              if (withAck) callHandler(handler, streamInstance)
              else handler(streamInstance, info.data, record.uploadedChunks)
            } else {
              if (withAck) callHandler(handler, streamInstance)
              else handler(streamInstance, info.data, 0)
            }
            this.records.set(id, { ...record, dirty: true, uploadedChunks, active: true })
          }
        }
        uploadedChunks = record.uploadedChunks + chunk.length
        this.records.set(id, { ...record, uploadedChunks })
        streamPayload = {
          buffer: Buffer.from(chunk),
          fileSize: info.size,
          uploadedChunks: record.uploadedChunks,
          flag
        }
        /**
         * Check if transfered buffers are equal to
         * file size then emit end else request for more
         */

        if (uploadedChunks < info.size) {
          streamInstance.next(streamPayload)
          this.io.emit(`__akuma_::more::${id}__`, uploadedChunks)
        } else {
          streamInstance.next(streamPayload)
          streamInstance.complete()
        }
      }
    })

    this.io.on(`__akuma_::stop::__`, (id: string) => {
      //close the stream
      if (this.records.has(id)) {
        let streamInstance = this.streams.get(id)
        if (streamInstance) streamInstance.error('Stream closed')
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
              stream.error('Reconnect timeout')
              this.__done(val.id)
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
    }, 500)
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
