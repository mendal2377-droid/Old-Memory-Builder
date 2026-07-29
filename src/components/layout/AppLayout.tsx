import { useState } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { AssetSidebar } from '../assets/AssetSidebar'
import { SceneCanvas } from '../scene/SceneCanvas'
import { Toolbar } from '../toolbar/Toolbar'

export function AppLayout() {
  const [isFirstSceneGuideOpen, setFirstSceneGuideOpen] = useState(
    () => sessionStorage.getItem('old-memory-builder-guide-seen') !== 'true',
  )
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const isCameraTransitioning = useSceneStore(
    (state) => state.isCameraTransitioning,
  )
  const isWalkMode = cameraMode === 'walk' || isCameraTransitioning
  const dismissFirstSceneGuide = () => {
    sessionStorage.setItem('old-memory-builder-guide-seen', 'true')
    setFirstSceneGuideOpen(false)
  }

  return (
    <div className={`app-layout${isWalkMode ? ' is-walk-mode' : ''}`}>
      <Toolbar />
      <main className="workspace">
        <AssetSidebar />
        <section className="scene-panel" aria-label="Memory diorama scene">
          <SceneCanvas />
          {isFirstSceneGuideOpen && !isWalkMode ? (
            <section className="first-scene-guide" aria-labelledby="first-scene-guide-title">
              <button
                className="first-scene-guide-close"
                type="button"
                aria-label="Dismiss first scene guide"
                onClick={dismissFirstSceneGuide}
              >
                ×
              </button>
              <span className="first-scene-guide-kicker">Your first memory scene</span>
              <h2 id="first-scene-guide-title">Build it, then step inside.</h2>
              <ol>
                <li><b>1</b><span><strong>Set your world</strong>Choose terrain and weather in the left panel.</span></li>
                <li><b>2</b><span><strong>Place your memories</strong>Pick an asset, then click the ground.</span></li>
                <li><b>3</b><span><strong>Explore your story</strong>Take a Memory Walk when you are ready.</span></li>
              </ol>
              <button className="first-scene-guide-start" type="button" onClick={dismissFirstSceneGuide}>
                Start building
              </button>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  )
}
