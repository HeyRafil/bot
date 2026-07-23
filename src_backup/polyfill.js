import { ReadableStream } from 'stream/web';
import { Blob } from 'buffer';
import { MessagePort } from 'worker_threads';

// Polyfill ReadableStream
if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
}

// Polyfill Blob
if (!global.Blob) {
  global.Blob = Blob;
}

// Polyfill File (Custom minimal implementation for Node 16)
if (!global.File) {
  global.File = class File extends Blob {
    constructor(parts, name, options = {}) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

// Polyfill MessagePort
if (!global.MessagePort) {
  global.MessagePort = MessagePort;
}
