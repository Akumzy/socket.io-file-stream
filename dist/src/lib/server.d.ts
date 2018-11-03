import { socket } from "./interface";
declare class Server {
    sockets: Map<any, any>;
    listening: boolean;
    handlers: Map<any, any>;
    io: socket | null;
    /**
     *
     */
    on(io: socket, event: string, handler: (...data: any[]) => {}): void;
    listeners(io: socket, id: string, event: string): void;
}
declare const _default: Server;
export default _default;
