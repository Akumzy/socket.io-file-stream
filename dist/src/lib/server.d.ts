/// <reference types="socket.io" />
import { Readable } from 'stream';
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
    io: SocketIO.Socket;
    cleaner: NodeJS.Timeout | null;
    constructor(io: SocketIO.Socket);
    private __createNew;
    on(event: string, handler: Handler): void;
    private __listener;
    private __cleaner;
    private __done;
    private __addTime;
}
export default Server;
