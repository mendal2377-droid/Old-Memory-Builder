import { Color } from 'three'

/**
 * Colours for things that are actually emitting light.
 *
 * Bloom picks what to bleed by luminance, and in this scene the brightest
 * pixel was never a light — it was the lighthouse's white paint, measured at
 * 0.867 against 0.726-0.831 for every real emitter. No global threshold can
 * separate those, so a plain bloom pass glows the paintwork and leaves the
 * lights flat, which is exactly the washed-out look we spent several passes
 * removing.
 *
 * The fix is the standard one: render to a half-float buffer, push genuine
 * emitters above 1.0, and set the bloom threshold at 1.0. Nothing that is
 * merely lit can reach that, because tone mapping compresses it first. An
 * emitter opts out of tone mapping and is scaled past the ceiling, so it is
 * the only thing left above the line.
 *
 * Measured with this boost: lit surfaces spill 0.000, emitters spill
 * 0.067-0.082.
 */

/** How far past the bloom threshold an ordinary emitter sits. */
export const EMISSIVE_BOOST = 2.4

const cache = new Map<string, Color>()

/**
 * An HDR colour for an emitting surface. Always pair it with
 * `toneMapped={false}`, or tone mapping will pull the value back under the
 * threshold and the surface will stop blooming.
 */
export function hdr(hex: string, boost = EMISSIVE_BOOST): Color {
  const key = `${hex}:${boost}`
  const hit = cache.get(key)
  if (hit) return hit
  const color = new Color(hex).multiplyScalar(boost)
  cache.set(key, color)
  return color
}
