interface socket {
  emit: (event: string, ...arg: any) => socket;
  on: (event: string, ...arg: any) => socket;
  once: (event: string, ...arg: any) => socket;
  off: (event: string, listener: () => void) => void;
}

interface cb {
  (...data: any): void;
}
interface options {
  file: File;
  data?: any;
  highWaterMark?: number;
}
class ClientWeb {
  filesize: number = 0;
  chunks: number = 0;
  id: string | null = null;
  bytesPerChunk: number = 100e3; //100 kb
  file: File;
  data: any;
  isPaused: boolean = false;
  socket: socket;
  event: string = "";
  events: Map<string, cb[]> = new Map();
  fileReader: FileReader = new FileReader();
  constructor(socket: socket, { file, data, highWaterMark }: options) {
    this.file = file;
    this.filesize = file.size;
    this.socket = socket;
    this.data = data;
    this.bytesPerChunk = highWaterMark || this.bytesPerChunk;
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
    const slice = this.file.slice(start, end);
    this.fileReader.readAsArrayBuffer(slice);

    this.fileReader.onload = () => {
      this.socket.emit(`__akuma_::data::${this.id}__`, {
        chunk: this.fileReader.result,
        data: {
          size: this.filesize,
          data: this.data
        },
        event: this.event
      });
      this.emit("progress", { size: this.filesize, total: this.chunks });
    };
  }
  __start(cb: cb) {
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
        if (typeof cb === "function") cb(data);
        this.destroy();
      });
  }
  upload(event: string, cb: cb) {
    this.event = event;
    if (this.id) this.__start(cb);
    else {
      this.__getId();
      let whenToAbort = new Date().setMinutes(1),
        timer = setInterval(() => {
          if (this.id) clearInterval(timer);
          else {
            this.__getId();
            if (Date.now() >= whenToAbort) {
              this.destroy();
              this.emit("cancel");
            }
          }
        }, 5000);
      this.on("ready", () => {
        clearInterval(timer);
        this.__start(cb);
      });
    }

    return this;
  }
  on(eventName: string, cb: cb) {
    if (!this.events.get(eventName)) {
      this.events.set(eventName, [cb]);
    } else {
      let e = this.events.get(eventName);
      //@ts-ignore
      e.push(cb);
    }
  }
  emit(eventName: string, data?: any) {
    const event = this.events.get(eventName);
    if (event) {
      event.forEach(cb => {
        cb.call(null, data);
      });
    }
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
  destroy() {
    this.socket.off(`__akuma_::more::${this.id}__`, () => {});
    this.socket.off(`__akuma_::data::${this.id}__`, () => {});
    this.socket.off(`__akuma_::resume::${this.id}__`, () => {});
    this.socket.off(`__akuma_::end::${this.id}__`, () => {});
    this.events.clear();
    this.data = null;
    this.id = null;
  }
}
export default ClientWeb;
