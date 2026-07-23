import { ReadableStream } from 'stream/web';
import { Blob } from 'buffer';
import { MessagePort } from 'worker_threads';

// Polyfill ReadableStream
if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = ReadableStream;
}

// Polyfill Blob
if (!(global as any).Blob) {
  (global as any).Blob = Blob;
}

// Polyfill File (Custom minimal implementation for Node 16)
if (!(global as any).File) {
  (global as any).File = class File extends Blob {
    name: string;
    lastModified: number;
    constructor(parts: any[], name: string, options: any = {}) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

// Polyfill MessagePort
if (!(global as any).MessagePort) {
  (global as any).MessagePort = MessagePort;
}
