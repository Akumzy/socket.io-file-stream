/// <reference types="node" />
import { EventEmitter } from "events";
import { socket, cb } from "./interface";
interface options {
    filepath: string;
    data?: any;
    highWaterMark?: number;
}
declare class Client extends EventEmitter {
    filesize: number;
    chunks: number;
    nextChunk: number;
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
    destroy(): void;
}
export default Client;
