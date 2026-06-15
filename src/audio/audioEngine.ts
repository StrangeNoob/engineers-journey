import type { Gait } from "../player/gandalf";

/** Pure: should a footstep fire given distance walked since the last step + gait? */
export function footstepDue(dist: number, gait: Gait): boolean {
  if (gait === "idle") return false;
  return dist >= (gait === "run" ? 0.95 : 0.65);
}

const FILES = ["ambient", "footstep", "footstep-1", "footstep-2", "footstep-3", "scroll", "click"];

/** Plays optional CC0 files from public/assets/audio/. Any missing file is a silent no-op. */
export class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private buffers: Record<string, AudioBuffer | null> = {};
  private ambientOn = false;
  private muted = localStorage.getItem("ej.muted") === "1";

  /** Create/resume the context on the first user gesture, then load files + start ambient. */
  async start(): Promise<void> {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    await Promise.all(FILES.map(async (n) => {
      try {
        const res = await fetch(`/assets/audio/${n}.ogg`);
        this.buffers[n] = res.ok ? await this.ctx!.decodeAudioData(await res.arrayBuffer()) : null;
      } catch { this.buffers[n] = null; }
    }));
    this.ambient();
  }

  private play(name: string, gain: number, loop = false): AudioBufferSourceNode | null {
    if (!this.ctx || !this.master || !this.buffers[name]) return null;
    const src = this.ctx.createBufferSource(); src.buffer = this.buffers[name]; src.loop = loop;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(this.master); src.start();
    return src;
  }

  ambient(): void { if (!this.ambientOn && this.play("ambient", 0.35, true)) this.ambientOn = true; }
  footstep(): void {
    const v = ["footstep-1", "footstep-2", "footstep-3"].filter((n) => this.buffers[n]);
    this.play(v.length ? v[Math.floor(Math.random() * v.length)] : "footstep", 0.5);
  }
  scroll(): void { this.play("scroll", 0.6); }
  click(): void { this.play("click", 0.5); }

  get isMuted(): boolean { return this.muted; }
  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem("ej.muted", m ? "1" : "0");
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }
}
