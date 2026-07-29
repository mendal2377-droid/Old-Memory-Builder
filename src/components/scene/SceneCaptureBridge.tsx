import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { downloadFile } from '../../utils/download'
import { useSceneStore } from '../../store/sceneStore'

const screenshotFilename = 'old-memory-scene.png'
const successMessage = 'Photo saved to your Downloads folder.'

export function SceneCaptureBridge() {
  const { gl, scene, camera } = useThree()
  const screenshotRequestId = useSceneStore(
    (state) => state.screenshotRequestId,
  )
  const setScreenshotMessage = useSceneStore(
    (state) => state.setScreenshotMessage,
  )

  useEffect(() => {
    if (screenshotRequestId === 0) {
      return
    }

    try {
      const canvas = gl.domElement

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('The WebGL canvas is not ready yet.')
      }

      gl.render(scene, camera)

      const dataUrl = canvas.toDataURL('image/png')

      if (!dataUrl.startsWith('data:image/png')) {
        throw new Error('The WebGL canvas did not return a PNG image.')
      }

      downloadFile(dataUrl, screenshotFilename)
      setScreenshotMessage(successMessage)
    } catch (error) {
      console.error('Screenshot capture failed:', error)
      setScreenshotMessage(
        error instanceof Error ? error.message : String(error),
      )
    }
  }, [camera, gl, scene, screenshotRequestId, setScreenshotMessage])

  return null
}
