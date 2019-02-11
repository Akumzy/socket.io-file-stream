"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("./uuid");
const stream_1 = require("stream");
const difference_in_seconds_1 = __importDefault(require("date-fns/difference_in_seconds"));
const add_minutes_1 = __importDefault(require("date-fns/add_minutes"));
const add_milliseconds_1 = __importDefault(require("date-fns/add_milliseconds"));
const is_after_1 = __importDefault(require("date-fns/is_after"));
const records = new Map();
class Server {
    constructor(io) {
        this.streams = new Map();
        this.handlers = new Map();
        this.cleaner = null;
        this.io = io;
        this.io.on('__akuma_::new::id__', (ack) => {
            this.__createNew(ack);
        });
        this.io.on(`__akuma_::resume::__`, (id) => {
            let record = this.records.get(id);
            if (record) {
                this.io.emit(`__akuma_::resume::${id}__`, record.uploadedChunks);
            }
            else {
                this.__createNew(id);
                this.io.emit(`__akuma_::resume::${id}__`);
            }
        });
    }
    get records() {
        return records;
    }
    __createNew(ack, id) {
        if (typeof id === 'string' || typeof ack === 'string') {
            let _id = typeof ack === 'string' ? ack : id;
            this.__listener(_id);
            this.__cleaner();
        }
        else {
            if (typeof ack === 'function') {
                let id = uuid_1.uuid();
                while (this.records.has(id)) {
                    id = uuid_1.uuid();
                }
                ack(id);
                this.__listener(id);
                this.__cleaner();
            }
        }
    }
    on(event, handler) {
        if (typeof event !== 'string')
            throw new Error(`${event} must be typeof string`);
        if (!this.handlers.has(event)) {
            this.handlers.set(event, handler);
        }
    }
    __listener(id) {
        const stream = new stream_1.Readable();
        stream._read = () => { };
        this.io.on(`__akuma_::data::${id}__`, ({ chunk, info, event }) => {
            if (!this.cleaner)
                this.__cleaner();
            let uploadedChunks = chunk.length, streamInstance = this.streams.get(id), record = this.records.get(id);
            if (streamInstance) {
                if (record) {
                    record.active = true;
                    uploadedChunks = record.uploadedChunks + chunk.length;
                    let newRecord = Object.assign({}, record, { uploadedChunks, expire: this.__addTime(record.expire) });
                    this.records.set(id, newRecord);
                }
            }
            else {
                if (record) {
                    this.records.set(id, Object.assign({}, record, { dirty: false, expire: this.__addTime(new Date(), true) }));
                }
                else {
                    this.records.set(id, {
                        event,
                        uploadedChunks: chunk.length,
                        paused: false,
                        dirty: false,
                        expire: this.__addTime(new Date(), true),
                        active: true,
                        id
                    });
                }
                this.streams.set(id, stream);
                record = this.records.get(id);
                streamInstance = this.streams.get(id);
            }
            if (record && record.dirty) {
                streamInstance.push(chunk);
            }
            else {
                if (record) {
                    let handler = this.handlers.get(record.event);
                    if (handler) {
                        handler(stream, info.data);
                        stream.push(chunk);
                        this.records.set(id, Object.assign({}, record, { dirty: true, uploadedChunks: chunk.length }));
                    }
                }
            }
            if (!(uploadedChunks >= info.size)) {
                this.io.emit(`__akuma_::more::${id}__`, uploadedChunks);
            }
            else {
                streamInstance.push(null);
                this.__done(id);
            }
        });
        this.io.on(`__akuma_::stop::__`, (id) => {
            if (this.records.has(id)) {
                let streamInstance = this.streams.get(id);
                streamInstance.push(null);
                this.__done(id);
            }
        });
    }
    __cleaner() {
        this.cleaner = setInterval(() => {
            let s = this.records.size;
            if (s) {
                this.records.forEach(val => {
                    if (is_after_1.default(new Date(), val.expire)) {
                        this.records.delete(val.id);
                        let stream = this.streams.get(val.id);
                        if (stream) {
                            stream.destroy(new Error('Reconnect timeout'));
                            this.streams.delete(val.id);
                            this.handlers.delete(val.id);
                        }
                        if (this.cleaner)
                            clearInterval(this.cleaner);
                    }
                });
            }
            else {
                if (this.cleaner)
                    clearInterval(this.cleaner);
                this.cleaner = null;
            }
        }, 10000);
    }
    __done(id) {
        setTimeout(() => {
            this.records.delete(id);
            this.handlers.delete(id);
            this.streams.delete(id);
        }, 1000);
    }
    __addTime(date, isNew = false) {
        if (isNew) {
            return add_minutes_1.default(date, 5);
        }
        let diff = difference_in_seconds_1.default(date, new Date());
        if (diff <= 60)
            return add_milliseconds_1.default(date, 60);
        return date;
    }
}
exports.default = Server;
