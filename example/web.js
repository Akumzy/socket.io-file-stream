class ClientWeb {
    constructor(socket, { file, data, highWaterMark }) {
        this.filesize = 0;
        this.chunks = 0;
        this.id = null;
        this.bytesPerChunk = 100e3; //100 kb
        this.isPaused = false;
        this.event = "";
        this.events = new Map();
        this.fileReader = new FileReader();
        this.file = file;
        this.filesize = file.size;
        this.socket = socket;
        this.data = data;
        this.bytesPerChunk = highWaterMark || this.bytesPerChunk;
    }
    __getId() {
        this.socket.emit("__akuma_::new::id__", (id) => {
            if (this.id)
                return;
            this.id = id;
            this.emit("ready");
        });
    }
    __read(start, end) {
        if (this.isPaused)
            return;
        const slice = this.file.slice(start, end);
        this.fileReader.readAsArrayBuffer(slice);
        this.fileReader.onload = () => {
            console.log(this.fileReader.result);
            this.socket.emit(`__akuma_::data::${this.id}__`, {
                chunk: this.fileReader.result,
                data: {
                    size: this.filesize,
                    data: this.data,
                    web: true,
                },
                event: this.event
            });
            this.emit("progress", { size: this.filesize, total: this.chunks });
        };
    }
    __start(cb) {
        this.__read(0, this.bytesPerChunk);
        this.socket
            .on(`__akuma_::more::${this.id}__`, (chunks) => {
                if (!chunks)
                    return;
                this.chunks = chunks;
                let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks);
                this.__read(chunks, toChunk + chunks);
            })
            .on(`__akuma_::resume::${this.id}__`, (chunks) => {
                if (typeof chunks === "number") {
                    this.chunks = chunks;
                    let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks);
                    this.__read(chunks, toChunk + chunks);
                } else
                    this.__read(0, this.bytesPerChunk);
            })
            .on(`__akuma_::end::${this.id}__`, ({ total, payload }) => {
                this.emit("progress", { size: this.filesize, total });
                let data = { size: this.filesize, total, payload };
                this.emit("done", data);
                if (typeof cb === "function")
                    cb(data);
                this.destroy();
            });
    }
    upload(event, cb) {
        this.event = event;
        if (this.id)
            this.__start(cb);
        else {
            this.__getId();
            let whenToAbort = new Date().setMinutes(1),
                timer = setInterval(() => {
                    if (this.id)
                        clearInterval(timer);
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
    on(eventName, cb) {
        if (!this.events.get(eventName)) {
            this.events.set(eventName, [cb]);
        } else {
            let e = this.events.get(eventName);
            //@ts-ignore
            e.push(cb);
        }
    }
    emit(eventName, data) {
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
        if (!this.id)
            return;
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