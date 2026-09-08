export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
// Integrate a gently braking prediction: never extrapolate farther than 1.25 seconds.
export function predictionSeconds(age: number): number {
  const t = clamp(age, 0, 1.8);
  if (t <= 0.7) return t;
  const tail = t - 0.7;
  return 0.7 + tail - (tail * tail) / 2.2;
}
export class ReadingMotion {
  position = 0;
  velocity = 0;
  private anchor = 0;
  private observedAt = -Infinity;
  private pace = 0;
  private predict = false;
  private forwardFloor = 0;
  private backwards = false;
  reset(position: number) {
    this.position = position;
    this.anchor = position;
    this.velocity = 0;
    this.predict = false;
    this.observedAt = -Infinity;
    this.forwardFloor = position;
    this.backwards = false;
  }
  observe(position: number, now: number, pace: number, predict: boolean) {
    this.backwards = position < this.anchor - 12;
    this.anchor = position;
    this.observedAt = now;
    this.pace = pace;
    this.predict = predict && !this.backwards;
    // Late packets must not pull a gently predicted view backwards. A real repeat may.
    this.forwardFloor = this.backwards ? position : this.position;
  }
  step(
    now: number,
    dt: number,
    lineHeight: number,
    viewport: number,
    running: boolean,
  ): number {
    dt = clamp(dt, 0, 1 / 30);
    const lead =
      running && this.predict
        ? Math.min(
            lineHeight * 0.72,
            this.pace * predictionSeconds(now - this.observedAt),
          )
        : 0;
    const target = this.backwards
      ? this.anchor
      : Math.max(this.forwardFloor, this.anchor + lead);
    const error = target - this.position;
    // A critically damped spring retains velocity across new recognition packets.
    const maxSpeed = Math.max(
      lineHeight * 2.4,
      Math.min(viewport * 2, Math.abs(error) * 2.4),
    );
    const acceleration = clamp(
      49 * error - 14 * this.velocity,
      -maxSpeed * 5,
      maxSpeed * 5,
    );
    this.velocity = clamp(
      this.velocity + acceleration * dt,
      -maxSpeed,
      maxSpeed,
    );
    let next = this.position + this.velocity * dt;
    if ((target - this.position) * (target - next) < 0) {
      next = target;
      this.velocity = 0;
    }
    if (!this.backwards && next < this.position) {
      next = this.position;
      this.velocity = 0;
    }
    this.position = next;
    if (Math.abs(error) < 0.15 && Math.abs(this.velocity) < 0.7) {
      this.position = target;
      this.velocity = 0;
    }
    return this.position;
  }
  get settled() {
    return (
      Math.abs(this.velocity) < 0.1 &&
      Math.abs(this.anchor - this.position) < 0.2
    );
  }
}
