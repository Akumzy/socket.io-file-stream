/// <reference types="socket.io-client" />
import { EventEmitter } from 'events';
interface options {
    filepath: string;
    data?: any;
    highWaterMark?: number;
    withStats?: boolean;
    maxWait?: number;
}
interface cb {
    (...data: any): void;
}
export default class Client extends EventEmitter {
    private socket;
    filesize: number;
    private chunks;
    id: string | null;
    private bytesPerChunk;
    filepath: string;
    data: any;
    isPaused: boolean;
    event: string;
    private withStats;
    private maxWait;
    private isResume;
    private isFirst;
    private maxWaitCounter;
    private maxWaitTimer;
    constructor(socket: SocketIOClient.Socket, { filepath, maxWait, data, highWaterMark, withStats }: options);
    private __getId;
    private __read;
    private __maxWaitMonitor;
    private __clearMaxWaitMonitor;
    private __start;
    upload(event: string, cb: cb): this;
    pause(): void;
    resume(): void;
    stop(): void;
    __destroy(): void;
}
export {};
