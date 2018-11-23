interface socket {
    emit: (event: string, ...arg: any) => socket;
    on: (event: string, ...arg: any) => socket;
    once: (event: string, ...arg: any) => socket;
    off: (event: string, listener: () => void) => void;
}
interface cb {
    (...data: any): void;
}
interface options {
    file: File;
    data?: any;
    highWaterMark?: number;
}
declare class ClientWeb {
    filesize: number;
    chunks: number;
    id: string | null;
    bytesPerChunk: number;
    file: File;
    data: any;
    isPaused: boolean;
    socket: socket;
    event: string;
    events: Map<string, cb[]>;
    fileReader: FileReader;
    constructor(socket: socket, { file, data, highWaterMark }: options);
    __getId(): void;
    __read(start: number, end: number): void;
    __start(cb: cb): void;
    upload(event: string, cb: cb): this;
    on(eventName: string, cb: cb): void;
    emit(eventName: string, data?: any): void;
    pause(): void;
    resume(): void;
    stop(): void;
    __destroy(): void;
}
export default ClientWeb;
