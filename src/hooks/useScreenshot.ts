import { useSceneStore } from '../store/sceneStore'

export function useScreenshot() {
  const requestScreenshot = useSceneStore((state) => state.requestScreenshot)

  return { captureScreenshot: requestScreenshot }
}
