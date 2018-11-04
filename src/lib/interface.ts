export declare interface socket {
  emit: (event: string, ...arg: any) => socket;
  on: (event: string, ...arg: any) => socket;
  once: (event: string, ...arg: any) => socket;
  off: (event: string, listener: () => void) => void;
}

export declare interface cb {
  (...data: any): void;
}
