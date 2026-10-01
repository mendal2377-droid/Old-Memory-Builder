import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { CanvasTexture, HalfFloatType, MathUtils, SRGBColorSpace } from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { worldSnapshots } from '../../data/worldSnapshots'
import {
  createFeed,
  drawAnimals,
  drawBuild,
  drawLog,
  drawModel,
  drawPhoto,
  drawRain,
  drawWeather,
  updateFeed,
  type Feed,
} from './feeds'

/**
 * The white room inside the lighthouse.
 *
 * A circular white room, a curved wall of monitors, a desk with a chair. Three
 * of the screens are large and show the garden's construction, the weather and
 * the animals; the rest tile smaller feeds -- the build ledger, wireframes,
 * falling code. All of it is drawn from the live scene (see feeds.ts).
 *
 * It is its own Canvas, so the diorama's lighting, fog, bloom and Hollow never
 * touch it, and the diorama's own render loop is paused while you are in here.
 */

// The wall sits well behind the screens: the large ones are flat, so their
// ends stand further from the centre than their middles and would otherwise
// poke through a wall that hugs the screen radius.
const WALL_R = 10.7
const SCREEN_R = 9.3
const WALK_R = 8.6
const EYE = 1.65
const WALL_H = 7.6
const DOOR = { x: 0, z: WALL_R - 0.08 }
const DOOR_REACH = 2.7

// The desk, as a box the player cannot walk through
const DESK = { x0: -1.9, x1: 1.9, z0: 1.3, z1: 2.7 }

interface Hero {
  angle: number
  y: number
  w: number
  h: number
  feed: Feed
}

function pickSmall(feeds: Feed[], col: number, row: number) {
  const n = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453
  const r = n - Math.floor(n)
  return feeds[Math.floor(r * feeds.length)]
}

function Screens() {
  const feeds = useMemo(() => {
    const main = createFeed(960, 540, 1 / 24, drawBuild(1.15, 1.6, 0))
    const weather = createFeed(768, 432, 1 / 10, drawWeather())
    const animals = createFeed(768, 432, 1 / 10, drawAnimals())
    const smalls: Feed[] = [
      createFeed(384, 240, 1 / 15, drawRain(1)),
      createFeed(384, 240, 1 / 15, drawRain(2)),
      createFeed(384, 240, 1 / 15, drawRain(3)),
      createFeed(384, 240, 1 / 15, drawRain(4)),
      createFeed(384, 240, 1 / 12, drawBuild(1.5, 1.1, 0.35)),
      createFeed(384, 240, 1 / 12, drawBuild(0.95, 2.1, 0.7)),
      createFeed(384, 240, 1 / 12, drawModel(0.6, 0)),
      createFeed(384, 240, 1 / 12, drawModel(-0.45, 2)),
      createFeed(384, 240, 1 / 8, drawLog()),
      createFeed(384, 240, 1 / 8, drawLog()),
    ]
    // Full-colour stills of the garden, taken as you came through the door.
    // They take about half the small screens, so the room is not all green.
    const photoCount = Math.min(worldSnapshots.frames.length, 7)
    const photos = Array.from({ length: photoCount }, (_, i) =>
      createFeed(384, 240, 1 / 12, drawPhoto(i)),
    )
    return { main, weather, animals, smalls, photos }
  }, [])

  useEffect(
    () => () => {
      for (const f of [feeds.main, feeds.weather, feeds.animals, ...feeds.smalls, ...feeds.photos]) {
        f.texture.dispose()
      }
    },
    [feeds],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    updateFeed(feeds.main, t)
    updateFeed(feeds.weather, t)
    updateFeed(feeds.animals, t)
    for (const f of feeds.smalls) updateFeed(f, t)
    for (const f of feeds.photos) updateFeed(f, t)
  })

  const heroes: Hero[] = useMemo(
    () => [
      { angle: 0, y: 3.5, w: 7.4, h: 4.16, feed: feeds.main },
      { angle: -0.86, y: 3.2, w: 4.8, h: 2.7, feed: feeds.weather },
      { angle: 0.86, y: 3.2, w: 4.8, h: 2.7, feed: feeds.animals },
    ],
    [feeds],
  )

  const small = useMemo(() => {
    const out: Array<{ angle: number; y: number; feed: Feed }> = []
    const mw = 1.8
    const mh = 1.12
    const step = (mw + 0.09) / SCREEN_R
    const cols = Math.floor((Math.PI * 1.12) / step)
    for (let c = -Math.floor(cols / 2); c <= Math.floor(cols / 2); c += 1) {
      const angle = c * step
      for (let r = 0; r < 6; r += 1) {
        const y = 0.75 + r * (mh + 0.09)
        const covered = heroes.some(
          (hero) =>
            Math.abs(angle - hero.angle) < (hero.w / 2 + mw / 2 + 0.14) / SCREEN_R &&
            Math.abs(y - hero.y) < hero.h / 2 + mh / 2 + 0.14,
        )
        if (!covered) {
          const pool = [...feeds.photos, ...feeds.photos, ...feeds.smalls]
          out.push({ angle, y, feed: pickSmall(pool, c, r) })
        }
      }
    }
    return out
  }, [feeds, heroes])

  const screen = (
    key: string,
    angle: number,
    y: number,
    w: number,
    h: number,
    feed: Feed,
    gain: number,
  ) => (
    <group
      key={key}
      position={[Math.sin(angle) * SCREEN_R, y, -Math.cos(angle) * SCREEN_R]}
      rotation={[0, -angle, 0]}
    >
      <mesh position={[0, 0, -0.07]}>
        <boxGeometry args={[w + 0.08, h + 0.08, 0.1]} />
        <meshStandardMaterial color="#d6d9db" roughness={0.6} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={feed.texture} toneMapped={false} color={[gain, gain, gain]} />
      </mesh>
    </group>
  )

  return (
    <>
      {heroes.map((hero, i) =>
        screen(`hero-${i}`, hero.angle, hero.y, hero.w, hero.h, hero.feed, 1.35),
      )}
      {small.map((m, i) =>
        screen(`s-${i}`, m.angle, m.y, 1.8, 1.12, m.feed, feeds.photos.includes(m.feed) ? 1.0 : 1.2),
      )}
    </>
  )
}

