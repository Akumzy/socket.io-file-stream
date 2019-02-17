"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = __importDefault(require("../uuid"));
const add_minutes_1 = __importDefault(require("date-fns/add_minutes"));
const is_after_1 = __importDefault(require("date-fns/is_after"));
const rxjs_1 = require("rxjs");
const difference_in_minutes_1 = __importDefault(require("date-fns/difference_in_minutes"));
const records = new Map();
class Server {
    constructor(io, eventNamespace = 'akuma') {
        this.io = io;
        this.eventNamespace = eventNamespace;
        this.streams = new Map();
        this.handlers = new Map();
        this.cleaner = null;
        this.canceled = {};
        this.io.on(`__${this.eventNamespace}_::new::id__`, (ack) => {
            this.__createNew(ack);
        });
        this.io.on(`__${this.eventNamespace}_::resume::__`, (id) => {
            let record = this.records.get(id);
            if (record) {
                this.records.set(id, { ...record, active: false });
                this.io.emit(`__${this.eventNamespace}_::resume::${id}__`, record.uploadedChunks);
                let streamInstance = this.streams.get(id);
                if (!streamInstance) {
                    this.__createNew(id);
                }
            }
            else {
                this.__createNew(id);
                this.io.emit(`__${this.eventNamespace}_::resume::${id}__`);
            }
        });
        this.io.on(`__${this.eventNamespace}_::stop::__`, (id) => {
            if (this.records.has(id)) {
                let streamInstance = this.streams.get(id);
                if (streamInstance)
                    streamInstance.error('Stream closed');
                this.__done(id);
            }
        });
    }
    get records() {
        return records;
    }
    __createNew(ack, id) {
        if (typeof id === 'string' || typeof ack === 'string') {
            let _id = typeof ack === 'string' ? ack : id;
            this.__listener(_id, true);
            this.__cleaner();
        }
        else {
            if (typeof ack === 'function') {
                let id = uuid_1.default();
                while (this.records.has(id)) {
                    id = uuid_1.default();
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
    cancel(id) {
        this.io.removeAllListeners(`__${this.eventNamespace}_::data::${id}__`);
        this.canceled[id] = true;
    }
    __listener(id, resume = false) {
        const stream = new rxjs_1.Subject();
        let isReady = false, isFirst = true, _info;
        const whenReady = () => {
            isReady = true;
        };
        this.io.on(`__${this.eventNamespace}_::data::${id}__`, async ({ chunk, info, event, withAck }) => {
            if (!this.cleaner)
                this.__cleaner();
            if (info)
                _info = info;
            let uploadedChunks = 0, streamInstance = this.streams.get(id), record = this.records.get(id);
            if (streamInstance) {
                if (record) {
                    record.active = true;
                    let newRecord = { ...record, expire: this.__addTime(record.expire) };
                    record = newRecord;
                    this.records.set(id, newRecord);
                }
            }
            else {
                if (record) {
                    this.records.set(id, {
                        ...record,
                        dirty: false,
                        expire: this.__addTime(new Date(), true)
                    });
                }
                else {
                    this.records.set(id, {
                        event,
                        uploadedChunks: 0,
                        paused: false,
                        dirty: false,
                        expire: this.__addTime(new Date(), true),
                        id
                    });
                }
                this.streams.set(id, stream);
                record = this.records.get(id);
                streamInstance = stream;
            }
            let streamPayload;
            if (record) {
                let flag;
                if (!resume && isFirst) {
                    flag = 'w';
                }
                if (!record.active) {
                    let handler = this.handlers.get(record.event);
                    const self = this;
                    if (handler) {
                        const callHandler = (handler, streamInstance) => {
                            handler({ stream: streamInstance, data: info.data, ready: whenReady, id }, (...ack) => {
                                let r = self.records.get(id);
                                if (r)
                                    self.io.emit(`__${this.eventNamespace}_::end::${id}__`, {
                                        payload: ack,
                                        total: r.uploadedChunks
                                    });
                                this.__done(id);
                            });
                        };
                        if (resume) {
                            if (withAck)
                                callHandler(handler, streamInstance);
                            else
                                handler({ stream: streamInstance, data: info.data, ready: whenReady, id });
                        }
                        else {
                            if (withAck)
                                callHandler(handler, streamInstance);
                            else
                                handler({ stream: streamInstance, data: info.data, ready: whenReady, id });
                        }
                        this.records.set(id, { ...record, dirty: true, uploadedChunks, active: true });
                    }
                }
                uploadedChunks = record.uploadedChunks + chunk.length;
                this.records.set(id, { ...record, uploadedChunks });
                streamPayload = {
                    buffer: Buffer.from(chunk),
                    fileSize: _info.size,
                    uploadedChunks: record.uploadedChunks,
                    flag
                };
                if (isFirst) {
                    await new Promise(res => {
                        let timer = setInterval(() => {
                            if (isReady) {
                                clearInterval(timer);
                                res(true);
                            }
                        }, 500);
                    });
                    isFirst = false;
                }
                if (uploadedChunks < _info.size) {
                    streamInstance.next(streamPayload);
                    this.io.emit(`__${this.eventNamespace}_::more::${id}__`, uploadedChunks);
                }
                else {
                    streamInstance.next(streamPayload);
                    sleep(100);
                    streamInstance.complete();
                }
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
                            stream.error('Reconnect timeout');
                            this.__done(val.id);
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
        }, 500);
    }
    __addTime(date, isNew = false) {
        if (isNew) {
            return add_minutes_1.default(date, 10);
        }
        let diff = difference_in_minutes_1.default(date, new Date());
        if (diff <= 5)
            return add_minutes_1.default(date, 5 - diff);
        return date;
    }
}
exports.default = Server;
function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if (new Date().getTime() - start > milliseconds) {
            break;
        }
    }
}
