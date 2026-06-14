type Tick = (dt: number) => void;
export function startLoop(tick: Tick) {
  let prev = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
