// Short CC0 interface samples plus original synthesized colony signals and ambient bed.
export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.last = {};
    this.buffers = {};
  }
  async unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.connect(this.master);
      for (const [i, f] of [55, 82.4069, 110, 164.8138].entries()) {
        const o = this.ctx.createOscillator(),
          g = this.ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.value = 0.018 / (i + 1);
        o.connect(g);
        g.connect(this.music);
        o.start();
      }
      for (const name of ["select", "complete", "warning"])
        fetch(`/assets/audio/${name}.ogg`)
          .then((r) => r.arrayBuffer())
          .then((b) => this.ctx.decodeAudioData(b))
          .then((b) => (this.buffers[name] = b))
          .catch(() => {});
    }
    await this.ctx.resume();
    this.update();
  }
  update() {
    if (this.ctx) {
      this.master.gain.setTargetAtTime(
        this.settings.volume,
        this.ctx.currentTime,
        0.1,
      );
      this.music.gain.setTargetAtTime(
        this.settings.music,
        this.ctx.currentTime,
        0.2,
      );
    }
  }
  sound(kind) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    if (
      now - (this.last[kind] || -99) <
      (kind === "warning"
        ? 3
        : kind === "mine" || kind === "delivery"
          ? 1
          : 0.08)
    )
      return;
    this.last[kind] = now;
    const sample =
      kind === "select"
        ? "select"
        : ["research", "build"].includes(kind)
          ? "complete"
          : kind === "warning"
            ? "warning"
            : null;
    if (sample && this.buffers[sample]) {
      const src = this.ctx.createBufferSource(),
        g = this.ctx.createGain();
      src.buffer = this.buffers[sample];
      g.gain.value = 0.26;
      src.connect(g);
      g.connect(this.master);
      src.start();
      return;
    }
    const osc = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    osc.type = kind === "combat" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(
      {
        mine: 390,
        delivery: 690,
        combat: 140,
        research: 880,
        warning: 190,
        select: 560,
      }[kind] || 480,
      now,
    );
    osc.frequency.exponentialRampToValueAtTime(
      kind === "combat" ? 40 : 250,
      now + 0.16,
    );
    g.gain.setValueAtTime(0.045, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(now + 0.2);
  }
  suspend() {
    this.ctx?.suspend();
  }
}
