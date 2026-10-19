export class VideoPool {
  constructor(container, onChange, small = false) {
    this.container = container;
    this.onChange = onChange;
    this.small = small;
    this.entries = new Map();
    this.disposed = false;
  }

  retain(clips) {
    const ids = new Set(clips.map(clip => clip.id));
    for (const [id, entry] of this.entries) {
      if (ids.has(id)) continue;
      entry.disposed = true;
      entry.video.pause();
      entry.video.removeAttribute('src');
      entry.video.load();
      entry.video.remove();
      this.entries.delete(id);
    }
    for (const clip of clips) if (!this.entries.has(clip.id)) this.create(clip);
  }

  create(clip) {
    const video = document.createElement('video');
    video.className = 'film-decoder';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('tabindex', '-1');
    video.disableRemotePlayback = true;
    const frame = document.createElement('canvas');
    const context = frame.getContext('2d', {alpha: false});
    const entry = {video, frame, clip, wanted: 0, decodedTime: -1, failed: false, disposed: false};
    const refresh = () => {
      if (entry.disposed || this.disposed) return;
      if (video.readyState >= 2 && !video.seeking) {
        if (frame.width !== video.videoWidth) {
          frame.width = video.videoWidth;
          frame.height = video.videoHeight;
        }
        context.drawImage(video, 0, 0);
        entry.decodedTime = video.currentTime;
      }
      this.onChange();
      this.seek(entry);
    };
    video.addEventListener('loadeddata', refresh);
    video.addEventListener('seeked', refresh);
    video.addEventListener('error', () => {
      if (entry.disposed) return;
      entry.failed = true;
      this.onChange();
    });
    this.entries.set(clip.id, entry);
    video.src = this.small ? clip.small : clip.src;
    this.container.append(video);
    video.load();
  }

  seek(entry) {
    const video = entry.video;
    if (entry.failed || entry.disposed || video.seeking || video.readyState < 2 || !Number.isFinite(video.duration)) return;
    const target = Math.min(entry.wanted, Math.max(0, video.duration - 1 / 24));
    if (Math.abs(video.currentTime - target) > 1 / 48) video.currentTime = target;
  }

  request(clip, time) {
    const entry = this.entries.get(clip.id);
    if (!entry) return null;
    entry.wanted = time;
    this.seek(entry);
    return entry;
  }

  dispose() {
    this.disposed = true;
    this.retain([]);
  }
}
