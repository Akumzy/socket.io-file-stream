/// <reference types="socket.io-client" />
import { EventEmitter } from 'events';
interface options {
    filepath: string;
    data?: any;
    highWaterMark?: number;
    withStats?: boolean;
}
interface cb {
    (...data: any): void;
}
declare class Client extends EventEmitter {
    filesize: number;
    chunks: number;
    id: string | null;
    bytesPerChunk: number;
    filepath: string;
    data: any;
    isPaused: boolean;
    socket: SocketIOClient.Socket;
    event: string;
    withStats: boolean;
    constructor(socket: SocketIOClient.Socket, { filepath, data, highWaterMark, withStats }: options);
    __getId(): void;
    __read(start: number, end: number, withAck?: boolean): void;
    __start(cb: cb): void;
    upload(event: string, cb: cb): this;
    pause(): void;
    resume(): void;
    stop(): void;
    __destroy(): void;
}
export default Client;
