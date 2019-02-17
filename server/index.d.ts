/// <reference types="socket.io" />
import { Subject } from 'rxjs';
interface UploadRecord {
    uploadedChunks: number;
    expire: Date;
    event: string;
    active?: boolean;
    paused: boolean;
    dirty: boolean;
    id: string;
}
interface cb {
    (...data: any): void;
}
interface StreamPayload {
    buffer: Buffer;
    fileSize: number;
    uploadedChunks: number;
    flag: string | undefined;
}
export declare type IStream = Subject<StreamPayload>;
declare type Handler = ({ stream, data, ready, id }: {
    stream: IStream;
    data: any;
    ready?: () => void;
    id: string;
}, ack?: cb) => void;
export default class Server {
    private io;
    private eventNamespace;
    private streams;
    private handlers;
    private cleaner;
    private canceled;
    constructor(io: SocketIO.Socket, eventNamespace?: string);
    readonly records: Map<string, UploadRecord>;
    private __createNew;
    on(event: string, handler: Handler): void;
    cancel(id: string): void;
    private __listener;
    private __cleaner;
    private __done;
    private __addTime;
}
export {};
