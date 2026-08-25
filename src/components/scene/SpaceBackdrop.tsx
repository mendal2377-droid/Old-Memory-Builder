import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  ConeGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Matrix4,
  Object3D,
  type BufferGeometry,
  type Group,
  type InstancedMesh,
  type Mesh,
} from 'three'

/**
 * Deep Space: the diorama as an island torn loose and left adrift.
 *
 * The look leans on one rule — everything solid is very dark rock, and the
 * only bright things are light itself (engines, veins, the core, stars). That
 * contrast is what makes a floating island read as vast rather than flat.
 */

const ROCK = '#12162a'
const ROCK_LIT = '#232a44'
const GLOW = '#39d8ff'
const GLOW_DIM = '#1b6f9c'

// -- Shared helpers ----------------------------------------------------------

/** Roughen a geometry so rock reads as broken stone, not a clean primitive. */
function jitter(geometry: BufferGeometry, amount: number, seedScale = 1) {
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const n =
      Math.sin(x * 12.9898 * seedScale + y * 78.233 + z * 37.719) * 43758.5453
    const d = (n - Math.floor(n) - 0.5) * amount
    // Leave the top ring alone so caps still meet their keels
    const protect = y > 0.9 ? 0.25 : 1
    pos.setXYZ(i, x + d * protect, y + d * 0.55 * protect, z + d * protect)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

// -- Nebula ------------------------------------------------------------------

/** Wispy gas rather than soft bokeh blobs: long feathered streaks. */
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

  // Blue-dominant, with a single restrained magenta accent
  const inks = [
    'rgba(90,190,255,0.95)',
    'rgba(40,220,255,0.85)',
    'rgba(120,160,255,0.8)',
    'rgba(60,120,255,0.7)',
    'rgba(180,110,255,0.35)',
  ]

  ctx.lineCap = 'round'
  for (let i = 0; i < 46; i += 1) {
    ctx.strokeStyle = inks[Math.floor(Math.random() * inks.length)]
    ctx.lineWidth = 6 + Math.random() * 30
    ctx.globalAlpha = 0.45 + Math.random() * 0.5
    const y = 40 + Math.random() * 176
    const amp = 10 + Math.random() * 34
    ctx.beginPath()
    ctx.moveTo(-30, y)
    for (let x = -30; x < size + 30; x += 46) {
      ctx.quadraticCurveTo(x + 23, y + Math.sin(x * 0.03 + i) * amp, x + 46, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Stars caught in the gas
  for (let i = 0; i < 220; i += 1) {
    ctx.fillStyle = `rgba(220,240,255,${0.2 + Math.random() * 0.6})`
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1)
  }

  // Feather the rim so the plane never shows an edge
  const vignette = ctx.createRadialGradient(128, 128, 46, 128, 128, 128)
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
      Array.from({ length: 7 }).map((_, i) => ({
        angle: (i / 7) * Math.PI * 2 + Math.random() * 0.5,
        height: 14 + Math.random() * 48,
        scale: 88 + Math.random() * 70,
        spin: (Math.random() - 0.5) * 1.1,
        opacity: 0.5 + Math.random() * 0.34,
      })),
    [],
  )

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.004
  })

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <mesh
          key={`nebula-${i}`}
          position={[Math.cos(c.angle) * 118, c.height, Math.sin(c.angle) * 118]}
          rotation={[0, -c.angle + Math.PI / 2, c.spin]}
          renderOrder={-940}
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
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// -- Moons -------------------------------------------------------------------

function makeMoonTexture(base: string, crater: string) {
  const w = 256
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 90; i += 1) {
    const r = 2 + Math.random() * 13
    const x = Math.random() * w
    const y = Math.random() * h
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, crater)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

let moonTexA: CanvasTexture | null = null
let moonTexB: CanvasTexture | null = null

