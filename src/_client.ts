// import { ClientOptions, cb } from '../types'
// import { EventEmitter } from 'events'
// import { createReadStream, existsSync, statSync, readFileSync } from 'fs'
// import { addSeconds } from 'date-fns'
// class ClientInternal extends EventEmitter {
//   filesize = 0
//   private chunks = 0
//   id: string | null = null
//   private bytesPerChunk = 102400 //100kb
//   filepath: string
//   data: any
//   isPaused: boolean = false
//   event: string = ''
//   private withStats: boolean
//   private maxWait: number
//   private isResume = true
//   private isFirst = true
//   private maxWaitCounter = 0
//   private maxWaitTimer: NodeJS.Timeout | null = null
//   constructor(private readonlt socketprivate readonly eventNamespace = 'akuma', private readonly options: ClientOptions) {
//     super()
//   }
//     private __getId() {
//         this.socket.emit(`__${this.eventNamespace}_::new::id__`, (id: string) => {
//             if (this.id) return
//             this.id = id
//             this.emit('ready')
//         })
//     }
// }