function useExitSign() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 96
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#04120a'
      ctx.fillRect(0, 0, 256, 96)
      ctx.strokeStyle = '#6dff9a'
      ctx.lineWidth = 4
      ctx.strokeRect(6, 6, 244, 84)
      ctx.fillStyle = '#6dff9a'
      ctx.font = 'bold 54px "Consolas", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('EXIT', 128, 52)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [])
}

function ExitDoor({ onLeave }: { onLeave: () => void }) {
  const sign = useExitSign()
  const [hot, setHot] = useState(false)
  return (
    <group position={[DOOR.x, 0, DOOR.z]} rotation={[0, Math.PI, 0]}>
      {/* Frame, then the dark doorway, then a green seam of light round it */}
      <mesh position={[0, 1.55, 0.01]}>
        <planeGeometry args={[2.1, 3.3]} />
        <meshBasicMaterial color={[0.35, 1.5, 0.7]} toneMapped={false} />
      </mesh>
      <mesh
        position={[0, 1.45, 0.03]}
        onClick={onLeave}
        onPointerOver={() => {
          setHot(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHot(false)
          document.body.style.cursor = ''
        }}
      >
        <planeGeometry args={[1.8, 3.0]} />
        <meshBasicMaterial color={hot ? '#1b3a2a' : '#050a08'} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.55, 0.04]}>
        <planeGeometry args={[1.5, 0.56]} />
        <meshBasicMaterial map={sign} toneMapped={false} color={[1.3, 1.3, 1.3]} />
      </mesh>
      <pointLight position={[0, 2, -1.2]} color="#7dffb0" intensity={6} distance={9} />
    </group>
  )
}

function Furniture() {
  return (
    <group>
      {/* Desk: a long white slab on two slab legs */}
      <mesh position={[0, 0.9, 2.0]} castShadow>
        <boxGeometry args={[3.6, 0.1, 1.3]} />
        <meshStandardMaterial color="#e4e5e2" roughness={0.4} />
      </mesh>
      {[-1.65, 1.65].map((x) => (
        <mesh key={x} position={[x, 0.45, 2.0]}>
          <boxGeometry args={[0.12, 0.9, 1.1]} />
          <meshStandardMaterial color="#e9e9e6" roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

interface RigProps {
  onLeave: () => void
  onNearDoor: (near: boolean) => void
}

function Rig({ onLeave, onNearDoor }: RigProps) {
  const { camera, gl } = useThree()
  const pos = useRef({ x: 0, z: 6.2 })
  const yaw = useRef(0)
  const pitch = useRef(0)
  const keys = useRef(new Set<string>())
  const near = useRef(false)

  useEffect(() => {
    camera.rotation.order = 'YXZ'
  }, [camera])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // The room owns the keyboard. Capture phase, so the diorama's own
      // handlers (including its Escape-to-leave-walk) never see these.
      e.stopPropagation()
      if (e.code === 'Escape') {
        e.preventDefault()
        onLeave()
        return
      }
      if (e.code === 'KeyE' && near.current) {
        onLeave()
        return
      }
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code,
        )
      ) {
        e.preventDefault()
        keys.current.add(e.code)
      }
    }
    const up = (e: KeyboardEvent) => {
      e.stopPropagation()
      keys.current.delete(e.code)
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)

    const canvas = gl.domElement
    let dragging = false
    const pdown = (e: PointerEvent) => {
      dragging = true
      canvas.setPointerCapture(e.pointerId)
    }
    const pmove = (e: PointerEvent) => {
      if (!dragging) return
      yaw.current -= e.movementX * 0.0032
      pitch.current = MathUtils.clamp(pitch.current - e.movementY * 0.0032, -0.7, 0.7)
    }
    const pup = (e: PointerEvent) => {
      dragging = false
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }
    canvas.addEventListener('pointerdown', pdown)
    canvas.addEventListener('pointermove', pmove)
    canvas.addEventListener('pointerup', pup)
    canvas.addEventListener('pointerleave', pup)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      canvas.removeEventListener('pointerdown', pdown)
      canvas.removeEventListener('pointermove', pmove)
      canvas.removeEventListener('pointerup', pup)
      canvas.removeEventListener('pointerleave', pup)
    }
  }, [gl.domElement, onLeave])

  useFrame((_, delta) => {
    const k = keys.current
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
    const dt = Math.min(delta, 0.05)
    if (fwd || strafe) {
      const len = Math.hypot(fwd, strafe)
      const speed = 3.4
      const dx =
        ((-Math.sin(yaw.current) * fwd + Math.cos(yaw.current) * strafe) / len) * speed * dt
      const dz =
        ((-Math.cos(yaw.current) * fwd - Math.sin(yaw.current) * strafe) / len) * speed * dt
      const inDesk = (x: number, z: number) =>
        x > DESK.x0 && x < DESK.x1 && z > DESK.z0 && z < DESK.z1
      const nx = pos.current.x + dx
      if (!inDesk(nx, pos.current.z) && Math.hypot(nx, pos.current.z) < WALK_R) pos.current.x = nx
      const nz = pos.current.z + dz
      if (!inDesk(pos.current.x, nz) && Math.hypot(pos.current.x, nz) < WALK_R) pos.current.z = nz
    }

    camera.position.set(pos.current.x, EYE, pos.current.z)
    camera.rotation.set(pitch.current, yaw.current, 0)

    const isNear = Math.hypot(pos.current.x - DOOR.x, pos.current.z - DOOR.z) < DOOR_REACH
    if (isNear !== near.current) {
      near.current = isNear
      onNearDoor(isNear)
    }
  })

  return null
}