/** Cratered moons, lit for real so the terminator lands where the star is. */
function Moons() {
  const textures = useMemo(() => {
    if (typeof document === 'undefined') return { a: null, b: null }
    moonTexA = moonTexA ?? makeMoonTexture('#9aa4b4', 'rgba(72,80,96,0.85)')
    moonTexB = moonTexB ?? makeMoonTexture('#8590a4', 'rgba(58,66,84,0.8)')
    return { a: moonTexA, b: moonTexB }
  }, [])

  return (
    <group>
      <group position={[-78, 40, -92]}>
        <mesh renderOrder={-880}>
          <sphereGeometry args={[26, 56, 40]} />
          <meshStandardMaterial
            map={textures.a}
            roughness={1}
            metalness={0}
            emissive="#1a2536"
            emissiveIntensity={0.9}
            fog={false}
          />
        </mesh>
        <mesh renderOrder={-881}>
          <sphereGeometry args={[28, 32, 24]} />
          <meshBasicMaterial
            color="#5c8fd6"
            transparent
            opacity={0.1}
            side={BackSide}
            depthWrite={false}
            blending={AdditiveBlending}
            fog={false}
          />
        </mesh>
      </group>

      <group position={[88, 30, -70]}>
        <mesh renderOrder={-880}>
          <sphereGeometry args={[10, 44, 30]} />
          <meshStandardMaterial
            map={textures.b}
            roughness={1}
            metalness={0}
            emissive="#0a1018"
            emissiveIntensity={0.5}
            fog={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// -- Drifting islands --------------------------------------------------------

/** Sister islands: dark broken rock with glowing veins, each on its own bob. */
function FloatingIslands() {
  const geometries = useMemo(() => {
    const keel = jitter(new ConeGeometry(0.95, 2.4, 9, 6), 0.42, 1)
    const cap = jitter(new ConeGeometry(1.05, 0.4, 10, 2), 0.2, 2.3)
    return { keel, cap }
  }, [])

  const islands = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => {
        const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.7
        const radius = 42 + Math.random() * 54
        return {
          x: Math.cos(angle) * radius,
          y: -14 + Math.random() * 38,
          z: Math.sin(angle) * radius,
          scale: 2.6 + Math.random() * 9,
          tilt: (Math.random() - 0.5) * 0.5,
          spin: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          bob: 0.5 + Math.random() * 1.5,
          veins: 2 + Math.floor(Math.random() * 3),
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
      g.position.y = isle.y + Math.sin(t * 0.17 + isle.phase) * isle.bob
      g.rotation.y = isle.spin + t * 0.01
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
          {/* Thin band of soil; most of the mass is rock */}
          <mesh geometry={geometries.cap} position={[0, 0.12, 0]}>
            <meshStandardMaterial
              color="#2f4436"
              roughness={1}
              emissive="#070d0a"
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* Dark broken keel */}
          <mesh
            geometry={geometries.keel}
            position={[0, -1.15, 0]}
            rotation={[Math.PI, 0, 0]}
          >
            <meshStandardMaterial
              color={ROCK}
              roughness={1}
              emissive="#060a14"
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* Glowing veins threading the underside */}
          {Array.from({ length: isle.veins }).map((_, v) => {
            const a = (v / isle.veins) * Math.PI * 2 + i
            return (
              <mesh
                key={`vein-${v}`}
                position={[Math.cos(a) * 0.4, -0.9, Math.sin(a) * 0.4]}
                rotation={[0, -a, 0.2]}
                scale={[0.05, 1.1, 0.05]}
              >
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial
                  color={GLOW}
                  transparent
                  opacity={0.75}
                  depthWrite={false}
                  blending={AdditiveBlending}
                />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

// -- Asteroid debris ---------------------------------------------------------

function AsteroidField() {
  const meshRef = useRef<InstancedMesh>(null)
  const count = 110
  const geometry = useMemo(
    () => jitter(new DodecahedronGeometry(1, 0), 0.42, 4.1),
    [],
  )
  const rocks = useMemo(() => {
    const dummy = new Object3D()
    const matrices = new Float32Array(count * 16)
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2
      const r = 34 + Math.random() * 76
      dummy.position.set(
        Math.cos(a) * r,
        -20 + Math.random() * 56,
        Math.sin(a) * r,
      )
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      dummy.scale.setScalar(0.25 + Math.pow(Math.random(), 2.2) * 2.2)
      dummy.updateMatrix()
      dummy.matrix.toArray(matrices, i * 16)
    }
    return matrices
  }, [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || mesh.userData.filled) return
    const m = new Matrix4()
    for (let i = 0; i < count; i += 1) {
      m.fromArray(rocks, i * 16)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.userData.filled = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
      raycast={() => null}
    >
      <meshStandardMaterial
        color={ROCK_LIT}
        roughness={1}
        emissive="#05080f"
        emissiveIntensity={0.5}
      />
    </instancedMesh>
  )
}

// -- Traffic -----------------------------------------------------------------

/**
 * Ships keep their distance and stay dark, so only their engines read at
 * range — pale and close, they looked like flying cigars.
 */
function PassingShips() {
  const ships = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => {
        const heavy = i % 4 === 0
        return {
          heavy,
          period: heavy ? 80 + Math.random() * 50 : 30 + Math.random() * 26,
          offset: Math.random() * 70,
          height: 10 + Math.random() * 44,
          depth: -58 - Math.random() * 60,
          span: 230,
          scale: heavy ? 3.6 + Math.random() * 2.4 : 1.1 + Math.random() * 1.2,
          tilt: (Math.random() - 0.5) * 0.3,
          reverse: i % 2 === 0,
        }
      }),
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
        ship.height + Math.sin(t * 0.3 + i) * 0.4,
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
          {/* Dark hull — a silhouette, not a highlight */}
          <mesh>
            <boxGeometry args={ship.heavy ? [5.2, 0.7, 1.3] : [2.2, 0.26, 0.5]} />
            <meshStandardMaterial
              color="#1b2133"
              roughness={1}
              emissive="#080c16"
              emissiveIntensity={0.6}
              fog={false}
            />
          </mesh>
          <mesh position={ship.heavy ? [-1.3, 0.45, 0] : [-0.3, 0, 0]}>
            <boxGeometry args={ship.heavy ? [1.8, 0.45, 0.8] : [0.9, 0.09, 1.6]} />
            <meshStandardMaterial color="#252c42" roughness={1} fog={false} />
          </mesh>
          {/* Running light */}
          <mesh position={[ship.heavy ? 2.4 : 1.0, 0, 0]}>
            <sphereGeometry args={[ship.heavy ? 0.14 : 0.07, 8, 8]} />
            <meshBasicMaterial color="#ff5a6e" toneMapped={false} fog={false} />
          </mesh>
          {/* Engine bloom — the only bright thing aboard */}
          <mesh position={[ship.heavy ? -2.9 : -1.25, 0, 0]}>
            <sphereGeometry args={[ship.heavy ? 0.42 : 0.18, 12, 12]} />
            <meshBasicMaterial
              color={GLOW}
              transparent
              opacity={0.95}
              depthWrite={false}
              blending={AdditiveBlending}
              fog={false}
            />
          </mesh>
          <mesh
            position={[ship.heavy ? -4.8 : -2.2, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <coneGeometry
              args={[ship.heavy ? 0.32 : 0.15, ship.heavy ? 4 : 2, 10, 1, true]}
            />
            <meshBasicMaterial
              color={GLOW_DIM}
              transparent
              opacity={0.3}
              depthWrite={false}
              blending={AdditiveBlending}
              fog={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// -- The island's own core ---------------------------------------------------

/**
 * A reactor slung beneath the board. This is what sells the diorama as the
 * biggest island out here, rather than ground that happens to stop.
 */
function IslandCore() {
  const glowRef = useRef<Mesh>(null)
  const ringRef = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (glowRef.current) {
      const m = glowRef.current.material as { opacity: number }
      m.opacity = 0.5 + Math.sin(t * 0.9) * 0.16
    }
    if (ringRef.current) ringRef.current.rotation.z += 0.004
  })

  return (
    <group position={[0, -3.2, 0]}>
      {/* Rock keel under the board */}
      <mesh position={[0, -3.4, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[17, 12, 12, 3]} />
        <meshStandardMaterial
          color={ROCK}
          roughness={1}
          emissive="#060a14"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Reactor housing */}
      <mesh position={[0, -8.5, 0]}>
        <cylinderGeometry args={[2.6, 3.6, 5, 12]} />
        <meshStandardMaterial
          color="#1d2438"
          roughness={1}
          emissive="#0a1424"
          emissiveIntensity={0.7}
        />
      </mesh>
      {/* Core light */}
      <mesh ref={glowRef} position={[0, -10.6, 0]}>
        <sphereGeometry args={[2.6, 24, 20]} />
        <meshBasicMaterial
          color={GLOW}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, -10.6, 0]}>
        <sphereGeometry args={[1.3, 20, 16]} />
        <meshBasicMaterial color="#cdf4ff" toneMapped={false} />
      </mesh>
      {/* Halo ring */}
      <mesh ref={ringRef} position={[0, -6.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 9.5, 48]} />
        <meshBasicMaterial
          color={GLOW_DIM}
          transparent
          opacity={0.18}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Light spilling onto the underside */}
      <pointLight
        position={[0, -9, 0]}
        color={GLOW}
        intensity={7}
        distance={40}
        decay={1.7}
      />
    </group>
  )
}

// -- Rim installations -------------------------------------------------------

/** A point on the square board edge, plus the outward direction there. */
function rimPoint(t: number, half: number) {
  const p = ((t % 1) + 1) % 1
  const side = Math.floor(p * 4)
  const f = p * 4 - side
  const a = -half + f * half * 2
  switch (side) {
    case 0:
      return { x: a, z: -half, nx: 0, nz: -1, yaw: 0 }
    case 1:
      return { x: half, z: a, nx: 1, nz: 0, yaw: Math.PI / 2 }
    case 2:
      return { x: -a, z: half, nx: 0, nz: 1, yaw: Math.PI }
    default:
      return { x: -half, z: -a, nx: -1, nz: 0, yaw: -Math.PI / 2 }
  }
}

/**
 * Docking platforms and antenna spires clamped around the island's edge —
 * the thing that reads most immediately as "this rock has been built on".
 */
function RimInstallations() {
  const rigs = useMemo(() => {
    const half = 22.5
    const count = 26
    return Array.from({ length: count }).map((_, i) => {
      const t = i / count + (Math.random() - 0.5) * 0.012
      const p = rimPoint(t, half)
      const out = 0.4 + Math.random() * 2.2
      return {
        x: p.x + p.nx * out,
        z: p.z + p.nz * out,
        yaw: p.yaw,
        towerH: 3 + Math.pow(Math.random(), 1.6) * 12,
        towerW: 0.5 + Math.random() * 1.1,
        deckW: 1.6 + Math.random() * 3.4,
        deckD: 1.2 + Math.random() * 2.2,
        drop: 1 + Math.random() * 4,
        hasMast: Math.random() > 0.45,
        lightPhase: Math.random() * Math.PI * 2,
      }
    })
  }, [])

  const lightRefs = useRef<Array<Mesh | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    rigs.forEach((rig, i) => {
      const m = lightRefs.current[i]
      if (!m) return
      const mat = m.material as { opacity: number }
      mat.opacity = 0.45 + Math.abs(Math.sin(t * 0.8 + rig.lightPhase)) * 0.5
    })
  })

  return (
    <group>
      {rigs.map((rig, i) => (
        <group key={`rig-${i}`} position={[rig.x, 0, rig.z]} rotation={[0, rig.yaw, 0]}>
          {/* Deck clamped to the rim, hanging slightly below the surface */}
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[rig.deckW, 0.5, rig.deckD]} />
            <meshStandardMaterial
              color="#1a2032"
              roughness={1}
              emissive="#080d18"
              emissiveIntensity={0.6}
            />
          </mesh>
          {/* Structure dropping down the cliff face */}
          <mesh position={[0, -0.6 - rig.drop / 2, 0]}>
            <boxGeometry args={[rig.deckW * 0.55, rig.drop, rig.deckD * 0.6]} />
            <meshStandardMaterial
              color="#161c2c"
              roughness={1}
              emissive="#070b14"
              emissiveIntensity={0.6}
            />
          </mesh>
          {/* Lit window strip down the drop */}
          <mesh position={[0, -0.6 - rig.drop / 2, rig.deckD * 0.31]}>
            <planeGeometry args={[rig.deckW * 0.3, rig.drop * 0.72]} />
            <meshBasicMaterial
              color={GLOW}
              transparent
              opacity={0.5}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          {/* Tower */}
          <mesh position={[0, rig.towerH / 2, 0]}>
            <boxGeometry args={[rig.towerW, rig.towerH, rig.towerW]} />
            <meshStandardMaterial
              color="#1c2336"
              roughness={1}
              emissive="#0a1120"
              emissiveIntensity={0.6}
            />
          </mesh>
          {/* Vertical light seam up the tower */}
          <mesh position={[0, rig.towerH / 2, rig.towerW * 0.52]}>
            <planeGeometry args={[rig.towerW * 0.26, rig.towerH * 0.82]} />
            <meshBasicMaterial
              color={GLOW}
              transparent
              opacity={0.6}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          {/* Slim antenna mast */}
          {rig.hasMast ? (
            <mesh position={[0, rig.towerH + 1.6, 0]}>
              <cylinderGeometry args={[0.05, 0.09, 3.2, 6]} />
              <meshStandardMaterial color="#2a3146" roughness={1} />
            </mesh>
          ) : null}
          {/* Blinking beacon on top */}
          <mesh
            ref={(el) => {
              lightRefs.current[i] = el
            }}
            position={[0, rig.towerH + (rig.hasMast ? 3.3 : 0.3), 0]}
          >
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshBasicMaterial
              color="#ff5a6e"
              transparent
              opacity={0.8}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function SpaceBackdrop() {
  return (
    <group raycast={() => null}>
      <Nebula />
      <Moons />
      <AsteroidField />
      <FloatingIslands />
      <PassingShips />
      <IslandCore />
      <RimInstallations />
    </group>
  )
}
