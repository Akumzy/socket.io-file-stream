"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("./uuid");
const stream_1 = require("stream");
class Server {
    constructor(io) {
        this.sockets = new Map();
        this.handlers = new Map();
        this.io = io;
        this.io.on("__akuma_::new::id__", (ack) => {
            let id = uuid_1.uuid();
            while (this.sockets.has(id)) {
                id = uuid_1.uuid();
            }
            ack(id);
            this.__listener(id);
            this.__cleaner();
        });
        this.io.on(`__akuma_::resume::__`, (id) => {
            if (this.sockets.has(id)) {
                let d = this.sockets.get(id);
                this.io.emit(`__akuma_::resume::${id}__`, d.chunks);
            }
            else {
                this.io.emit(`__akuma_::resume::${id}__`);
            }
        });
    }
    on(event, handler) {
        if (typeof event !== "string")
            throw new Error(`${event} must be typeof string`);
        if (!this.handlers.has(event)) {
            this.handlers.set(event, handler);
        }
    }
    __listener(id) {
        const stream = new stream_1.Readable();
        stream._read = () => { };
        this.io.on(`__akuma_::data::${id}__`, ({ chunk, data, event }) => {
            if (!this.cleaner)
                this.cleaner();
            let d = this.sockets.get(id), chunks;
            if (d) {
                chunks = d.chunks + chunk.length;
                d = Object.assign({}, d, { chunks, expire: new Date(d.expire).setSeconds(30) });
                this.sockets.set(id, d);
            }
            else {
                this.sockets.set(id, {
                    event,
                    chunks: chunk.length,
                    paused: false,
                    piped: false,
                    expire: new Date().setHours(1)
                });
                chunks = chunk.length;
            }
            let handler = this.handlers.get(event);
            stream.push(chunk);
            let c = this.sockets.get(id);
            if (!c.piped) {
                handler({ stream, data }, (...ack) => {
                    this.io.emit(`__akuma_::end::${id}__`, {
                        total: this.sockets.get(id).chunks,
                        payload: ack
                    });
                    this.sockets.delete(id);
                });
                c.piped = true;
                this.sockets.set(id, c);
            }
            if (!(chunks >= data.size)) {
                this.io.emit(`__akuma_::more::${id}__`, chunks);
            }
            else {
                stream.push(null);
            }
        });
        this.io.on(`__akuma_::stop::__`, (id) => {
            if (this.sockets.has(id)) {
                stream.push(null);
                this.sockets.delete(id);
            }
        });
    }
    __cleaner() {
        this.cleaner = setInterval(() => {
            let s = this.sockets.size;
            if (s) {
                this.sockets.forEach(val => {
                    if (val.expire <= Date.now())
                        this.sockets.delete(val.id);
                });
            }
            else {
                clearInterval(this.cleaner);
                this.cleaner = null;
            }
        }, 10000);
    }
}
exports.default = Server;
