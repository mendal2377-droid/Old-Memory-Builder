import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { assets } from '../../data/assets'
import { memoryKits } from '../../data/memoryKits'
import { AtmosphereEffects } from './AtmosphereEffects'
import { GameHud } from '../game/GameHud'
import { Minimap } from '../game/Minimap'
import { GroundPlane } from './GroundPlane'
import { MemoryCompanions } from './MemoryCompanions'
import { AssetModel, MemoryObject } from './MemoryObject'
import { MemoryWalkCamera } from './MemoryWalkCamera'
import { SceneCaptureBridge } from './SceneCaptureBridge'
import { useSceneStore } from '../../store/sceneStore'
import type { AtmospherePreset } from '../../types/scene'

const isometricCameraPosition: [number, number, number] = [28, 28, 28]

const atmospherePresets: AtmospherePreset[] = [
  'Clear Morning',
  'Sunset',
  'Rainy Day',
  'Heavy Rain',
  'Snowy Day',
  'Summer Night',
]
const gridSize = 0.5

function snapToGrid(value: number) {
  return Math.round(value / gridSize) * gridSize
}

function playMemoryPointSound(
  sound: 'birds' | 'water' | 'wind' | 'soft',
  isMuted: boolean,
) {
  if (isMuted || typeof window === 'undefined') {
    return
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & {
      webkitAudioContext?: typeof AudioContext
    }).webkitAudioContext

  if (!AudioContextClass) {
    return
  }

  const audioContext = new AudioContextClass()
  const gain = audioContext.createGain()
  const now = audioContext.currentTime

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
  gain.connect(audioContext.destination)

  if (sound === 'birds') {
    ;[920, 1260, 1480].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.12)
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 1.16,
        now + index * 0.12 + 0.12,
      )
      oscillator.connect(gain)
      oscillator.start(now + index * 0.12)
      oscillator.stop(now + index * 0.12 + 0.18)
    })
  } else {
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * 1.2,
      audioContext.sampleRate,
    )
    const output = buffer.getChannelData(0)
    const source = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()

    for (let index = 0; index < output.length; index += 1) {
      const fade = 1 - index / output.length
      output[index] = (Math.random() * 2 - 1) * fade * 0.25
    }

    filter.type = sound === 'water' ? 'bandpass' : 'lowpass'
    filter.frequency.value =
      sound === 'water' ? 760 : sound === 'wind' ? 420 : 520
    source.buffer = buffer
    source.connect(filter)
    filter.connect(gain)
    source.start(now)
    source.stop(now + 1.2)
  }

  window.setTimeout(() => {
    gain.disconnect()
    void audioContext.close()
  }, 1400)
}

