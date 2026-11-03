// Where the needles want to be. Everything here is in z units: standard
// deviations of the model's own uncertainty, positive = toward the GOP. One
// national driver moves every race at once; each needle also has a smaller
// one of its own. At Wobble 0 all of it is zero and the page shows the model.

/** How far one notch of Wobble reaches, in sds (the original needle's jitter). */
export const Z_STEP = 0.35;

/** Standard normal CDF (Abramowitz & Stegun 7.1.26), same as the backend's. */
export function phi(x) {
  const z = x / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + (z >= 0 ? y : -y));
}

/** Inverse of phi (Acklam's rational approximation). */
export function invPhi(p) {
  const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  // wide clamp: lopsided races must keep their real distance from 50/50
  p = Math.min(1 - 1e-16, Math.max(1e-300, p));
  const tail = (q) => (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5, r = q * q;
  return (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}

export class Driver {
  /** `tempo` scales how fast it sways; give each needle its own so they don't lock in step. */
  constructor(tempo = 1) {
    this.tempo = tempo;
    this.jitter = 0;
    this.nextJitter = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.swayAmp = 1;
    this.nextSway = 0;
    this.kick = 0;
  }

  /**
   * One frame of wobble. `reach` is the half-width in sds; `lean` (-1..1)
   * stretches the GOP side of the range and squeezes the other.
   */
  step(dt, now, s, reach, lean = 0) {
    if (!(reach > 0)) { this.kick = 0; return 0; }
    const up = reach * (1 + 1.5 * Math.max(lean, 0) - 0.6 * Math.max(-lean, 0));
    const down = reach * (1 + 1.5 * Math.max(-lean, 0) - 0.6 * Math.max(lean, 0));
    let z = 0;
    // classic twitch: hop somewhere inside the range every so often
    if (now >= this.nextJitter) {
      this.jitter = -down + Math.random() * (up + down);
      this.nextJitter = now + (140 + Math.random() * 260) / s.speed;
    }
    if (s.style === 'jitter' || s.style === 'seismic') z = this.jitter;
    if (s.style === 'pendulum' || s.style === 'seismic') {
      // back and forth, a lot, never quite the same way twice
      if (now >= this.nextSway) {
        this.swayAmp = 0.6 + Math.random() * 0.9;
        this.nextSway = now + 1500 + Math.random() * 3000;
      }
      this.phase += dt * s.speed * this.tempo * (2.2 + 0.6 * Math.sin(now / 3100));
      z += Math.sin(this.phase) * reach * 1.3 * this.swayAmp + lean * reach * 0.6;
    }
    if (s.style === 'seismic' && Math.random() < dt * 0.8 * s.speed) {
      this.kick += (Math.random() - 0.5) * reach * 3;
    }
    this.kick *= Math.exp(-dt * 2.5);
    return z + this.kick;
  }
}
