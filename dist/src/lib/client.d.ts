/// <reference types="node" />
import { EventEmitter } from "events";
interface options {
    filepath: string;
    data?: any;
    highWaterMark?: number;
}
interface socket {
    emit: (event: string, ...arg: any) => socket;
    on: (event: string, ...arg: any) => socket;
    once: (event: string, ...arg: any) => socket;
    off: (event: string, listener: () => void) => void;
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
    socket: socket;
    event: string;
    constructor(socket: socket, { filepath, data, highWaterMark }: options);
    __getId(): void;
    __read(start: number, end: number): void;
    __start(cb: cb): void;
    upload(event: string, cb: cb): this;
    pause(): void;
    resume(): void;
    stop(): void;
    __destroy(): void;
}
export default Client;
