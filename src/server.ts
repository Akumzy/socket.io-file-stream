import uuid from './uuid'
import addMinutes from 'date-fns/add_minutes'
import isAfter from 'date-fns/is_after'
import { Subject } from 'rxjs'
import differenceInMinutes from 'date-fns/difference_in_minutes'

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
export type IStream = Subject<StreamPayload>
type Handler = (
  {
    stream,
    data,
    ready,
    id
  }: { stream: IStream; data: any; ready?: () => void; id: string },
  ack?: cb
) => void
// Store all the record out the Server class to persist the state
// because this Server will be instantiate inside onconnection event
const records: Map<string, UploadRecord> = new Map()

export default class Server {
  private streams: Map<string, IStream> = new Map()
  private handlers: Map<string, Handler> = new Map()
  private cleaner: NodeJS.Timeout | null = null
  private canceled: { [id: string]: boolean } = {}
  constructor(private io: SocketIO.Socket, private eventNamespace = 'akuma') {
    //create id
    this.io.on(`__${this.eventNamespace}_::new::id__`, (ack: cb) => {
      this.__createNew(ack)
    })
    //resume
    this.io.on(`__${this.eventNamespace}_::resume::__`, (id: string) => {
      //on resume check is this id instance still available
      //then return the total transfered buffer else
      //return nothing
      let record = this.records.get(id)
      if (record) {
        this.records.set(id, { ...record, active: false })
        this.io.emit(
          `__${this.eventNamespace}_::resume::${id}__`,
          record.uploadedChunks
        )
        let streamInstance = this.streams.get(id)
        if (!streamInstance) {
          this.__createNew(id)
        }
      } else {
        this.__createNew(id)
        this.io.emit(`__${this.eventNamespace}_::resume::${id}__`)
      }
    })

    // stop
    this.io.on(`__${this.eventNamespace}_::stop::__`, (id: string) => {
      //close the stream
      if (this.records.has(id)) {
        let streamInstance = this.streams.get(id)
        if (streamInstance) streamInstance.error('Stream closed')
        this.__done(id)
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
    if (typeof event !== 'string')
      throw new Error(`${event} must be typeof string`)
    if (!this.handlers.has(event)) {
      this.handlers.set(event, handler)
    }
  }
  /**
   * cancel
   */
  public cancel(id: string) {
    this.io.removeAllListeners(`__${this.eventNamespace}_::data::${id}__`)
    this.canceled[id] = true
  }
  private __listener(id: string, resume = false) {
    const stream = new Subject<StreamPayload>()
    let isReady = false,
      isFirst = true,
      _info: { size: number; data: any }

    const whenReady = () => {
      isReady = true
    }

    this.io.on(
      `__${this.eventNamespace}_::data::${id}__`,
      async ({ chunk, info, event }: OnDataPayload) => {
        if (!this.cleaner) this.__cleaner()
        if (info) _info = info
        let //
          uploadedChunks = 0,
          streamInstance = this.streams.get(id),
          record = this.records.get(id)
        if (streamInstance) {
          if (record) {
            record.active = true
            let newRecord = { ...record, expire: this.__addTime(record.expire) }
            record = newRecord
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
              const callHandler = (
                handler: Handler,
                streamInstance: IStream
              ) => {
                handler(
                  {
                    stream: streamInstance,
                    data: info.data,
                    ready: whenReady,
                    id
                  },
                  (...ack: any[]) => {
                    let r = self.records.get(id)
                    if (r)
                      self.io.emit(`__${this.eventNamespace}_::end::${id}__`, {
                        payload: ack,
                        total: r.uploadedChunks
                      })
                    this.__done(id)
                  }
                )
              }
              if (resume) {
                // check if this has an acknowledgement
                callHandler(handler, streamInstance)
              } else {
                callHandler(handler, streamInstance)
              }
              this.records.set(id, {
                ...record,
                dirty: true,
                uploadedChunks,
                active: true
              })
            }
          }
          uploadedChunks = record.uploadedChunks + chunk.length
          this.records.set(id, { ...record, uploadedChunks })
          streamPayload = {
            buffer: Buffer.from(chunk),
            fileSize: _info.size,
            uploadedChunks: record.uploadedChunks,
            flag
          }
          /* This is just make show for any weild reasons
           * the stream observer most have a subscriber
           * before piping buffers to it
           */
          if (isFirst) {
            await new Promise(res => {
              let timer = setInterval(() => {
                if (isReady) {
                  clearInterval(timer)
                  res(true)
                }
              }, 500)
            })
            isFirst = false
          }

          /**
           * Check if transfered buffers are equal to
           * file size then emit end else request for more
           */

          if (uploadedChunks < _info.size) {
            streamInstance.next(streamPayload)
            this.io.emit(
              `__${this.eventNamespace}_::more::${id}__`,
              uploadedChunks
            )
          } else {
            streamInstance.next(streamPayload)
            sleep(100)
            streamInstance.complete()
          }
        }
      }
    )
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
            if (this.records.size) {
              if (this.cleaner) clearInterval(this.cleaner)
            }
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
      return addMinutes(date, 10)
    }
    let diff = differenceInMinutes(date, new Date())
    if (diff <= 5) return addMinutes(date, 5 - diff)
    return date
  }
}
function sleep(milliseconds: number) {
  var start = new Date().getTime()
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      break
    }
  }
}
