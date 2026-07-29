import { useEffect, useRef, useState } from 'react'
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
  'Clear Morning',
  'Sunset',
  'Rainy Day',
  'Heavy Rain',
  'Snowy Day',
  'Summer Night',
]

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
        <img
          className="toolbar-brand-icon"
          src="/old-memory-builder-icon.png"
          alt=""
          aria-hidden="true"
        />
        <div>
          <h1>Old Memory Builder</h1>
          <p>{status}</p>
        </div>
      </div>

      <nav className="toolbar-center" aria-label="Build and experience controls">
        <div className="experience-actions" aria-label="Key experiences">
          <span className="experience-label">
            <b>3</b>
            <span>Explore your story</span>
          </span>
          <button
            type="button"
            className={`experience-button experience-button-walk${isWalkActive ? ' is-active' : ''}`}
            aria-pressed={isWalkActive}
            onClick={() => {
              setCameraMode(isWalkActive ? 'build' : 'walk')
              setMessage(
                isWalkActive
                  ? 'Returning to build mode.'
                  : 'Entering Memory Walk.',
              )
            }}
          >
            <strong>{isWalkActive ? 'Exit Walk' : 'Memory Walk'}</strong>
            <span>{isWalkActive ? 'Return to build' : 'Walk through your scene'}</span>
          </button>
          <button
            type="button"
            className="experience-button experience-button-storm"
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
            <strong>Storm Game</strong>
            <span>{hasLighthouse ? 'Race the weather' : 'Place a lighthouse first'}</span>
          </button>
        </div>

        <details className="world-menu">
          <summary title="Step 1: choose the terrain and weather for your scene.">
            <span>1. Choose world</span>
            <small>{terrainMode} · {atmospherePreset}</small>
          </summary>
          <div className="world-menu-content">
            <div className="world-menu-intro">
              <strong>Set the place and mood</strong>
              <span>Choose terrain and weather before adding memories.</span>
            </div>
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
              <span>Weather</span>
              <select
                value={atmospherePreset}
                onChange={(event) => {
                  setScreenshotMessage('')
                  setAtmospherePreset(event.target.value as AtmospherePreset)
                  setMessage(`${event.target.value} atmosphere selected.`)
                }}
              >
                {atmospherePresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                toggleMute()
                setMessage(isMuted ? 'Atmosphere sound on.' : 'Atmosphere muted.')
              }}
            >
              {isMuted ? 'Unmute sound' : 'Mute sound'}
            </button>
          </div>
        </details>
      </nav>

      <nav className="toolbar-right" aria-label="Scene actions">
        <details className="scene-menu">
          <summary
            aria-label="More options"
            title="Less frequently used scene and build actions."
          >
            Scene ▾
          </summary>
          <div className="scene-menu-content">
            <button
              type="button"
              className="scene-menu-photo"
              title="Download a PNG image of the current 3D canvas."
              onClick={() => {
                setMessage('Preparing photo...')
                requestScreenshot()
              }}
            >
              Take Photo
            </button>
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

      <details className="toolbar-panels toolbar-tools-menu">
        <summary>Build tools</summary>
        <div className="toolbar-tools-content">
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
      </details>
    </header>
  )
}
