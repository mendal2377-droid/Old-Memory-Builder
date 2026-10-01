/**
 * Quiet evidence that the garden is being kept.
 *
 * Two traces so far, both drawn from things the game genuinely has:
 *  - where the collision circles are (the world's hidden layer), shown only
 *    once you have crossed into the Hollow;
 *  - a measuring grid, faintly visible in the ground for a short while around
 *    05:36, the moment between night and day.
 *
 * The strength knobs are shared mutable values, like the wind, so they can be
 * tuned or exaggerated for a screenshot without a rebuild.
 */
export const traces = {
  /** Multiplier on the Hollow's hitbox rings. 1 is the intended subtlety. */
  ringBoost: 1,
  /** Multiplier on the dawn grid. 1 is the intended subtlety. */
  gridBoost: 1,
}

/** The hour at which the grid is most visible: Cosmic Dawn. */
export const DAWN_HOUR = 5.6

/** 0..1, a narrow bump around the dawn hour. Gone within about half an hour. */
export function dawnFactor(hour: number) {
  const d = (hour - DAWN_HOUR) / 0.32
  return Math.exp(-d * d)
}
