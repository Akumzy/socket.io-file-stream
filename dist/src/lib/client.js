"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const fs_1 = require("fs");
class Client extends events_1.EventEmitter {
    constructor(socket, { filepath, data, highWaterMark, withStats = false }) {
        super();
        this.filesize = 0;
        this.chunks = 0;
        this.id = null;
        this.bytesPerChunk = 100e3;
        this.isPaused = false;
        this.event = '';
        this.filepath = filepath;
        this.socket = socket;
        this.data = data;
        this.bytesPerChunk = highWaterMark || this.bytesPerChunk;
        this.withStats = withStats;
    }
    __getId() {
        this.socket.emit('__akuma_::new::id__', (id) => {
            if (this.id)
                return;
            this.id = id;
            this.emit('ready');
        });
    }
    __read(start, end) {
        if (this.isPaused)
            return;
        const stream = fs_1.createReadStream(this.filepath, {
            highWaterMark: this.bytesPerChunk,
            start,
            end
        });
        stream.read(end - start);
        stream.once('data', (chunk) => {
            this.socket.emit(`__akuma_::data::${this.id}__`, {
                chunk,
                info: {
                    size: this.filesize,
                    data: this.data
                },
                event: this.event
            });
            stream.close();
            this.emit('progress', { size: this.filesize, total: this.chunks });
        });
    }
    __start(cb) {
        this.filesize = fs_1.statSync(this.filepath).size;
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
            console.log({ chunks });
            if (typeof chunks === 'number') {
                this.chunks = chunks;
                let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks);
                this.__read(chunks, toChunk + chunks);
            }
            else
                this.__read(0, this.bytesPerChunk);
        })
            .on(`__akuma_::end::${this.id}__`, ({ total, payload }) => {
            this.emit('progress', { size: this.filesize, total });
            let data = { size: this.filesize, total, payload };
            this.emit('done', data, {});
            if (typeof cb === 'function') {
                if (this.withStats)
                    cb(data);
                else
                    cb(...payload);
            }
            this.__destroy();
        });
    }
    upload(event, cb) {
        this.event = event;
        if (typeof this.filepath === 'string') {
            if (fs_1.existsSync(this.filepath)) {
                if (this.id)
                    this.__start(cb);
                else {
                    this.__getId();
                    let whenToAbort = new Date(new Date().getSeconds() + 30).getTime(), timer = setInterval(() => {
                        if (this.id)
                            clearInterval(timer);
                        else {
                            this.__getId();
                            if (Date.now() >= whenToAbort) {
                                this.__destroy();
                                this.emit('cancel');
                            }
                        }
                    }, 5000);
                    this.once('ready', () => {
                        clearInterval(timer);
                        this.__start(cb);
                    });
                }
            }
            else {
                throw new Error(`${this.filepath} does not exist.`);
            }
        }
        else {
            throw new Error(`${this.filepath} must be typeof string.`);
        }
        return this;
    }
    pause() {
        this.isPaused = true;
        this.emit('pause');
    }
    resume() {
        if (!this.id)
            return;
        this.isPaused = false;
        this.emit('resume');
        this.socket.emit(`__akuma_::resume::__`, this.id);
    }
    stop() {
        this.socket.emit(`__akuma_::stop::__`, this.id);
        this.__destroy();
        this.emit('cancel');
    }
    __destroy() {
        this.socket.off(`__akuma_::more::${this.id}__`, () => { });
        this.socket.off(`__akuma_::data::${this.id}__`, () => { });
        this.socket.off(`__akuma_::resume::${this.id}__`, () => { });
        this.socket.off(`__akuma_::end::${this.id}__`, () => { });
        this.data = null;
        this.id = null;
    }
}
exports.default = Client;
