import { useSceneStore } from '../../store/sceneStore'
import { AssetSidebar } from '../assets/AssetSidebar'
import { SceneCanvas } from '../scene/SceneCanvas'
import { Toolbar } from '../toolbar/Toolbar'

export function AppLayout() {
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const isCameraTransitioning = useSceneStore(
    (state) => state.isCameraTransitioning,
  )
  const isWalkMode = cameraMode === 'walk' || isCameraTransitioning

  return (
    <div className={`app-layout${isWalkMode ? ' is-walk-mode' : ''}`}>
      <Toolbar />
      <main className="workspace">
        <AssetSidebar />
        <section className="scene-panel" aria-label="Memory diorama scene">
          <SceneCanvas />
        </section>
      </main>
    </div>
  )
}
