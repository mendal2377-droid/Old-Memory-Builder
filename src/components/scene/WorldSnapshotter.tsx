import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import { assets } from '../../data/assets'
import { registerSnapshotter, worldSnapshots } from '../../data/worldSnapshots'
import { useSceneStore } from '../../store/sceneStore'

/**
 * Photographs the garden from a handful of places, in colour, from the live
 * scene, for the monitors in the lighthouse room.
 *
 * Views are chosen from what is actually placed -- the lighthouse, the bridge,
 * the houses, an animal or two, a tree -- each seen from a spot looking toward
 * the middle of the garden, so a rebuilt scene gets rebuilt photographs.
 */

const FRAME_W = 640
const FRAME_H = 400
const MAX_FRAMES = 7

interface View {
  position: [number, number, number]
  target: [number, number, number]
  label: string
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 3.7) * 43758.5453
  return x - Math.floor(x)
}

function pickViews(): View[] {
  const objects = useSceneStore.getState().sceneObjects
  if (objects.length === 0) return []

  let cx = 0
  let cz = 0
  for (const o of objects) {
    cx += o.position[0]
    cz += o.position[2]
  }
  cx /= objects.length
  cz /= objects.length

  const views: View[] = [
    { position: [cx - 17, 13, cz + 19], target: [cx, 0.4, cz], label: 'OVERVIEW' },
  ]

  const kindOf = (id: string) => assets.find((a) => a.id === id)
  const used = new Set<string>()
  const take = (match: (o: (typeof objects)[number]) => boolean, limit: number) => {
    let n = 0
    for (const o of objects) {
      if (n >= limit || views.length >= MAX_FRAMES) return
      if (used.has(o.id) || !match(o)) continue
      used.add(o.id)
      n += 1
      const a = kindOf(o.assetId)
      const kind = a?.kind
      const isTall = kind === 'lighthouse'
      const dist = isTall ? 9 : kind === 'bridge' ? 6.5 : a?.category === 'Animals' ? 4.6 : 7
      // Stand between the object and the middle of the garden, a little off to one side
      const toward = Math.atan2(cz - o.position[2], cx - o.position[0]) + (hash(views.length) - 0.5) * 1.1
      const px = o.position[0] + Math.cos(toward) * dist
      const pz = o.position[2] + Math.sin(toward) * dist
      views.push({
        position: [px, isTall ? 2.6 : 1.9, pz],
        target: [o.position[0], isTall ? 3.6 : kind === 'bridge' ? 0.6 : a?.category === 'Animals' ? 0.8 : 1.6, o.position[2]],
        label: (a?.name ?? o.assetId).toUpperCase(),
      })
    }
  }

  take((o) => kindOf(o.assetId)?.kind === 'lighthouse', 1)
  take((o) => kindOf(o.assetId)?.kind === 'bridge', 1)
  take((o) => kindOf(o.assetId)?.kind === 'mill', 1)
  take((o) => kindOf(o.assetId)?.category === 'HOUSES', 2)
  take((o) => kindOf(o.assetId)?.category === 'Animals', 1)
  take((o) => kindOf(o.assetId)?.category === 'Trees', 1)
  return views
}

export function WorldSnapshotter() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    registerSnapshotter(() => {
      const canvas = gl.domElement
      const cw = canvas.width
      const ch = canvas.height
      if (cw < 8 || ch < 8) return

      const views = pickViews()
      if (views.length === 0) return

      // Render each view with the live scene onto the real canvas and copy it
      // straight off. The frame the viewer sees next is drawn over all of this.
      const camera = new PerspectiveCamera(58, cw / ch, 0.1, 300)
      const previousTarget = gl.getRenderTarget()
      gl.setRenderTarget(null)

      const sw = Math.min(cw, ch * (FRAME_W / FRAME_H))
      const sh = sw / (FRAME_W / FRAME_H)
      const sx = (cw - sw) / 2
      const sy = (ch - sh) / 2

      const frames = []
      for (const view of views) {
        camera.position.set(...view.position)
        camera.lookAt(...view.target)
        camera.updateMatrixWorld()
        gl.render(scene, camera)

        const out = document.createElement('canvas')
        out.width = FRAME_W
        out.height = FRAME_H
        const ctx = out.getContext('2d')
        if (!ctx) continue
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, FRAME_W, FRAME_H)
        frames.push({ canvas: out, label: view.label })
      }

      gl.setRenderTarget(previousTarget)
      worldSnapshots.frames = frames
    })
    return () => registerSnapshotter(null)
  }, [gl, scene])

  return null
}
