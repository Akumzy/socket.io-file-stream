import { socket, cb } from "./interface";
import { uuid } from "./uuid";
import { Readable } from "stream";
class Server {
  sockets = new Map();
  handlers = new Map();
  io: socket;
  cleaner: any;
  constructor(io: socket) {
    this.io = io;
    //create id
    this.io.on("__akuma_::new::id__", (ack: cb) => {
      let id = uuid();
      while (this.sockets.has(id)) {
        id = uuid();
      }
      ack(id);
      this.__listener(id);
      this.__cleaner();
    });
    //resume
    this.io.on(`__akuma_::resume::__`, (id: string) => {
      //on resume check is this id instance still available
      //then return the total transfered buffer else
      //return nothing
      if (this.sockets.has(id)) {
        let d = this.sockets.get(id);
        this.io.emit(`__akuma_::resume::${id}__`, d.chunks);
      } else {
        this.io.emit(`__akuma_::resume::${id}__`);
      }
    });
  }
  /**
   *
   */
  on(event: string, handler: (...data: any[]) => {}) {
    if (typeof event !== "string")
      throw new Error(`${event} must be typeof string`);
    if (!this.handlers.has(event)) {
      this.handlers.set(event, handler);
    }
  }
  private __listener(id: string) {
    const stream = new Readable();
    this.io.on(`__akuma_::data::${id}__`, ({ chunk, data, event }: any) => {
      let d = this.sockets.get(id),
        chunks;
      if (d) {
        chunks = d.chunks + chunk.length;
        d = { ...d, chunks, expire: new Date(d.expire).setSeconds(30) };
        this.sockets.set(id, d);
      } else {
        this.sockets.set(id, {
          event,
          chunks: chunk.length,
          paused: false,
          expire: new Date().setHours(1)
        });
        chunks = chunk.length;
      }
      let handler = this.handlers.get(event);
      stream.push(chunk);
      //subscriber
      handler({ stream, data }, () => {});

      /**
       * Check if transfered buffers are equal to
       * file size then emit end else request for more
       */
      if (!(chunks >= data.size)) {
        this.io.emit(`__akuma_::more::${id}__`, chunks);
      } else {
        stream.push(null);
        //last
        let payload;
        handler({ stream, data }, (...ack: any[]) => {
          payload = ack;
        });
        this.io.emit(`__akuma_::end::${id}__`, {
          total: this.sockets.get(id).chunks,
          payload
        });
        this.sockets.delete(id);
      }
    });
  }
  private __cleaner() {
    this.cleaner = setInterval(() => {
      let s = this.sockets.size;
      if (s) {
        this.sockets.forEach(val => {
          if (val.expire <= Date.now()) this.sockets.delete(val.id);
        });
      } else {
        clearInterval(this.cleaner);
      }
    }, 10000);
  }
}
export default Server;
