import { socket } from "./interface";
declare class Server {
    sockets: Map<any, any>;
    handlers: Map<any, any>;
    io: socket;
    cleaner: any;
    constructor(io: socket);
    /**
     *
     */
    on(event: string, handler: (...data: any[]) => {}): void;
    private __listener;
    private __cleaner;
}
export default Server;
