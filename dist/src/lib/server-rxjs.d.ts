interface socket {
    emit: (event: string, ...arg: any) => socket;
    on: (event: string, ...arg: any) => socket;
    once: (event: string, ...arg: any) => socket;
    off: (event: string, listener: () => void) => void;
}
declare class ServerNew {
    sockets: Map<any, any>;
    handlers: Map<any, any>;
    io: socket;
    cleaner: any;
    constructor(io: socket);
    on(event: string, handler: (...data: any[]) => {}): void;
    private __listener;
    private __cleaner;
}
export default ServerNew;
