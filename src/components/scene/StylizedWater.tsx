import type { AtmospherePreset } from '../../types/scene'
import { useWaterMaterial } from './useWaterMaterial'

// River centreline as [x, z, halfWidth, halfLength, rotation] blobs.
export type WaterBlob = [number, number, number, number, number]

/**
 * Flowing river rendered as overlapping soft discs sharing one animated
 * shader. World-space ripples keep the surface seamless across the discs.
 */
export function RiverWater({
  blobs,
  atmospherePreset,
  y = 0.028,
}: {
  blobs: WaterBlob[]
  atmospherePreset: AtmospherePreset
  y?: number
}) {
  const isStormy = atmospherePreset === 'Heavy Rain'
  const isRainy = atmospherePreset === 'Rainy Day'
  const speed = isStormy ? 1.7 : isRainy ? 1.25 : 1
  const choppy = isStormy ? 1.6 : isRainy ? 1.2 : 0.9
  const material = useWaterMaterial(atmospherePreset, 0.82, speed, choppy)

  return (
    <group raycast={() => null}>
      {blobs.map(([x, z, halfWidth, halfLength, rotation], index) => (
        <mesh
          key={`river-water-${index}`}
          position={[x, y + index * 0.0004, z]}
          rotation={[-Math.PI / 2, 0, rotation]}
          scale={[halfWidth, halfLength, 1]}
          material={material}
          raycast={() => null}
        >
          <circleGeometry args={[1, 40]} />
        </mesh>
      ))}
    </group>
  )
}

/** Single elliptical body of water (ponds / lakes / placed water assets). */
export function PondWater({
  atmospherePreset,
  radius = 0.75,
  segments = 40,
  y = 0.03,
  opacity = 0.85,
}: {
  atmospherePreset: AtmospherePreset
  radius?: number
  segments?: number
  y?: number
  opacity?: number
}) {
  const material = useWaterMaterial(atmospherePreset, opacity, 1, 0.9)

  return (
    <mesh
      position={[0, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      raycast={() => null}
    >
      <circleGeometry args={[radius, segments]} />
    </mesh>
  )
}
