// Thin wrapper over the YouTube IFrame Player API.
// currentTime is a PLAIN field (the "ref"): polled ~4x/s, never reactive state,
// so the 250ms tick can't trigger component re-renders. See plans/ARCHITECTURE.md.

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export class Player {
  private yt: any = null;
  currentTime = 0;
  duration = 0;
  private pollId = 0;
  onTick: (t: number, d: number) => void = () => {};
  onTitle: (title: string) => void = () => {};
  onError: (code: number) => void = () => {};

  constructor(private el: HTMLElement) {
    this.loadApi();
  }

  private loadApi() {
    if (window.YT?.Player || document.getElementById("yt-api")) return;
    const s = document.createElement("script");
    s.id = "yt-api";
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }

  private apiReady(): Promise<void> {
    return new Promise((resolve) => {
      if (window.YT?.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    });
  }

  async load(videoId: string, startSeconds = 0) {
    await this.apiReady();
    if (!this.yt) {
      this.yt = new window.YT.Player(this.el, {
        videoId,
        playerVars: {
          enablejsapi: 1, playsinline: 1, rel: 0,
          origin: location.origin, start: Math.floor(startSeconds),
        },
        events: {
          onReady: () => this.startPoll(),
          onStateChange: () => this.captureTitle(),
          onError: (e: any) => this.onError(e?.data),
        },
      });
    } else {
      this.yt.loadVideoById({ videoId, startSeconds });
    }
  }

  private captureTitle() {
    const t = this.yt?.getVideoData?.()?.title;
    if (t) this.onTitle(t);
  }

  private startPoll() {
    clearInterval(this.pollId);
    this.pollId = window.setInterval(() => {
      if (!this.yt?.getCurrentTime) return;
      this.currentTime = this.yt.getCurrentTime() || 0;
      this.duration = this.yt.getDuration?.() || 0;
      this.onTick(this.currentTime, this.duration);
    }, 250);
  }

  seekTo(s: number) { this.yt?.seekTo(s, true); }
  play() { this.yt?.playVideo(); }
  pause() { this.yt?.pauseVideo(); }
  toggle() { if (this.yt?.getPlayerState?.() === 1) this.yt.pauseVideo(); else this.yt?.playVideo(); }
  seekBy(d: number) { if (this.yt?.getCurrentTime) this.seekTo((this.yt.getCurrentTime() || 0) + d); }
  setRate(r: number) { this.yt?.setPlaybackRate?.(r); }
  getRate(): number { return this.yt?.getPlaybackRate?.() ?? 1; }
  toggleMute() { if (this.yt?.isMuted?.()) this.yt.unMute(); else this.yt?.mute(); }
}