function Room({ onLeave, onNearDoor }: RigProps) {
  return (
    <>
      <color attach="background" args={['#f2f3f2']} />
      <fog attach="fog" args={['#f2f3f2', 18, 40]} />
      <hemisphereLight args={['#ffffff', '#cfd3d6', 1.1]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, WALL_H - 0.6, 0]} intensity={30} distance={34} color="#ffffff" />
      <pointLight position={[0, 3, -3]} intensity={20} distance={18} color="#c8ffe0" />

      {/* Floor: glossy white, picking up the glow of the screens */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[WALL_R + 0.2, 72]} />
        <MeshReflectorMaterial
          color="#e8eaea"
          resolution={512}
          blur={[260, 80]}
          mixBlur={1}
          mixStrength={0.55}
          mirror={0.6}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
      {/* Wall */}
      <mesh position={[0, WALL_H / 2, 0]}>
        <cylinderGeometry args={[WALL_R, WALL_R, WALL_H, 72, 1, true]} />
        <meshStandardMaterial color="#f6f6f4" roughness={0.9} side={1} />
      </mesh>
      {/* Ceiling, lit */}
      <mesh position={[0, WALL_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[WALL_R, 72]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>

      <Screens />
      <Furniture />
      <ExitDoor onLeave={onLeave} />
      <Rig onLeave={onLeave} onNearDoor={onNearDoor} />

      <EffectComposer frameBufferType={HalfFloatType} multisampling={0}>
        <Bloom intensity={0.5} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur radius={0.7} />
        <Vignette offset={0.3} darkness={0.35} eskil={false} />
      </EffectComposer>
    </>
  )
}

const CAPTION = 'Everything you placed is here. Every hour it has been, every animal in it.'

export function ArchitectRoom() {
  const setLighthouseRoom = useSceneStore((s) => s.setLighthouseRoom)
  const [leaving, setLeaving] = useState(false)
  const [nearDoor, setNearDoor] = useState(false)
  const [typed, setTyped] = useState('')
  const leavingRef = useRef(false)

  const onLeave = useMemo(
    () => () => {
      if (leavingRef.current) return
      leavingRef.current = true
      setLeaving(true)
      window.setTimeout(() => setLighthouseRoom('none'), 550)
    },
    [setLighthouseRoom],
  )

  useEffect(() => {
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setTyped(CAPTION.slice(0, i))
      if (i >= CAPTION.length) window.clearInterval(id)
    }, 45)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="architect-room" role="dialog" aria-label="The room inside the lighthouse">
      <Canvas
        camera={{ fov: 68, near: 0.05, far: 80, position: [0, EYE, 6.2] }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
      >
        <Room onLeave={onLeave} onNearDoor={setNearDoor} />
      </Canvas>

      <div className="architect-caption" aria-live="polite">
        {typed}
      </div>
      <div className="architect-hint">WASD move · drag to look · Esc or the door to leave</div>
      <button type="button" className="architect-leave" onClick={onLeave}>
        Leave
      </button>
      {nearDoor ? <div className="architect-prompt">Press E to leave</div> : null}
      <div className={`architect-fade${leaving ? ' is-leaving' : ''}`} />
    </div>
  )
}
