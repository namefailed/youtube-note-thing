// Thin wrapper over the YouTube IFrame Player API.
// currentTime is a PLAIN field (the "ref"): polled ~4x/s, never reactive state,
// so the 250ms tick can't trigger component re-renders.

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
    return new Promise((resolve, reject) => {
      if (window.YT?.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      const t = window.setTimeout(() => reject(new Error("iframe API load timed out")), 10_000);
      window.onYouTubeIframeAPIReady = () => { clearTimeout(t); prev?.(); resolve(); };
    });
  }

  async load(videoId: string, startSeconds = 0) {
    try {
      await this.apiReady();
    } catch {
      // Blocked/offline IFrame API would otherwise hang load() forever; surface it
      // through the same error path a playback error uses (5 = "Playback error").
      this.onError(5);
      return;
    }
    if (!this.yt) {
      this.yt = new window.YT.Player(this.el, {
        videoId,
        playerVars: {
          // fs:0 hides YouTube's own fullscreen button so ours (which fullscreens
          // #playerWrap and lets the Ctrl+N overlay render on top) is the only one.
          enablejsapi: 1, playsinline: 1, rel: 0, fs: 0,
          origin: location.origin, start: Math.floor(startSeconds),
        },
        events: {
          onReady: () => { this.el.querySelector("iframe")?.setAttribute("title", "YouTube video player"); this.startPoll(); },
          onStateChange: () => this.captureTitle(),
          onError: (e: any) => this.onError(e?.data),
        },
      });
    } else {
      // cue (not load) so switching videos doesn't auto-play — it sits at the
      // resume point until the user hits play.
      this.yt.cueVideoById({ videoId, startSeconds });
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
