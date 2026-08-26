import { useEffect, useRef, useState } from 'react'
import {
  weatherKinds,
  weatherLabels,
  worldLabels,
  worldStyles,
  type WeatherKind,
  type WorldStyle,
} from '../../data/atmosphere'
import { useSceneStore } from '../../store/sceneStore'
import type { AtmospherePreset, TerrainMode } from '../../types/scene'

const terrainModes: TerrainMode[] = [
  'Riverbank',
  'Village Road',
  'Field Path',
  'Empty Field',
  'Courtyard',
]

const atmospherePresets: AtmospherePreset[] = [
  'Golden Morning',
  'Cosmic Dawn',
  'Clear Morning',
  'Sunset',
  'Rainy Day',
  'Heavy Rain',
  'Snowy Day',
  'Summer Night',
]

function formatClock(hour: number) {
  const h = Math.floor(hour) % 24
  const m = Math.floor((hour - Math.floor(hour)) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function Toolbar() {
  const [message, setMessage] = useState('')
  const [scatterCount, setScatterCount] = useState(15)
  const [scatterRadius, setScatterRadius] = useState(8)
  const [scatterRandomScale, setScatterRandomScale] = useState(true)
  const [scatterRandomRotation, setScatterRandomRotation] = useState(true)
  const importInputRef = useRef<HTMLInputElement>(null)
  const didMountRef = useRef(false)
  const isDirtyRef = useRef(false)
  const sceneObjects = useSceneStore((state) => state.sceneObjects)
  const terrainMode = useSceneStore((state) => state.terrainMode)
  const atmospherePreset = useSceneStore((state) => state.atmospherePreset)
  const isMuted = useSceneStore((state) => state.isMuted)
  const isGridVisible = useSceneStore((state) => state.isGridVisible)
  const areAnimalsWalking = useSceneStore((state) => state.areAnimalsWalking)
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId)
  const screenshotMessage = useSceneStore((state) => state.screenshotMessage)
  const modelLoadWarning = useSceneStore((state) => state.modelLoadWarning)
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const isCameraTransitioning = useSceneStore(
    (state) => state.isCameraTransitioning,
  )
  const moveSelected = useSceneStore((state) => state.moveSelected)
  const rotateSelected = useSceneStore((state) => state.rotateSelected)
  const scaleSelected = useSceneStore((state) => state.scaleSelected)
  const deleteSelected = useSceneStore((state) => state.deleteSelected)
  const duplicateSelected = useSceneStore((state) => state.duplicateSelected)
  const scatterSelected = useSceneStore((state) => state.scatterSelected)
  const cancelLastScatter = useSceneStore((state) => state.cancelLastScatter)
  const undo = useSceneStore((state) => state.undo)
  const undoStack = useSceneStore((state) => state.undoStack)
  const beginBriefing = useSceneStore((state) => state.beginBriefing)
  const timeOfDay = useSceneStore((state) => state.timeOfDay)
  const setTimeOfDay = useSceneStore((state) => state.setTimeOfDay)
  const weather = useSceneStore((state) => state.weather)
  const weatherIntensity = useSceneStore((state) => state.weatherIntensity)
  const setWeather = useSceneStore((state) => state.setWeather)
  const setWeatherIntensity = useSceneStore((state) => state.setWeatherIntensity)
  const worldStyle = useSceneStore((state) => state.worldStyle)
  const setWorldStyle = useSceneStore((state) => state.setWorldStyle)
  const saveScene = useSceneStore((state) => state.saveScene)
  const loadScene = useSceneStore((state) => state.loadScene)
  const autoSaveScene = useSceneStore((state) => state.autoSaveScene)
  const clearSavedScene = useSceneStore((state) => state.clearSavedScene)
  const exportScene = useSceneStore((state) => state.exportScene)
  const importScene = useSceneStore((state) => state.importScene)
  const requestScreenshot = useSceneStore((state) => state.requestScreenshot)
  const setTerrainMode = useSceneStore((state) => state.setTerrainMode)
  const setAtmospherePreset = useSceneStore(
    (state) => state.setAtmospherePreset,
  )
  const toggleMute = useSceneStore((state) => state.toggleMute)
  const toggleGrid = useSceneStore((state) => state.toggleGrid)
  const toggleAnimalsWalking = useSceneStore(
    (state) => state.toggleAnimalsWalking,
  )
  const setCameraMode = useSceneStore((state) => state.setCameraMode)
  const setScreenshotMessage = useSceneStore(
    (state) => state.setScreenshotMessage,
  )
  const isWalkActive = cameraMode === 'walk'
  const hasLighthouse = sceneObjects.some((object) =>
    object.assetId.startsWith('lighthouse'),
  )
  const isEditingDisabled = isWalkActive || isCameraTransitioning
  const hasSelection = selectedObjectId !== null && !isEditingDisabled
  const largeSceneWarning =
    sceneObjects.length > 120 ? 'Large scene: performance may slow down.' : ''
  const status =
    screenshotMessage ||
    modelLoadWarning ||
    largeSceneWarning ||
    message ||
    'V1 diorama workspace'

  const resetScatterSettings = () => {
    setScatterCount(15)
    setScatterRadius(8)
    setScatterRandomScale(true)
    setScatterRandomRotation(true)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !isEditingDisabled) {
        event.preventDefault()
        undo()
        setMessage('Undone.')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, isEditingDisabled])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    isDirtyRef.current = true
  }, [atmospherePreset, isGridVisible, sceneObjects, terrainMode])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!isDirtyRef.current) {
        return
      }

      autoSaveScene()
      isDirtyRef.current = false
      setMessage('Auto-saved')
    }, 8000)

    return () => window.clearInterval(intervalId)
  }, [autoSaveScene])

  const handleExportScene = () => {
    const blob = new Blob([exportScene()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'old-memory-scene.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage('Scene exported')
  }

  const handleImportScene = async (file: File | undefined) => {
    if (!file) {
      return
    }

    const text = await file.text()
    const imported = importScene(text)
    setMessage(imported ? 'Scene loaded' : 'Could not import scene JSON.')

    if (importInputRef.current) {
      importInputRef.current.value = ''
    }
  }

  const handleClearSavedScene = () => {
    if (!window.confirm('Clear the locally saved scene?')) {
      return
    }

    clearSavedScene()
    setMessage('Saved scene cleared.')
  }

  return (
    <header className="toolbar">
      <div className="toolbar-title">
        <h1>Old Memory Builder</h1>
        <p>{status}</p>
      </div>

      <nav className="toolbar-center" aria-label="World controls">
        <label className="toolbar-select">
          <span>Terrain</span>
          <select
            value={terrainMode}
            onChange={(event) => {
              setScreenshotMessage('')
              setTerrainMode(event.target.value as TerrainMode)
              setMessage(`${event.target.value} selected.`)
            }}
          >
            {terrainModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>

        <label className="toolbar-select">
          <span>World</span>
          <select
            value={worldStyle}
            title="The setting the diorama sits in."
            onChange={(event) => {
              setWorldStyle(event.target.value as WorldStyle)
              setMessage(`${worldLabels[event.target.value as WorldStyle]}.`)
            }}
          >
            {worldStyles.map((world) => (
              <option key={world} value={world}>
                {worldLabels[world]}
              </option>
            ))}
          </select>
        </label>

        <details className="scene-menu sky-menu">
          <summary title="Time of day, weather, and named presets.">
            <span className="sky-summary-clock">{formatClock(timeOfDay)}</span>
            <span className="sky-summary-sep" aria-hidden="true" />
            <span>{weatherLabels[weather]}</span>
            <span className="sky-summary-caret" aria-hidden="true">▾</span>
          </summary>
          <div className="scene-menu-content sky-menu-content">
            <label className="sky-field">
              <span>Preset</span>
              <select
                value={atmospherePreset}
                onChange={(event) => {
                  setScreenshotMessage('')
                  setAtmospherePreset(event.target.value as AtmospherePreset)
                  setMessage(`${event.target.value} selected.`)
                }}
              >
                {atmospherePresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </label>

            <div className="scene-menu-divider" role="separator" />

            <label className="sky-field is-slider">
              <span>Time of day</span>
              <strong>{formatClock(timeOfDay)}</strong>
              <input
                type="range"
                min="0"
                max="24"
                step="0.1"
                value={timeOfDay}
                onChange={(event) => setTimeOfDay(Number(event.target.value))}
              />
            </label>

            <label className="sky-field">
              <span>Weather</span>
              <select
                value={weather}
                onChange={(event) => {
                  setWeather(event.target.value as WeatherKind)
                  setMessage(
                    `${weatherLabels[event.target.value as WeatherKind]} weather.`,
                  )
                }}
              >
                {weatherKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {weatherLabels[kind]}
                  </option>
                ))}
              </select>
            </label>

            {weather !== 'clear' ? (
              <label className="sky-field is-slider">
                <span>Intensity</span>
                <strong>{Math.round(weatherIntensity * 100)}%</strong>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={weatherIntensity}
                  onChange={(event) =>
                    setWeatherIntensity(Number(event.target.value))
                  }
                />
              </label>
            ) : null}
          </div>
        </details>
        <button
          type="button"
          className={isWalkActive ? undefined : 'btn-primary'}
          onClick={() => {
            setCameraMode(isWalkActive ? 'build' : 'walk')
            setMessage(
              isWalkActive
                ? 'Returning to build mode.'
                : 'Entering Memory Walk.',
            )
          }}
        >
          {isWalkActive ? 'Exit Walk' : 'Memory Walk'}
        </button>
        <button
          type="button"
          disabled={isWalkActive || !hasLighthouse}
          title={
            hasLighthouse
              ? 'Race back to the lighthouse before the storm hits.'
              : 'Place a Lighthouse in the scene to play.'
          }
          onClick={() => {
            beginBriefing()
            setMessage('Storm Game briefing.')
          }}
        >
          Storm Game
        </button>
      </nav>

      <nav className="toolbar-right" aria-label="Scene actions">
        <button
          type="button"
          title="Download a PNG image of the current 3D canvas."
          onClick={() => {
            setMessage('Preparing photo...')
            requestScreenshot()
          }}
        >
          Take Photo
        </button>
        <details className="scene-menu">
          <summary title="Scene save, load, and other options.">
            Scene ▾
          </summary>
          <div className="scene-menu-content">
            <button
              type="button"
              onClick={() => {
                setScreenshotMessage('')
                saveScene()
                setMessage('Scene saved locally')
              }}
            >
              Save Scene
            </button>
            <button
              type="button"
              onClick={() => {
                setScreenshotMessage('')
                setMessage(loadScene() ? 'Scene loaded' : 'No saved scene found.')
              }}
            >
              Load Scene
            </button>
            <div className="scene-menu-divider" role="separator" />
            <button
              type="button"
              onClick={() => {
                toggleGrid()
                setMessage(isGridVisible ? 'Grid hidden.' : 'Grid visible.')
              }}
            >
              {isGridVisible ? 'Hide Grid' : 'Show Grid'}
            </button>
            <button
              type="button"
              onClick={() => {
                toggleMute()
                setMessage(isMuted ? 'Atmosphere sound on.' : 'Atmosphere muted.')
              }}
            >
              {isMuted ? 'Sound On' : 'Mute Sound'}
            </button>
            <button
              type="button"
              onClick={() => {
                toggleAnimalsWalking()
                setMessage(
                  areAnimalsWalking
                    ? 'Animals stopped.'
                    : 'Animals wandering calmly.',
                )
              }}
            >
              {areAnimalsWalking ? 'Stop Animals' : 'Animals Walk'}
            </button>
            <div className="scene-menu-divider" role="separator" />
            <button
              type="button"
              title="Download the current scene as a JSON file."
              onClick={handleExportScene}
            >
              Export Scene
            </button>
            <button
              type="button"
              title="Import a scene JSON file from disk."
              onClick={() => importInputRef.current?.click()}
            >
              Import Scene
            </button>
            <div className="scene-menu-divider" role="separator" />
            <button
              type="button"
              title="Clear only the scene saved in this browser."
              onClick={handleClearSavedScene}
            >
              Clear Saved Scene
            </button>
          </div>
        </details>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="scene-import-input"
          onChange={(event) => {
            void handleImportScene(event.target.files?.[0])
          }}
        />
      </nav>

      <div className="toolbar-panels">
        <details className="toolbar-panel">
          <summary>Edit Selected</summary>
          <div className="toolbar-panel-content">
            <button
              type="button"
              disabled={undoStack.length === 0 || isEditingDisabled}
              onClick={() => {
                undo()
                setMessage('Undone.')
              }}
            >
              Undo (Ctrl+Z)
            </button>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => moveSelected(0, -1)}
            >
              Move Up
            </button>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => moveSelected(0, 1)}
            >
              Move Down
            </button>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => moveSelected(-1, 0)}
            >
              Move Left
            </button>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => moveSelected(1, 0)}
            >
              Move Right
            </button>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={rotateSelected}
            >
              Rotate 90 deg
            </button>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => scaleSelected(1.1)}
            >
              Scale Up
            </button>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => scaleSelected(0.9)}
            >
              Scale Down
            </button>
            <button type="button" disabled={!hasSelection} onClick={deleteSelected}>
              Delete
            </button>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => {
                duplicateSelected()
                setMessage('Object duplicated.')
              }}
            >
              Duplicate
            </button>
          </div>
        </details>

        <details className="toolbar-panel">
          <summary>Scatter Tools</summary>
          <div className="toolbar-panel-content">
            <label className="toolbar-number">
              <span>Count</span>
              <input
                type="number"
                min="1"
                max="80"
                value={scatterCount}
                onChange={(event) => setScatterCount(Number(event.target.value))}
              />
            </label>
            <label className="toolbar-number">
              <span>Radius</span>
              <input
                type="number"
                min="0.5"
                max="23"
                step="0.5"
                value={scatterRadius}
                onChange={(event) => setScatterRadius(Number(event.target.value))}
              />
            </label>
            <label className="toolbar-check">
              <input
                type="checkbox"
                checked={scatterRandomScale}
                onChange={(event) => setScatterRandomScale(event.target.checked)}
              />
              <span>Random scale</span>
            </label>
            <label className="toolbar-check">
              <input
                type="checkbox"
                checked={scatterRandomRotation}
                onChange={(event) =>
                  setScatterRandomRotation(event.target.checked)
                }
              />
              <span>Random rotation</span>
            </label>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => {
                scatterSelected({
                  count: scatterCount,
                  radius: scatterRadius,
                  randomScale: scatterRandomScale,
                  randomRotation: scatterRandomRotation,
                })
                setMessage(`Scattered ${scatterCount} copies.`)
              }}
            >
              Scatter
            </button>
            <button
              type="button"
              onClick={() => {
                cancelLastScatter()
                resetScatterSettings()
                setMessage('Scatter cancelled.')
              }}
            >
              Cancel Scatter
            </button>
          </div>
        </details>
      </div>
    </header>
  )
}
