import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import {
  MathUtils,
  type PerspectiveCamera as ThreePerspectiveCamera,
  Vector3,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { assets } from '../../data/assets'
import { playBridgeRepaired, playWoodCollected } from '../game/gameAudio'
import { useSceneStore } from '../../store/sceneStore'

type WalkPhase = 'idle' | 'entering' | 'walking' | 'exiting'

interface MemoryWalkCameraProps {
  controlsRef: RefObject<OrbitControlsImpl | null>
}

interface Collider {
  position: Vector3
  radius: number
}

interface WalkMemoryTrigger {
  position: Vector3
  title: string
  text: string
  sound: 'birds' | 'water' | 'wind' | 'soft'
  used: boolean
}

const boardHalfSize = 22
const eyeHeight = 1.65
const transitionDuration = 2.4
const walkSpeed = 1.62
const playerRadius = 0.45
const lookSensitivity = 0.0032
const minimumSpawnClearance = 1.25

const walkMemoryMessages: Array<Omit<WalkMemoryTrigger, 'position' | 'used'>> = [
  {
    title: 'A Small Breeze',
    text: 'For a moment, the whole place feels like it remembers you back.',
    sound: 'wind',
  },
  {
    title: 'Quiet Footsteps',
    text: 'The path is only stones and grass, but it somehow knows where to lead.',
    sound: 'soft',
  },
  {
    title: 'Faraway Birds',
    text: 'Birdsong crosses the scene like a thread from another morning.',
    sound: 'birds',
  },
  {
    title: 'Water Nearby',
    text: 'A ripple catches the light and carries it downstream.',
    sound: 'water',
  },
  {
    title: 'Warm Light',
    text: 'Sunlight gathers on the ground in soft patches, like an old photograph.',
    sound: 'soft',
  },
]

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function clampToBoard(value: number) {
  return Math.max(-boardHalfSize, Math.min(boardHalfSize, value))
}

function computeSceneCenter(sceneObjects: ReturnType<typeof useSceneStore.getState>['sceneObjects']) {
  if (sceneObjects.length === 0) {
    return new Vector3(0, 0, 0)
  }

  const center = sceneObjects.reduce(
    (sum, object) =>
      sum.add(new Vector3(object.position[0], 0, object.position[2])),
    new Vector3(),
  )

  return center.multiplyScalar(1 / sceneObjects.length)
}

function getObjectCollisionRadius(
  object: ReturnType<typeof useSceneStore.getState>['sceneObjects'][number],
) {
  const asset = assets.find((item) => item.id === object.assetId)
  const maxScale = Math.max(object.scale[0], object.scale[2])

  if (!asset) {
    return 0
  }

  if (asset.collisionRadius) {
    return asset.collisionRadius * maxScale
  }

  if (asset.category === 'HOUSES') {
    return maxScale * 1.55
  }

  if (asset.category === 'Water') {
    return asset.id.includes('pond') ? maxScale * 0.9 : maxScale * 0.55
  }

  if (asset.category === 'Trees') {
    return maxScale * 0.72
  }

  if (asset.category === 'Rocks') {
    return maxScale * 0.62
  }

  if (asset.category === 'Animals') {
    return maxScale * 0.72
  }

  if (asset.category === 'Plants') {
    return maxScale > 1.25 ? maxScale * 0.48 : 0
  }

  if (asset.category === 'Props') {
    return maxScale * 0.7
  }

  return 0
}

function createObjectColliders(
  sceneObjects: ReturnType<typeof useSceneStore.getState>['sceneObjects'],
) {
  return sceneObjects
    .map((object): Collider | null => {
      const radius = getObjectCollisionRadius(object)

      if (radius <= 0) {
        return null
      }

      return {
        position: new Vector3(object.position[0], 0, object.position[2]),
        radius,
      }
    })
    .filter((collider): collider is Collider => collider !== null)
}

function isInRiverbankWater(position: Vector3) {
  const samples = [
    [13, -22, 4.2, 5.2],
    [12, -15, 4.4, 5.4],
    [13, -8, 4.2, 5.2],
    [16, -1, 4.6, 5.8],
    [18, 6, 4.3, 5.4],
    [17, 13, 4.4, 5.6],
    [15, 20, 4, 5],
  ]

  return samples.some(([x, z, width, length]) => {
    const dx = (position.x - x) / width
    const dz = (position.z - z) / length

    return dx * dx + dz * dz < 0.72
  })
}

interface BridgeCorridor {
  x: number
  z: number
  halfLength: number
  halfWidth: number
  cos: number
  sin: number
}

function getBridgeCorridors(
  sceneObjects: ReturnType<typeof useSceneStore.getState>['sceneObjects'],
): BridgeCorridor[] {
  return sceneObjects
    .filter((object) => object.assetId.startsWith('bridge'))
    .map((object) => {
      const angle = object.rotation[1]
      return {
        x: object.position[0],
        z: object.position[2],
        // Bridge primitive is 4.6 long (local X) and 1.4 wide (local Z).
        // Generous padding so crossing tolerates a little drift and the
        // ramps at each end are easy to step onto.
        halfLength: (4.6 / 2) * object.scale[0] + 1.2,
        halfWidth: (1.4 / 2) * object.scale[2] + 1.05,
        cos: Math.cos(angle),
        sin: Math.sin(angle),
      }
    })
}

function isOnBridge(position: Vector3, bridges: BridgeCorridor[]) {
  return bridges.some((bridge) => {
    const dx = position.x - bridge.x
    const dz = position.z - bridge.z
    const localX = dx * bridge.cos - dz * bridge.sin
    const localZ = dx * bridge.sin + dz * bridge.cos

    return (
      Math.abs(localX) < bridge.halfLength &&
      Math.abs(localZ) < bridge.halfWidth
    )
  })
}

function isBlockedPosition(
  position: Vector3,
  colliders: Collider[],
  extraClearance = playerRadius,
  bridges: BridgeCorridor[] = [],
) {
  if (
    Math.abs(position.x) > boardHalfSize ||
    Math.abs(position.z) > boardHalfSize
  ) {
    return true
  }

  // The river now flows through every terrain; block it unless on a bridge
  if (isInRiverbankWater(position) && !isOnBridge(position, bridges)) {
    return true
  }

  return colliders.some((collider) => {
    const dx = collider.position.x - position.x
    const dz = collider.position.z - position.z

    return Math.hypot(dx, dz) < collider.radius + extraClearance
  })
}

function getNearestClearance(position: Vector3, colliders: Collider[]) {
  if (colliders.length === 0) {
    return 999
  }

  return colliders.reduce((nearest, collider) => {
    const dx = collider.position.x - position.x
    const dz = collider.position.z - position.z
    const clearance = Math.hypot(dx, dz) - collider.radius

    return Math.min(nearest, clearance)
  }, 999)
}

function getLocalDensity(position: Vector3, colliders: Collider[]) {
  return colliders.filter((collider) => {
    const dx = collider.position.x - position.x
    const dz = collider.position.z - position.z

    return Math.hypot(dx, dz) < collider.radius + 4
  }).length
}

function chooseSafeSpawnPoint(
  sceneCenter: Vector3,
  colliders: Collider[],
  terrainMode: ReturnType<typeof useSceneStore.getState>['terrainMode'],
) {
  const center = new Vector3(
    clampToBoard(sceneCenter.x),
    eyeHeight,
    clampToBoard(sceneCenter.z),
  )
  const fallbackCandidates = [
    new Vector3(-10, eyeHeight, 12),
    new Vector3(-14, eyeHeight, 6),
    new Vector3(0, eyeHeight, 14),
    new Vector3(-16, eyeHeight, -4),
  ]
  const candidates: Vector3[] = [...fallbackCandidates]

  for (let ring = 6; ring <= 18; ring += 3) {
    const steps = Math.max(10, Math.round(ring * 1.8))

    for (let index = 0; index < steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2

      candidates.push(
        new Vector3(
          clampToBoard(center.x + Math.cos(angle) * ring),
          eyeHeight,
          clampToBoard(center.z + Math.sin(angle) * ring),
        ),
      )
    }
  }

  const safeCandidates = candidates
    .filter(
      (candidate) =>
        !isBlockedPosition(
          candidate,
          colliders,
          minimumSpawnClearance,
        ),
    )
    .map((candidate) => {
      const clearance = getNearestClearance(candidate, colliders)
      const density = getLocalDensity(candidate, colliders)
      const distanceToCenter = candidate.distanceTo(center)
      const riverbankBonus =
        terrainMode === 'Riverbank' && candidate.x < 8 && candidate.z > -18
          ? 3
          : 0

      return {
        candidate,
        score:
          clearance * 3 -
          density * 2 -
          Math.abs(distanceToCenter - 10) * 0.45 +
          riverbankBonus,
      }
    })
    .sort((a, b) => b.score - a.score)

  return safeCandidates[0]?.candidate ?? fallbackCandidates[0]
}

function playFootstepSound(
  terrainMode: ReturnType<typeof useSceneStore.getState>['terrainMode'],
  isMuted: boolean,
) {
  if (isMuted || typeof window === 'undefined') return

  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  if (!AudioContextClass) return

  const audioContext = new AudioContextClass()
  const gain = audioContext.createGain()
  const now = audioContext.currentTime

  gain.gain.setValueAtTime(0.0001, now)
  gain.connect(audioContext.destination)

  if (terrainMode === 'Village Road' || terrainMode === 'Courtyard') {
    gain.gain.exponentialRampToValueAtTime(0.032, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)
    const osc = audioContext.createOscillator()
    const filter = audioContext.createBiquadFilter()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(190, now)
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.09)
    filter.type = 'bandpass'
    filter.frequency.value = 320
    filter.Q.value = 0.9
    osc.connect(filter)
    filter.connect(gain)
    osc.start(now)
    osc.stop(now + 0.14)
  } else if (terrainMode === 'Riverbank') {
    gain.gain.exponentialRampToValueAtTime(0.026, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    const buf = audioContext.createBuffer(
      1,
      Math.floor(audioContext.sampleRate * 0.2),
      audioContext.sampleRate,
    )
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    const src = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 860
    filter.Q.value = 0.65
    src.buffer = buf
    src.connect(filter)
    filter.connect(gain)
    src.start(now)
    src.stop(now + 0.22)
  } else {
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    const buf = audioContext.createBuffer(
      1,
      Math.floor(audioContext.sampleRate * 0.16),
      audioContext.sampleRate,
    )
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.75
    }
    const src = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 360
    src.buffer = buf
    src.connect(filter)
    filter.connect(gain)
    src.start(now)
    src.stop(now + 0.18)
  }

  window.setTimeout(() => {
    gain.disconnect()
    void audioContext.close()
  }, 320)
}

