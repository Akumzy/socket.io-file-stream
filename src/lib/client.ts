import { EventEmitter } from "events";
import { createReadStream, existsSync, statSync } from "fs";
interface options {
  filepath: string;
  data?: any;
  highWaterMark?: number;
  withStats?: boolean;
}
interface socket {
  emit: (event: string, ...arg: any) => socket;
  on: (event: string, ...arg: any) => socket;
  once: (event: string, ...arg: any) => socket;
  off: (event: string, listener: () => void) => void;
}

interface cb {
  (...data: any): void;
}
class Client extends EventEmitter {
  filesize: number = 0;
  chunks: number = 0;
  id: string | null = null;
  bytesPerChunk: number = 100e3; //100 kb
  filepath: string;
  data: any;
  isPaused: boolean = false;
  socket: socket;
  event: string = "";
  withStats: boolean;
  constructor(
    socket: socket,
    { filepath, data, highWaterMark, withStats = false }: options
  ) {
    super();
    this.filepath = filepath;
    this.socket = socket;
    this.data = data;
    this.bytesPerChunk = highWaterMark || this.bytesPerChunk;
    this.withStats = withStats;
  }
  __getId() {
    this.socket.emit("__akuma_::new::id__", (id: string) => {
      if (this.id) return;
      this.id = id;
      this.emit("ready");
    });
  }
  __read(start: number, end: number) {
    if (this.isPaused) return;
    const stream = createReadStream(this.filepath, {
      highWaterMark: this.bytesPerChunk,
      start,
      end
    });
    stream.read(end - start);
    stream.once("data", (chunk: Buffer) => {
      this.socket.emit(`__akuma_::data::${this.id}__`, {
        chunk,
        data: {
          size: this.filesize,
          data: this.data
        },
        event: this.event
      });
      stream.close();
      this.emit("progress", { size: this.filesize, total: this.chunks });
    });
  }
  __start(cb: cb) {
    this.filesize = statSync(this.filepath).size;
    this.__read(0, this.bytesPerChunk);
    this.socket
      .on(`__akuma_::more::${this.id}__`, (chunks: number) => {
        if (!chunks) return;
        this.chunks = chunks;
        let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks);
        this.__read(chunks, toChunk + chunks);
      })
      .on(`__akuma_::resume::${this.id}__`, (chunks: number | null) => {
        if (typeof chunks === "number") {
          this.chunks = chunks;
          let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks);
          this.__read(chunks, toChunk + chunks);
        } else this.__read(0, this.bytesPerChunk);
      })
      .on(`__akuma_::end::${this.id}__`, ({ total, payload }: any) => {
        this.emit("progress", { size: this.filesize, total });
        let data = { size: this.filesize, total, payload };
        this.emit("done", data);

        if (typeof cb === "function") {
          if (this.withStats) cb(data);
          else cb(...payload);
        }
        this.__destroy();
      });
  }
  upload(event: string, cb: cb) {
    this.event = event;
    if (typeof this.filepath === "string") {
      if (existsSync(this.filepath)) {
        if (this.id) this.__start(cb);
        else {
          this.__getId();
          let whenToAbort = new Date().setMinutes(1),
            timer = setInterval(() => {
              if (this.id) clearInterval(timer);
              else {
                this.__getId();
                if (Date.now() >= whenToAbort) {
                  this.__destroy();
                  this.emit("cancel");
                }
              }
            }, 5000);
          this.once("ready", () => {
            clearInterval(timer);
            this.__start(cb);
          });
        }
      } else {
        throw new Error(`${this.filepath} does not exist.`);
      }
    } else {
      throw new Error(`${this.filepath} must be typeof string.`);
    }

    return this;
  }
  pause() {
    this.isPaused = true;
    this.emit("pause");
  }
  resume() {
    if (!this.id) return;
    this.isPaused = false;
    this.emit("resume");
    this.socket.emit(`__akuma_::resume::__`, this.id);
  }
  stop() {
    this.socket.emit(`__akuma_::stop::__`, this.id);
    this.__destroy();
    this.emit("cancel");
  }
  __destroy() {
    this.socket.off(`__akuma_::more::${this.id}__`, () => {});
    this.socket.off(`__akuma_::data::${this.id}__`, () => {});
    this.socket.off(`__akuma_::resume::${this.id}__`, () => {});
    this.socket.off(`__akuma_::end::${this.id}__`, () => {});
    this.data = null;
    this.id = null;
  }
}
export default Client;
