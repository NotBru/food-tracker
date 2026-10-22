// Errors as distributions (docs/notes/error-handling.md): every quantity is carried as its mean and deviation, and
// only turned into a lognormal at the end, to show an interval. A value is {value, v, s}:
//   v: variance of independent errors (different samples, different ingredients: variances add);
//   s: {sampleKey: sd} for errors shared by every entry of one sample (every entry of a food, a concoction's
//      portions): deviations of the same sample add linearly, different samples' in quadrature.

export const zero = () => ({ value: 0, v: 0, s: {} })

export const variance = (n) => (n?.v ?? 0) + Object.values(n?.s ?? {}).reduce((a, x) => a + x * x, 0)
export const sdOf = (n) => Math.sqrt(variance(n))

/** Adds `b` × `f` into `a` (`f` exact): its variance by f², its shared deviations by f. Returns `a`. */
export function addScaled(a, b, f = 1) {
  a.value += b.value * f
  a.v = (a.v ?? 0) + (b.v ?? 0) * f * f
  a.s ??= {}
  for (const [k, x] of Object.entries(b.s ?? {})) a.s[k] = (a.s[k] ?? 0) + x * f
  return a
}

/**
 * Adds `b` × F into `a`, F independent of `b`, with mean `f` and variance `phi`. Variance of a product of
 * independent variables: f²·Var(b) + b²·φ + Var(b)·φ. Only the first term keeps b's sharing; the others are this
 * entry's own (F is its own weighing).
 */
export function addProduct(a, b, f, phi = 0) {
  addScaled(a, b, f)
  if (phi > 0) a.v += (b.value * b.value + variance(b)) * phi
  return a
}

// --- Intervals -------------------------------------------------------------------
// The interval shown holds `coverage` of the probability (config, default 90%), centred: a lognormal with the
// value's mean and deviation, from its (1 − coverage)/2 to its (1 + coverage)/2 quantile.

export const DEFAULT_COVERAGE = 0.9
let coverage = DEFAULT_COVERAGE
let z = zFor(coverage)

/** Coverage in (0, 1), e.g. 0.9. Set from the config before anything is shown. */
export function setCoverage(p) {
  coverage = p > 0 && p < 1 ? p : DEFAULT_COVERAGE
  z = zFor(coverage)
}
export const getCoverage = () => coverage

/** Standard normal quantile of (1 + p)/2 (Acklam's approximation, relative error < 1.2e-9). */
function zFor(p) {
  const q = (1 + p) / 2
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  if (q > 0.97575) {
    const t = Math.sqrt(-2 * Math.log(1 - q))
    return -(((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1)
  }
  const t = q - 0.5
  const r = t * t
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * t / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** [low, high] of the interval. A value ≤ 0 or without error is a point. */
export function bounds(n) {
  const m = n?.value ?? 0
  const s = sdOf(n)
  if (!(m > 0) || !(s > 0)) return [m, m]
  const sl2 = Math.log(1 + (s / m) ** 2)
  const sl = Math.sqrt(sl2)
  const mu = Math.log(m) - sl2 / 2
  return [Math.exp(mu - z * sl), Math.exp(mu + z * sl)]
}
