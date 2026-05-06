interface HeatPoint {
  x: number;
  y: number;
  intensity: number;
  ts: number;
}

const DECAY_MS = 30_000;

export class HeatmapEngine {
  private points: HeatPoint[] = [];

  accumulate(x: number, y: number, intensity = 1): void {
    this.points.push({ x, y, intensity, ts: Date.now() });
  }

  render(ctx: CanvasRenderingContext2D): void {
    const now = Date.now();
    this.points = this.points.filter(p => now - p.ts < DECAY_MS);
    for (const p of this.points) {
      const age = (now - p.ts) / DECAY_MS;
      const alpha = (1 - age) * 0.28 * p.intensity;
      const radius = 44;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      g.addColorStop(0, `rgba(253,225,0,${alpha})`);
      g.addColorStop(1, 'rgba(253,225,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Renders on a small canvas scaled to minimap dimensions
  renderMini(ctx: CanvasRenderingContext2D, scaleX: number, scaleY: number): void {
    const now = Date.now();
    const pts = this.points.filter(p => now - p.ts < DECAY_MS);
    for (const p of pts) {
      const age = (now - p.ts) / DECAY_MS;
      const alpha = (1 - age) * 0.55 * p.intensity;
      const x = p.x * scaleX;
      const y = p.y * scaleY;
      const r = 8;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(253,225,0,${alpha})`);
      g.addColorStop(1, 'rgba(253,225,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
