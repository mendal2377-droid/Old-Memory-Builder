import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { HalfFloatType } from 'three'
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  Vignette,
} from '@react-three/postprocessing'
import { createAtmosphereSample, sampleAtmosphere } from '../../data/atmosphere'
import { hollow } from '../../data/hollow'
import { useSceneStore } from '../../store/sceneStore'

/**
 * Restrained bloom.
 *
 * Every bright thing in this world is a light source — the cyan seams in the
 * stone, the lighthouse lamp, ship engines, the star. Without a bloom pass
 * those render as bright paint on a surface rather than as something emitting,
 * which is why the cyan never quite read as light.
 *
 * The threshold is deliberately high. Bloom that catches the grass is what
 * makes a scene look washed out and metallic; bloom that only catches genuine
 * emitters is what makes it look lit. Almost nothing in the diorama passes
 * 0.82 luminance except the things that are actually glowing.
 */

/**
 * Only genuine emitters clear this. Anything merely lit is tone-mapped first
 * and physically cannot reach 1.0 -- see src/data/emissive.ts for the
 * measurements behind it.
 */
const THRESHOLD = 1.0

export function SceneBloom() {
  const sample = useMemo(() => createAtmosphereSample(), [])
  const bloomRef = useRef<{ intensity: number } | null>(null)
  const satRef = useRef<{ saturation: number } | null>(null)
  const bcRef = useRef<{ brightness: number; contrast: number } | null>(null)
  const vignetteRef = useRef<{ darkness: number } | null>(null)

  useFrame(() => {
    const state = useSceneStore.getState()
    sampleAtmosphere(
      state.timeOfDay,
      state.weather,
      state.weatherIntensity,
      state.worldStyle,
      sample,
    )

    // Crossing into the Hollow drains the whole frame at once. Doing it here
    // rather than per-material is the entire reason it is affordable: one
    // colour-grade pass desaturates every object, the sky and the water
    // together, and nothing in the scene graph needs to know about it.
    const h = hollow.amount
    if (satRef.current) satRef.current.saturation = -0.94 * h
    if (bcRef.current) {
      // Lift rather than darken. Desaturation alone carries the feeling; the
      // first version stacked a brightness cut, a sun cut, an ambient cut and
      // a heavier vignette on top of each other and the result was a place
      // too dark to read. Bone-grey overcast is bleaker than black.
      bcRef.current.brightness = 0.07 * h
      bcRef.current.contrast = -0.09 * h
    }
    if (vignetteRef.current) vignetteRef.current.darkness = 0.42 + 0.1 * h

    if (!bloomRef.current) return
    // A lamp reads as a lamp at dusk and as a bulb at noon. Lean on the same
    // darkness term the stars use, so bloom swells as the sky goes down.
    const darkness = sample.starOpacity
    // Over there almost nothing is still lit, so the little that is should
    // carry further.
    const target = (0.46 + darkness * 0.6) * (1 - h) + 1.25 * h
    // Ease rather than snap, so scrubbing the time control stays smooth
    bloomRef.current.intensity += (target - bloomRef.current.intensity) * 0.06
  })

  return (
    <EffectComposer frameBufferType={HalfFloatType}>
      <Bloom
        ref={bloomRef as never}
        intensity={0.62}
        luminanceThreshold={THRESHOLD}
        luminanceSmoothing={0.2}
        mipmapBlur
        radius={0.72}
      />
      {/* A whisper of vignette to settle the frame edges. Any more and it
          reads as a camera effect rather than as the place itself. */}
      <HueSaturation ref={satRef as never} saturation={0} />
      <BrightnessContrast ref={bcRef as never} brightness={0} contrast={0} />
      <Vignette ref={vignetteRef as never} offset={0.32} darkness={0.42} eskil={false} />
    </EffectComposer>
  )
}
