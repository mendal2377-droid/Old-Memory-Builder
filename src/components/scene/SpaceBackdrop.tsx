import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  DoubleSide,
  type Group,
  type Mesh,
} from 'three'

/**
 * Deep Space: the diorama reads as an island torn loose and left drifting.
 * Everything here is unlit and additive so it behaves like distant light
 * rather than geometry the scene's sun has to reach.
 */

// -- Nebula ------------------------------------------------------------------

let nebulaCache: CanvasTexture | null = null
function getNebulaTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (nebulaCache) return nebulaCache

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, size, size)
  const clouds: Array<[number, number, number, string]> = [
    [96, 110, 86, 'rgba(120, 70, 220, 0.55)'],
    [160, 96, 70, 'rgba(220, 60, 160, 0.42)'],
    [120, 160, 62, 'rgba(40, 160, 220, 0.38)'],
    [180, 170, 54, 'rgba(90, 60, 200, 0.35)'],
    [70, 70, 48, 'rgba(230, 120, 90, 0.22)'],
  ]
  for (const [x, y, r, colour] of clouds) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, colour)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Fade the rim so the plane never shows a hard edge
  const vignette = ctx.createRadialGradient(128, 128, 60, 128, 128, 128)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'

  nebulaCache = new CanvasTexture(canvas)
  nebulaCache.needsUpdate = true
  return nebulaCache
}