export function SceneCanvas() {
  const sceneObjects = useSceneStore((state) => state.sceneObjects)
  const terrainMode = useSceneStore((state) => state.terrainMode)
  const atmospherePreset = useSceneStore((state) => state.atmospherePreset)
  const isGridVisible = useSceneStore((state) => state.isGridVisible)
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const isCameraTransitioning = useSceneStore(
    (state) => state.isCameraTransitioning,
  )
  const placementAssetId = useSceneStore((state) => state.placementAssetId)
  const placementKitId = useSceneStore((state) => state.placementKitId)
  const placeObject = useSceneStore((state) => state.placeObject)
  const placeKit = useSceneStore((state) => state.placeKit)
  const cancelPlacement = useSceneStore((state) => state.cancelPlacement)
  const activeMemoryPoint = useSceneStore((state) => state.activeMemoryPoint)
  const closeMemoryPoint = useSceneStore((state) => state.closeMemoryPoint)
  const setCameraMode = useSceneStore((state) => state.setCameraMode)
  const setAtmospherePreset = useSceneStore((state) => state.setAtmospherePreset)
  const isMuted = useSceneStore((state) => state.isMuted)
  const toggleMute = useSceneStore((state) => state.toggleMute)
  const gameMode = useSceneStore((state) => state.gameMode)

  const cycleAtmosphere = (direction: 1 | -1) => {
    const idx = atmospherePresets.indexOf(atmospherePreset)
    setAtmospherePreset(
      atmospherePresets[
        (idx + direction + atmospherePresets.length) % atmospherePresets.length
      ],
    )
  }
  const [previewPosition, setPreviewPosition] = useState<
    [number, number, number] | null
  >(null)
  const placementAsset = assets.find((asset) => asset.id === placementAssetId)
  const placementKit = memoryKits.find((kit) => kit.id === placementKitId)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const isWalkCameraActive = cameraMode === 'walk' || isCameraTransitioning

  useEffect(() => {
    if (activeMemoryPoint) {
      playMemoryPointSound(activeMemoryPoint.sound, isMuted)
    }
  }, [activeMemoryPoint, isMuted])

  useEffect(() => {
    if (!placementAssetId && !placementKitId) {
      setPreviewPosition(null)
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelPlacement()
        setPreviewPosition(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelPlacement, placementAssetId, placementKitId])

  const getGroundPosition = (event: ThreeEvent<PointerEvent>) => {
    return [
      snapToGrid(event.point.x),
      0,
      snapToGrid(event.point.z),
    ] as [number, number, number]
  }

  const handleGroundPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!placementAssetId && !placementKitId) {
      return
    }

    setPreviewPosition(getGroundPosition(event))
  }

  const handleGroundClick = (event: ThreeEvent<MouseEvent>) => {
    if (!placementAssetId && !placementKitId) {
      return
    }

    event.stopPropagation()
    const position = [
      snapToGrid(event.point.x),
      0,
      snapToGrid(event.point.z),
    ] as [number, number, number]

    if (placementKitId) {
      placeKit(placementKitId, position)
    } else if (placementAssetId) {
      placeObject(placementAssetId, position)
    }

    setPreviewPosition(null)
  }

  return (
    <div className="scene-canvas-shell">
      <Canvas
        className="scene-canvas"
        gl={{ preserveDrawingBuffer: true }}
        shadows
      >
      <OrthographicCamera
        makeDefault={!isWalkCameraActive}
        position={isometricCameraPosition}
        zoom={24}
        near={0.1}
        far={300}
        onUpdate={(camera) => camera.lookAt(0, 0, 0)}
      />
      <MemoryWalkCamera controlsRef={controlsRef} />
      <SceneCaptureBridge />
      <AtmosphereEffects />
      <MemoryCompanions />
      <GroundPlane
        terrainMode={terrainMode}
        cameraMode={cameraMode}
        isGridVisible={isGridVisible}
        onGroundClick={handleGroundClick}
        onGroundPointerMove={handleGroundPointerMove}
      />
      {sceneObjects.map((object) => (
        <MemoryObject key={object.id} object={object} />
      ))}
      {placementAsset && previewPosition ? (
        <group
          position={previewPosition}
          rotation={placementAsset.defaultRotation}
          scale={placementAsset.defaultScale}
        >
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.58, 0.78, 36]} />
            <meshBasicMaterial color="#5f8fd7" transparent opacity={0.38} />
          </mesh>
          <AssetModel asset={placementAsset} opacity={0.45} />
        </group>
      ) : null}
      {placementKit && previewPosition ? (
        <group position={previewPosition}>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.65, 1.9, 40]} />
            <meshBasicMaterial color="#9b7bd8" transparent opacity={0.34} />
          </mesh>
          {placementKit.objects.map((kitObject, index) => {
            const asset = assets.find((item) => item.id === kitObject.assetId)

            if (!asset) {
              return null
            }

            return (
              <group
                key={`${kitObject.assetId}-${index}`}
                position={kitObject.position}
                rotation={kitObject.rotation}
                scale={kitObject.scale}
              >
                <AssetModel asset={asset} opacity={0.42} />
              </group>
            )
          })}
        </group>
      ) : null}
      <OrbitControls
        ref={controlsRef}
        enabled={!isWalkCameraActive}
        enablePan
        enableRotate={false}
        enableZoom
        minZoom={12}
        maxZoom={95}
        target={[0, 0, 0]}
      />
      </Canvas>
      {(cameraMode === 'walk' || isCameraTransitioning) ? (
        <div className="walk-vignette" aria-hidden="true" />
      ) : null}
      {cameraMode === 'walk' ? (
        <button
          type="button"
          className="walk-exit-btn"
          onClick={() => setCameraMode('build')}
        >
          Exit Walk
        </button>
      ) : null}
      {cameraMode === 'walk' ? (
        <div className="walk-mode-hint" aria-live="polite">
          <span>WASD / Arrow Keys: Move</span>
          <span>Drag Mouse: Look Around</span>
        </div>
      ) : null}
      {cameraMode === 'walk' && gameMode === 'sandbox' ? (
        <div className="walk-atmosphere-hud" aria-label="Walk mode controls">
          <button
            type="button"
            className="walk-hud-btn"
            onClick={() => cycleAtmosphere(-1)}
            aria-label="Previous atmosphere"
          >
            ‹
          </button>
          <span className="walk-hud-label">{atmospherePreset}</span>
          <button
            type="button"
            className="walk-hud-btn"
            onClick={() => cycleAtmosphere(1)}
            aria-label="Next atmosphere"
          >
            ›
          </button>
          <div className="walk-hud-sep" aria-hidden="true" />
          <button
            type="button"
            className="walk-hud-btn"
            onClick={toggleMute}
          >
            {isMuted ? 'Muted' : 'Sound On'}
          </button>
        </div>
      ) : null}
      <GameHud />
      <Minimap />
      {activeMemoryPoint ? (
        <aside className="memory-point-popup" aria-live="polite">
          <button
            type="button"
            className="memory-point-close"
            onClick={closeMemoryPoint}
            aria-label="Close memory point"
          >
            x
          </button>
          <span className="memory-point-kicker">Memory Point</span>
          <h3>{activeMemoryPoint.title}</h3>
          <p>{activeMemoryPoint.text}</p>
        </aside>
      ) : null}
    </div>
  )
}