function createWalkMemoryTriggers(
  sceneCenter: Vector3,
  colliders: Collider[],
) {
  const center = new Vector3(
    clampToBoard(sceneCenter.x),
    eyeHeight,
    clampToBoard(sceneCenter.z),
  )
  const triggers: WalkMemoryTrigger[] = []

  for (let index = 0; index < walkMemoryMessages.length; index += 1) {
    const message = walkMemoryMessages[index]
    let placed = false

    for (let attempt = 0; attempt < 18 && !placed; attempt += 1) {
      const angle =
        (index / walkMemoryMessages.length) * Math.PI * 2 +
        (Math.random() - 0.5) * 0.85
      const distance = 4 + Math.random() * 11
      const candidate = new Vector3(
        clampToBoard(center.x + Math.cos(angle) * distance),
        eyeHeight,
        clampToBoard(center.z + Math.sin(angle) * distance),
      )

      if (!isBlockedPosition(candidate, colliders, 0.9)) {
        triggers.push({
          ...message,
          position: candidate,
          used: false,
        })
        placed = true
      }
    }
  }

  return triggers
}

export function MemoryWalkCamera({ controlsRef }: MemoryWalkCameraProps) {
  const { camera, gl } = useThree()
  const perspectiveCameraRef = useRef<ThreePerspectiveCamera>(null)
  const [phase, setPhase] = useState<WalkPhase>('idle')
  const phaseRef = useRef<WalkPhase>('idle')
  const transitionElapsed = useRef(0)
  const yawRef = useRef(0)
  const pitchRef = useRef(0)
  const draggingRef = useRef(false)
  const pressedKeysRef = useRef(new Set<string>())
  const buildPosition = useMemo(() => new Vector3(), [])
  const buildTarget = useMemo(() => new Vector3(), [])
  const transitionStart = useMemo(() => new Vector3(), [])
  const transitionEnd = useMemo(() => new Vector3(), [])
  const lookTarget = useMemo(() => new Vector3(), [])
  const sceneCenterRef = useRef(new Vector3())
  const walkTimeRef = useRef(0)
  const walkMemoryTriggersRef = useRef<WalkMemoryTrigger[]>([])
  const memoryCooldownRef = useRef(0)
  const memoryCloseTimerRef = useRef<number | null>(null)
  const lastStepRef = useRef(-1)
  const swayRef = useRef(0)
  const holdRef = useRef(0)
  const poseClockRef = useRef(0)
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const terrainMode = useSceneStore((state) => state.terrainMode)
  const isMuted = useSceneStore((state) => state.isMuted)
  const gameMode = useSceneStore((state) => state.gameMode)
  const winGame = useSceneStore((state) => state.winGame)
  const gameTasks = useSceneStore((state) => state.gameTasks)
  const completeTask = useSceneStore((state) => state.completeTask)
  const setGamePrompt = useSceneStore((state) => state.setGamePrompt)
  const setWalkPose = useSceneStore((state) => state.setWalkPose)
  const sceneObjects = useSceneStore((state) => state.sceneObjects)
  const activeMemoryPoint = useSceneStore((state) => state.activeMemoryPoint)
  const openMemoryPoint = useSceneStore((state) => state.openMemoryPoint)
  const closeMemoryPoint = useSceneStore((state) => state.closeMemoryPoint)
  const setCameraMode = useSceneStore((state) => state.setCameraMode)
  const setCameraTransitioning = useSceneStore(
    (state) => state.setCameraTransitioning,
  )
  const colliders = useMemo(() => createObjectColliders(sceneObjects), [
    sceneObjects,
  ])
  const bridgeCorridors = useMemo(
    () => getBridgeCorridors(sceneObjects),
    [sceneObjects],
  )
  const gameTargets = useMemo(() => {
    const wood = sceneObjects.find((o) => o.assetId.startsWith('woodpile'))
    const bridge = sceneObjects.find((o) => o.assetId.startsWith('bridge'))
    const lighthouse = sceneObjects.find((o) => {
      const asset = assets.find((item) => item.id === o.assetId)
      return asset?.kind === 'lighthouse'
    })

    let bridgeRepair: Vector3 | null = null
    if (bridge) {
      const angle = bridge.rotation[1]
      const halfLength = (4.6 / 2) * bridge.scale[0] + 0.5
      // West end of the bridge, on the near bank (local -X projected to world)
      bridgeRepair = new Vector3(
        bridge.position[0] - Math.cos(angle) * halfLength,
        0,
        bridge.position[2] + Math.sin(angle) * halfLength,
      )
    }

    return {
      wood: wood
        ? new Vector3(wood.position[0], 0, wood.position[2])
        : null,
      bridgeRepair,
      lighthouse: lighthouse
        ? new Vector3(lighthouse.position[0], 0, lighthouse.position[2])
        : null,
    }
  }, [sceneObjects])
  const isActive = phase !== 'idle'

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(
    () => () => {
      if (memoryCloseTimerRef.current !== null) {
        window.clearTimeout(memoryCloseTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'walking') {
        return
      }

      if (
        [
          'Escape',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
        ].includes(event.code)
      ) {
        event.preventDefault()
      }

      if (event.code === 'Escape') {
        setCameraMode('build')
        return
      }

      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyE',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
        ].includes(event.code)
      ) {
        pressedKeysRef.current.add(event.code)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.code)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setCameraMode])

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointerDown = (event: PointerEvent) => {
      if (phaseRef.current !== 'walking') {
        return
      }

      draggingRef.current = true
      canvas.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current || phaseRef.current !== 'walking') {
        return
      }

      yawRef.current -= event.movementX * lookSensitivity
      pitchRef.current = MathUtils.clamp(
        pitchRef.current - event.movementY * lookSensitivity,
        -0.82,
        0.72,
      )
    }

    const handlePointerUp = (event: PointerEvent) => {
      draggingRef.current = false

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [gl.domElement])

  useEffect(() => {
    const perspectiveCamera = perspectiveCameraRef.current

    if (!perspectiveCamera) {
      return
    }

    if (cameraMode === 'walk' && phaseRef.current === 'idle') {
      const sceneCenter = computeSceneCenter(sceneObjects)
      const startPosition = chooseSafeSpawnPoint(
        sceneCenter,
        colliders,
        terrainMode,
      )
      const lookDestination = new Vector3(
        clampToBoard(sceneCenter.x),
        eyeHeight,
        clampToBoard(sceneCenter.z),
      )

      sceneCenterRef.current.copy(sceneCenter)
      walkMemoryTriggersRef.current = createWalkMemoryTriggers(
        sceneCenter,
        colliders,
      )
      memoryCooldownRef.current = 0
      buildPosition.copy(camera.position)
      buildTarget.copy(controlsRef.current?.target ?? sceneCenter)
      transitionElapsed.current = 0
      transitionStart.copy(buildPosition)
      transitionEnd.copy(startPosition)
      lookTarget.copy(buildTarget)
      yawRef.current = Math.atan2(
        lookDestination.x - startPosition.x,
        lookDestination.z - startPosition.z,
      )
      pitchRef.current = -0.04
      pressedKeysRef.current.clear()

      perspectiveCamera.position.copy(buildPosition)
      perspectiveCamera.lookAt(buildTarget)
      setCameraTransitioning(true)
      setPhase('entering')
    }

    if (cameraMode === 'build' && phaseRef.current !== 'idle') {
      transitionElapsed.current = 0
      transitionStart.copy(perspectiveCamera.position)
      transitionEnd.copy(buildPosition)
      pressedKeysRef.current.clear()
      walkMemoryTriggersRef.current = []
      closeMemoryPoint()
      setCameraTransitioning(true)
      setPhase('exiting')
    }
  }, [
    buildPosition,
    buildTarget,
    camera,
    cameraMode,
    colliders,
    controlsRef,
    closeMemoryPoint,
    sceneObjects,
    setCameraTransitioning,
    terrainMode,
    lookTarget,
    transitionEnd,
    transitionStart,
  ])

  // During the storm game the bridge is impassable until repaired.
  const bridgesPassable = gameMode !== 'playing' || gameTasks.repairBridge
  const activeBridges = bridgesPassable ? bridgeCorridors : []

  const canMoveTo = (nextPosition: Vector3) => {
    if (
      isBlockedPosition(
        nextPosition,
        colliders,
        playerRadius,
        activeBridges,
      )
    ) {
      return false
    }

    return true
  }

  useFrame(({ clock }, delta) => {
    const perspectiveCamera = perspectiveCameraRef.current

    if (!perspectiveCamera || phaseRef.current === 'idle') {
      return
    }

    if (phaseRef.current === 'entering' || phaseRef.current === 'exiting') {
      transitionElapsed.current += delta
      const amount = smoothstep(
        Math.min(transitionElapsed.current / transitionDuration, 1),
      )

      perspectiveCamera.position.lerpVectors(
        transitionStart,
        transitionEnd,
        amount,
      )

      if (phaseRef.current === 'entering') {
        lookTarget.lerp(sceneCenterRef.current, 0.05)
        perspectiveCamera.lookAt(lookTarget.x, eyeHeight, lookTarget.z)

        if (amount >= 1) {
          setCameraTransitioning(false)
          setPhase('walking')
        }
      } else {
        lookTarget.lerp(buildTarget, 0.06)
        perspectiveCamera.lookAt(lookTarget)

        if (amount >= 1) {
          controlsRef.current?.target.copy(buildTarget)
          controlsRef.current?.update()
          setCameraTransitioning(false)
          setPhase('idle')
        }
      }

      return
    }

    const keys = pressedKeysRef.current
    const moveX =
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
    const moveZ =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
    const forward = new Vector3(Math.sin(yawRef.current), 0, Math.cos(yawRef.current))
    const right = new Vector3(forward.z, 0, -forward.x)
    const movement = new Vector3()

    movement.addScaledVector(forward, moveZ)
    movement.addScaledVector(right, moveX)

    if (movement.lengthSq() > 0) {
      movement.normalize().multiplyScalar(walkSpeed * delta)

      const nextX = perspectiveCamera.position.clone()
      nextX.x = clampToBoard(nextX.x + movement.x)

      if (canMoveTo(nextX)) {
        perspectiveCamera.position.x = nextX.x
      }

      const nextZ = perspectiveCamera.position.clone()
      nextZ.z = clampToBoard(nextZ.z + movement.z)

      if (canMoveTo(nextZ)) {
        perspectiveCamera.position.z = nextZ.z
      }
    }

    const hasInput = moveX !== 0 || moveZ !== 0
    if (hasInput) {
      walkTimeRef.current += delta * 5.2
      const currentStep = Math.floor(walkTimeRef.current / Math.PI)
      if (currentStep !== lastStepRef.current) {
        lastStepRef.current = currentStep
        playFootstepSound(terrainMode, isMuted)
      }
    }
    const bobY = hasInput
      ? Math.sin(walkTimeRef.current) * 0.082
      : Math.sin(clock.elapsedTime * 0.65) * 0.009
    const targetSwayX = hasInput
      ? Math.sin(walkTimeRef.current * 0.5) * 0.028
      : 0
    swayRef.current += (targetSwayX - swayRef.current) * 0.18

    perspectiveCamera.position.y = eyeHeight + bobY

    if (gameMode === 'playing') {
      const camPos = perspectiveCamera.position
      const holdNeeded = 1.2
      const range = 3.4

      // Pick the current objective: firewood → bridge → lighthouse
      let target: Vector3 | null = null
      let label: string | null = null
      let taskKey: 'collectWood' | 'repairBridge' | null = null
      let isFinal = false

      if (!gameTasks.collectWood && gameTargets.wood) {
        target = gameTargets.wood
        label = 'Hold E to collect firewood'
        taskKey = 'collectWood'
      } else if (!gameTasks.repairBridge && gameTargets.bridgeRepair) {
        target = gameTargets.bridgeRepair
        label = 'Hold E to repair the bridge'
        taskKey = 'repairBridge'
      } else if (gameTargets.lighthouse) {
        target = gameTargets.lighthouse
        isFinal = true
      }

      if (target) {
        const dist = Math.hypot(target.x - camPos.x, target.z - camPos.z)

        if (dist < range) {
          if (isFinal) {
            winGame()
          } else if (pressedKeysRef.current.has('KeyE')) {
            holdRef.current += delta
            setGamePrompt(label, Math.min(holdRef.current / holdNeeded, 1))
            if (holdRef.current >= holdNeeded && taskKey) {
              holdRef.current = 0
              if (taskKey === 'collectWood') {
                playWoodCollected(isMuted)
              } else {
                playBridgeRepaired(isMuted)
              }
              completeTask(taskKey)
            }
          } else {
            holdRef.current = 0
            setGamePrompt(label, 0)
          }
        } else {
          holdRef.current = 0
          setGamePrompt(null, 0)
        }
      } else {
        setGamePrompt(null, 0)
      }
    }

    if (memoryCooldownRef.current > 0) {
      memoryCooldownRef.current -= delta
    }

    if (!activeMemoryPoint && memoryCooldownRef.current <= 0 && gameMode === 'sandbox') {
      const trigger = walkMemoryTriggersRef.current.find(
        (item) =>
          !item.used &&
          Math.hypot(
            item.position.x - perspectiveCamera.position.x,
            item.position.z - perspectiveCamera.position.z,
          ) < 2.35,
      )

      if (trigger) {
        trigger.used = true
        memoryCooldownRef.current = 10
        openMemoryPoint({
          title: trigger.title,
          text: trigger.text,
          sound: trigger.sound,
        })

        if (memoryCloseTimerRef.current !== null) {
          window.clearTimeout(memoryCloseTimerRef.current)
        }

        memoryCloseTimerRef.current = window.setTimeout(() => {
          closeMemoryPoint()
          memoryCloseTimerRef.current = null
        }, 4600)
      }
    }

    const lookDirection = new Vector3(
      Math.sin(yawRef.current) * Math.cos(pitchRef.current),
      Math.sin(pitchRef.current),
      Math.cos(yawRef.current) * Math.cos(pitchRef.current),
    )
    perspectiveCamera.lookAt(
      perspectiveCamera.position.x + lookDirection.x + swayRef.current,
      perspectiveCamera.position.y + lookDirection.y,
      perspectiveCamera.position.z + lookDirection.z,
    )

    // Publish player pose for the minimap (~12x/sec to avoid over-rendering)
    poseClockRef.current += delta
    if (poseClockRef.current >= 0.08) {
      poseClockRef.current = 0
      setWalkPose({
        x: perspectiveCamera.position.x,
        z: perspectiveCamera.position.z,
        yaw: yawRef.current,
      })
    }
  })

  return (
    <PerspectiveCamera
      ref={perspectiveCameraRef}
      makeDefault={isActive}
      fov={58}
      near={0.1}
      far={300}
    />
  )
}