function Nebula() {
  const groupRef = useRef<Group>(null)
  const clouds = useMemo(
    () =>
      Array.from({ length: 5 }).map((_, i) => ({
        angle: (i / 5) * Math.PI * 2 + Math.random() * 0.6,
        height: 18 + Math.random() * 34,
        scale: 60 + Math.random() * 50,
        spin: (Math.random() - 0.5) * 0.6,
        opacity: 0.2 + Math.random() * 0.22,
      })),
    [],
  )

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.004
  })

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => {
        const radius = 115
        return (
          <mesh
            key={`nebula-${i}`}
            position={[
              Math.cos(c.angle) * radius,
              c.height,
              Math.sin(c.angle) * radius,
            ]}
            rotation={[0, -c.angle + Math.PI / 2, c.spin]}
            renderOrder={-900}
          >
            <planeGeometry args={[c.scale, c.scale]} />
            <meshBasicMaterial
              map={getNebulaTexture()}
              transparent
              opacity={c.opacity}
              depthWrite={false}
              depthTest={false}
              blending={AdditiveBlending}
              side={DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// -- Planets -----------------------------------------------------------------

function Planets() {
  const ringRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.02
  })

  return (
    <group>
      {/* Large banded world low on the horizon */}
      <group position={[-72, 16, -86]}>
        <mesh renderOrder={-880}>
          <sphereGeometry args={[17, 48, 32]} />
          <meshBasicMaterial color="#6f4a86" toneMapped={false} fog={false} />
        </mesh>
        {/* Lit crescent along the upper limb */}
        <mesh position={[-3.5, 4, 1]} renderOrder={-879}>
          <sphereGeometry args={[16.6, 48, 32]} />
          <meshBasicMaterial
            color="#c99adf"
            transparent
            opacity={0.32}
            depthWrite={false}
            blending={AdditiveBlending}
            fog={false}
          />
        </mesh>
        {/* Atmospheric rim */}
        <mesh renderOrder={-881}>
          <sphereGeometry args={[18.6, 32, 24]} />
          <meshBasicMaterial
            color="#a874ff"
            transparent
            opacity={0.12}
            side={BackSide}
            depthWrite={false}
            blending={AdditiveBlending}
            fog={false}
          />
        </mesh>
      </group>

      {/* Smaller ringed companion on the other side */}
      <group position={[84, 30, -60]} rotation={[0, 0, 0.34]}>
        <mesh renderOrder={-880}>
          <sphereGeometry args={[7.5, 40, 28]} />
          <meshBasicMaterial color="#b8895a" toneMapped={false} fog={false} />
        </mesh>
        <mesh ref={ringRef} rotation={[Math.PI / 2.25, 0, 0]} renderOrder={-878}>
          <ringGeometry args={[10, 15.5, 72]} />
          <meshBasicMaterial
            color="#e0c39a"
            transparent
            opacity={0.4}
            side={DoubleSide}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// -- Drifting islands --------------------------------------------------------

/** Sister islands: a rock keel under a grassy cap, bobbing on their own phase. */
function FloatingIslands() {
  const islands = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.8
        const radius = 44 + Math.random() * 46
        return {
          x: Math.cos(angle) * radius,
          y: -12 + Math.random() * 34,
          z: Math.sin(angle) * radius,
          scale: 3 + Math.random() * 8,
          tilt: (Math.random() - 0.5) * 0.5,
          spin: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          bob: 0.6 + Math.random() * 1.4,
        }
      }),
    [],
  )
  const refs = useRef<Array<Group | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    islands.forEach((isle, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.y = isle.y + Math.sin(t * 0.18 + isle.phase) * isle.bob
      g.rotation.y = isle.spin + t * 0.012
    })
  })

  return (
    <group>
      {islands.map((isle, i) => (
        <group
          key={`isle-${i}`}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={[isle.x, isle.y, isle.z]}
          rotation={[isle.tilt, isle.spin, isle.tilt * 0.6]}
          scale={isle.scale}
        >
          {/* Grass cap */}
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[1, 0.92, 0.12, 12]} />
            <meshBasicMaterial color="#4f7a46" toneMapped={false} />
          </mesh>
          {/* Rock keel */}
          <mesh position={[0, -0.55, 0]}>
            <coneGeometry args={[0.92, 1.2, 9]} />
            <meshBasicMaterial color="#3a3348" toneMapped={false} />
          </mesh>
          {/* Faint underside glow so it reads as suspended */}
          <mesh position={[0, -1.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.1, 20]} />
            <meshBasicMaterial
              color="#7ad0ff"
              transparent
              opacity={0.16}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// -- Passing craft -----------------------------------------------------------

/** Small ships crossing the void, each on its own long loop. */
function PassingShips() {
  const ships = useMemo(
    () =>
      Array.from({ length: 4 }).map((_, i) => ({
        period: 26 + i * 9 + Math.random() * 10,
        offset: Math.random() * 40,
        height: 12 + Math.random() * 30,
        depth: -50 - Math.random() * 40,
        span: 150,
        scale: 0.7 + Math.random() * 1.5,
        tilt: (Math.random() - 0.5) * 0.4,
        reverse: i % 2 === 0,
      })),
    [],
  )
  const refs = useRef<Array<Group | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ships.forEach((ship, i) => {
      const g = refs.current[i]
      if (!g) return
      const p = ((t + ship.offset) % ship.period) / ship.period
      const travel = ship.reverse ? 1 - p : p
      g.position.set(
        -ship.span / 2 + travel * ship.span,
        ship.height + Math.sin(t * 0.4 + i) * 0.6,
        ship.depth,
      )
      g.rotation.set(0, ship.reverse ? Math.PI : 0, ship.tilt)
    })
  })

  return (
    <group>
      {ships.map((ship, i) => (
        <group
          key={`ship-${i}`}
          ref={(el) => {
            refs.current[i] = el
          }}
          scale={ship.scale}
        >
          {/* Hull */}
          <mesh>
            <boxGeometry args={[2.6, 0.34, 0.7]} />
            <meshBasicMaterial color="#c8cede" toneMapped={false} />
          </mesh>
          {/* Swept wing */}
          <mesh position={[-0.3, 0, 0]}>
            <boxGeometry args={[1.1, 0.12, 2.1]} />
            <meshBasicMaterial color="#98a0b4" toneMapped={false} />
          </mesh>
          {/* Engine bloom trailing behind */}
          <mesh position={[-1.5, 0, 0]}>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshBasicMaterial
              color="#59d8ff"
              transparent
              opacity={0.9}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          <mesh position={[-2.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.22, 1.8, 10, 1, true]} />
            <meshBasicMaterial
              color="#3aa8ff"
              transparent
              opacity={0.28}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** A halo under the board so the diorama itself reads as the biggest island. */
function IslandRim() {
  return (
    <group>
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[22, 34, 64]} />
        <meshBasicMaterial
          color="#6fc8ff"
          transparent
          opacity={0.12}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, -2.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[26, 48]} />
        <meshBasicMaterial
          color="#3a86c8"
          transparent
          opacity={0.07}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

export function SpaceBackdrop() {
  return (
    <group raycast={() => null}>
      <Nebula />
      <Planets />
      <FloatingIslands />
      <PassingShips />
      <IslandRim />
    </group>
  )
}
