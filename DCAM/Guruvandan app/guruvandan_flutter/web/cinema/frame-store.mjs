export async function decodeFrame(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Frame unavailable: ${response.status}`);
  const blob = await response.blob();
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export class FrameStore {
  constructor({ decode = decodeFrame, maxEntries = 10, maxBytes = 64 * 1024 * 1024 } = {}) {
    this.decode = decode;
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.entries = new Map();
    this.protected = new Set();
    this.disposed = false;
  }

  retain(urls) {
    this.protected = new Set(urls);
    for (const [url, entry] of this.entries) {
      if (!entry.image && !this.protected.has(url)) {
        entry.controller.abort();
        this.entries.delete(url);
      }
    }
    this.trim();
  }

  get(url) {
    if (this.disposed) return Promise.reject(new Error('Frame store closed.'));
    const existing = this.entries.get(url);
    if (existing) {
      this.entries.delete(url);
      this.entries.set(url, existing);
      return existing.promise;
    }
    const entry = { controller: new AbortController(), image: null, bytes: 0 };
    entry.promise = Promise.resolve().then(() => this.decode(url, entry.controller.signal)).then(image => {
      if (this.disposed || entry.controller.signal.aborted) {
        image.close?.();
        throw new Error('Frame request superseded.');
      }
      entry.image = image;
      entry.bytes = image.width * image.height * 4;
      this.trim();
      return image;
    }).catch(error => {
      if (this.entries.get(url) === entry) this.entries.delete(url);
      throw error;
    });
    this.entries.set(url, entry);
    return entry.promise;
  }

  trim() {
    let bytes = [...this.entries.values()].reduce((total, entry) => total + entry.bytes, 0);
    for (const [url, entry] of this.entries) {
      if (this.entries.size <= this.maxEntries && bytes <= this.maxBytes) break;
      if (this.protected.has(url)) continue;
      entry.controller.abort();
      entry.image?.close?.();
      bytes -= entry.bytes;
      this.entries.delete(url);
    }
  }

  dispose() {
    this.disposed = true;
    this.protected.clear();
    for (const entry of this.entries.values()) {
      entry.controller.abort();
      entry.image?.close?.();
    }
    this.entries.clear();
  }
}
