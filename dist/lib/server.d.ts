import { Readable } from 'stream';
interface socket {
    emit: (event: string, ...arg: any) => socket;
    on: (event: string, ...arg: any) => socket;
    once: (event: string, ...arg: any) => socket;
    off: (event: string, listener: () => void) => void;
}
interface UploadRecord {
    uploadedChunks: number;
    expire: Date;
    event: string;
    active: boolean;
    paused: boolean;
    dirty: boolean;
    id: string;
}
declare type Handler = (stream: Readable, data: any) => void;
declare class Server {
    streams: Map<string, Readable>;
    handlers: Map<string, Handler>;
    records: Map<string, UploadRecord>;
    io: socket;
    cleaner: NodeJS.Timeout | null;
    constructor(io: socket);
    private __createNew;
    on(event: string, handler: Handler): void;
    private __listener;
    private __cleaner;
    private __done;
    private __addTime;
}
export default Server;
