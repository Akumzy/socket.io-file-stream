"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const fs_1 = require("fs");
const date_fns_1 = require("date-fns");
class Client extends events_1.EventEmitter {
    constructor(socket, { filepath, maxWait = 60, data, highWaterMark, withStats = false }) {
        super();
        this.socket = socket;
        this.filesize = 0;
        this.chunks = 0;
        this.id = null;
        this.bytesPerChunk = 102400;
        this.isPaused = false;
        this.event = '';
        this.isResume = true;
        this.isFirst = true;
        this.maxWaitCounter = 0;
        this.maxWaitTimer = null;
        this.filepath = filepath;
        this.data = data;
        this.bytesPerChunk = highWaterMark || this.bytesPerChunk;
        this.withStats = withStats;
        this.maxWait = maxWait;
    }
    __getId() {
        this.socket.emit('__akuma_::new::id__', (id) => {
            if (this.id)
                return;
            this.id = id;
            this.emit('ready');
        });
    }
    __read(start, end, withAck = false) {
        if (this.isPaused)
            return;
        if (this.filesize < this.bytesPerChunk) {
            let chunk = fs_1.readFileSync(this.filepath);
            this.socket.emit(`__akuma_::data::${this.id}__`, {
                chunk,
                info: {
                    size: this.filesize,
                    data: this.data
                },
                event: this.event,
                withAck
            });
            this.emit('progress', { size: this.filesize, total: chunk.length });
            this.__maxWaitMonitor();
            return;
        }
        const stream = fs_1.createReadStream(this.filepath, {
            highWaterMark: this.bytesPerChunk,
            start,
            end
        });
        stream.read(end - start);
        stream.once('data', (chunk) => {
            if (this.isFirst || this.isResume) {
                this.socket.emit(`__akuma_::data::${this.id}__`, {
                    chunk,
                    info: {
                        size: this.filesize,
                        data: this.data
                    },
                    event: this.event,
                    withAck
                });
            }
            else {
                this.socket.emit(`__akuma_::data::${this.id}__`, { chunk });
            }
            stream.close();
            this.emit('progress', { size: this.filesize, total: this.chunks });
            this.isFirst = false;
            this.isResume = false;
            this.__maxWaitMonitor();
        });
    }
    __maxWaitMonitor() {
        this.maxWaitTimer = setInterval(() => {
            this.maxWaitCounter += 1;
            if (this.isPaused) {
                this.__clearMaxWaitMonitor();
                return;
            }
            if (this.maxWaitCounter >= this.maxWait) {
                this.socket.emit(`__akuma_::stop::__`, this.id);
                this.__destroy();
                this.emit('cancel', 'Response timeout');
            }
        }, 1000);
    }
    __clearMaxWaitMonitor() {
        if (this.maxWaitTimer)
            clearInterval(this.maxWaitTimer);
    }
    __start(cb) {
        this.filesize = fs_1.statSync(this.filepath).size;
        let withAck = typeof cb === 'function';
        this.__read(0, this.bytesPerChunk, withAck);
        this.socket
            .on(`__akuma_::more::${this.id}__`, (chunks) => {
            if (!chunks)
                return;
            this.chunks = chunks;
            let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks);
            this.__read(chunks, toChunk + chunks, withAck);
            this.__clearMaxWaitMonitor();
        })
            .on(`__akuma_::resume::${this.id}__`, (chunks) => {
            this.isResume = true;
            this.__maxWaitMonitor();
            if (typeof chunks === 'number') {
                this.chunks = chunks;
                let toChunk = Math.min(this.bytesPerChunk, this.filesize - chunks);
                this.__read(chunks, toChunk + chunks, withAck);
            }
            else
                this.__read(0, this.bytesPerChunk, withAck);
        })
            .on(`__akuma_::end::${this.id}__`, ({ total, payload }) => {
            this.emit('progress', { size: this.filesize, total });
            let data = { size: this.filesize, total, payload };
            this.emit('done', data);
            this.__clearMaxWaitMonitor();
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
                    let whenToAbort = date_fns_1.addSeconds(new Date(), 30).getTime(), timer = setInterval(() => {
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
                let text = `${this.filepath} does not exist.`;
                throw new Error(text);
            }
        }
        else {
            let text = `${this.filepath} must be typeof string.`;
            throw new Error(text);
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
        this.__clearMaxWaitMonitor();
    }
}
exports.default = Client;
