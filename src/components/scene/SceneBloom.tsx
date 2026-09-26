import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { HalfFloatType } from 'three'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { createAtmosphereSample, sampleAtmosphere } from '../../data/atmosphere'
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

  useFrame(() => {
    const state = useSceneStore.getState()
    sampleAtmosphere(
      state.timeOfDay,
      state.weather,
      state.weatherIntensity,
      state.worldStyle,
      sample,
    )

    if (!bloomRef.current) return
    // A lamp reads as a lamp at dusk and as a bulb at noon. Lean on the same
    // darkness term the stars use, so bloom swells as the sky goes down.
    const darkness = sample.starOpacity
    const target = 0.46 + darkness * 0.6
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
      <Vignette offset={0.32} darkness={0.42} eskil={false} />
    </EffectComposer>
  )
}
