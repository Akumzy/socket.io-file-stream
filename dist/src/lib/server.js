"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("./uuid");
class Server {
    constructor() {
        this.sockets = new Map();
        this.listening = false;
        this.handlers = new Map();
        this.io = null;
    }
    /**
     *
     */
    on(io, event, handler) {
        if (!this.listening) {
            this.listening = true;
            io.on("__akuma_::new::id__", (_event, ack) => {
                let id = uuid_1.uuid();
                while (this.sockets.has(id)) {
                    id = uuid_1.uuid();
                }
                ack(id);
                this.listeners(io, id, _event);
            });
        }
        if (!this.handlers.has(event)) {
            this.handlers.set(event, handler);
        }
    }
    listeners(io, id, event) {
        this.sockets.set(id, { event, chunks: 0, paused: false });
        io.on(`__akuma_::data::${id}__`, ({ chunk, data, event }, ack) => {
            let d = this.sockets.get(id), chunks = d.chunks + chunk.length, handler = this.handlers.get(event);
            d = Object.assign({}, d, { chunks });
            this.sockets.set(id, d);
            //subscribers
            handler({ chunk, data }, ack);
            /**
             * Check if transfered buffers are equal to
             * file size then emit end else request for more
             */
            if (!(chunks >= data.size)) {
                io.emit(`__akuma_::more::${id}__`, chunks);
            }
            else {
                io.emit(`__akuma_::end::${id}__`, this.sockets.get(id).chunks);
                this.sockets.delete(id);
            }
        });
        io.on(`__akuma_::resume::__`, (id) => {
            console.log({ id });
            //on resume check is this id instance still available
            //then return the total transfered buffer else
            //return nothing
            console.log(this.sockets.has(id));
            // if (this.sockets.has(id)) {
            //   let d = this.sockets.get(id);
            //   io.emit(`__akuma_::resume::${id}__`, d.chunks);
            // } else {
            //   io.emit(`__akuma_::resume::${id}__`);
            // }
        });
    }
}
exports.default = new Server();
