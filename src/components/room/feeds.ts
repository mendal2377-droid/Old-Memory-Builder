import { CanvasTexture, SRGBColorSpace } from 'three'
import { assets } from '../../data/assets'
import {
  createAtmosphereSample,
  sampleAtmosphere,
  weatherLabels,
} from '../../data/atmosphere'
import { useSceneStore } from '../../store/sceneStore'
import { worldSnapshots } from '../../data/worldSnapshots'
import { hollowMemory } from '../../data/hollow'
import { riverBlobs } from '../scene/RiverBankDressing'

/**
 * The screens in the room inside the lighthouse.
 *
 * Every feed is drawn from state the app genuinely holds -- the placed objects
 * in the order they were placed, the clock and weather, the animals -- so the
 * screens are a view of the world, not a decoration about it.
 */

const GREEN = '#6dff9a'
const GREEN_DIM = '#1f7a45'
const GREEN_FAINT = 'rgba(109,255,154,0.14)'
const BG = '#040907'
const MONO = '"Consolas", "Courier New", monospace'

export interface Feed {
  canvas: HTMLCanvasElement
  texture: CanvasTexture
  /** Seconds between redraws; slower feeds cost less. */
  interval: number
  last: number
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
}

export function createFeed(
  width: number,
  height: number,
  interval: number,
  draw: Feed['draw'],
): Feed {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return { canvas, texture, interval, last: -1, draw }
}

export function updateFeed(feed: Feed, t: number) {
  if (t - feed.last < feed.interval) return
  feed.last = t
  const ctx = feed.canvas.getContext('2d')
  if (!ctx) return
  feed.draw(ctx, feed.canvas.width, feed.canvas.height, t)
  feed.texture.needsUpdate = true
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function assetOf(assetId: string) {
  return assets.find((a) => a.id === assetId)
}

function label(assetId: string) {
  return (assetOf(assetId)?.name ?? assetId).toUpperCase().replace(/\s+/g, '_')
}

/** Height in world units a marker stands above its footprint. */
function heightOf(assetId: string, scaleY: number) {
  const a = assetOf(assetId)
  if (!a) return 0.6
  if (a.kind === 'lighthouse') return 6 * scaleY
  if (a.kind === 'mill' || a.kind === 'barn' || a.kind === 'cabin') return 2.4 * scaleY
  if (a.kind === 'bridge' || a.kind === 'water') return 0.15
  if (a.category === 'Trees') return 3 * scaleY
  if (a.category === 'HOUSES') return 2.6 * scaleY
  if (a.category === 'Animals') return 1.1 * scaleY
  if (a.category === 'Rocks') return 0.6 * scaleY
  return 0.5 * scaleY
}

function scanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
}

function frame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  right: string,
) {
  ctx.font = `${Math.round(h * 0.045)}px ${MONO}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = GREEN
  ctx.textAlign = 'left'
  ctx.fillText(title, w * 0.03, h * 0.035)
  ctx.textAlign = 'right'
  ctx.fillStyle = GREEN_DIM
  ctx.fillText(right, w * 0.97, h * 0.035)
  ctx.textAlign = 'left'
}

// ---------------------------------------------------------------- build ----

/**
 * The garden, placed again in the order it was built. An isometric wireframe
 * rebuilds itself object by object, the newest one bracketed.
 */
export function drawBuild(zoom: number, speed: number, offset: number): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    const objects = useSceneStore.getState().sceneObjects
    const n = objects.length
    const cycle = n + 10
    const p = (t * speed + offset * cycle) % cycle
    const shown = Math.min(n, Math.floor(p))

    const unit = (Math.min(w, h * 1.9) / 52) * zoom
    const cx = w / 2
    const cy = h * 0.66
    const iso = (x: number, y: number, z: number): [number, number] => [
      cx + (x - z) * 0.866 * unit,
      cy + (x + z) * 0.5 * unit - y * unit,
    ]

    // Ground plate and grid
    ctx.strokeStyle = GREEN_FAINT
    ctx.lineWidth = 1
    for (let g = -19; g <= 19; g += 4) {
      const [ax, ay] = iso(g, 0, -19)
      const [bx, by] = iso(g, 0, 19)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
      const [cx2, cy2] = iso(-19, 0, g)
      const [dx2, dy2] = iso(19, 0, g)
      ctx.beginPath()
      ctx.moveTo(cx2, cy2)
      ctx.lineTo(dx2, dy2)
      ctx.stroke()
    }
    ctx.strokeStyle = GREEN_DIM
    const corners = [iso(-19, 0, -19), iso(19, 0, -19), iso(19, 0, 19), iso(-19, 0, 19)]
    ctx.beginPath()
    corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.stroke()

    // River, as the walk collision sees it
    ctx.strokeStyle = 'rgba(90,200,255,0.45)'
    for (const [bx, bz, rw, rl] of riverBlobs) {
      ctx.beginPath()
      for (let s = 0; s <= 24; s += 1) {
        const a = (s / 24) * Math.PI * 2
        const [x, y] = iso(bx + Math.cos(a) * rw, 0, bz + Math.sin(a) * rl)
        if (s) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.stroke()
    }

    // Objects, back to front so nearer wireframes sit on top
    const order = objects
      .map((o, i) => ({ o, i }))
      .filter(({ i }) => i < shown)
      .sort(
        (a, b) =>
          a.o.position[0] + a.o.position[2] - (b.o.position[0] + b.o.position[2]),
      )

    for (const { o, i } of order) {
      const a = assetOf(o.assetId)
      const r = Math.max(0.45, (a?.collisionRadius ?? 0.6) * o.scale[0])
      const ht = heightOf(o.assetId, o.scale[1])
      const newest = i === shown - 1
      ctx.strokeStyle = newest ? '#ffffff' : a?.category === 'Animals' ? '#ffd88a' : GREEN
      ctx.globalAlpha = newest ? 1 : 0.85
      ctx.lineWidth = newest ? 2 : 1

      const seg = 10
      const base: Array<[number, number]> = []
      const top: Array<[number, number]> = []
      for (let s = 0; s < seg; s += 1) {
        const ang = (s / seg) * Math.PI * 2
        base.push(iso(o.position[0] + Math.cos(ang) * r, 0, o.position[2] + Math.sin(ang) * r))
        top.push(
          iso(
            o.position[0] + Math.cos(ang) * r * 0.78,
            ht,
            o.position[2] + Math.sin(ang) * r * 0.78,
          ),
        )
      }
      ctx.beginPath()
      base.forEach(([x, y], s) => (s ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      top.forEach(([x, y], s) => (s ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      for (let s = 0; s < seg; s += 2) {
        ctx.moveTo(base[s][0], base[s][1])
        ctx.lineTo(top[s][0], top[s][1])
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Bracket and label on whatever was placed last
    if (shown > 0 && shown <= n) {
      const o = objects[shown - 1]
      const [x, y] = iso(o.position[0], heightOf(o.assetId, o.scale[1]) + 0.4, o.position[2])
      const s = unit * 1.3
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x - s, y - s * 0.6 + 6)
      ctx.lineTo(x - s, y - s * 0.6)
      ctx.lineTo(x - s + 8, y - s * 0.6)
      ctx.moveTo(x + s, y - s * 0.6 + 6)
      ctx.lineTo(x + s, y - s * 0.6)
      ctx.lineTo(x + s - 8, y - s * 0.6)
      ctx.stroke()
      ctx.font = `${Math.round(h * 0.04)}px ${MONO}`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`+ ${label(o.assetId)}`, x, y - s * 0.6 - 4)
      ctx.textAlign = 'left'
    }

    frame(
      ctx,
      w,
      h,
      'CONSTRUCTION // REPLAY',
      `${String(shown).padStart(3, '0')} / ${String(n).padStart(3, '0')}`,
    )

    // Progress bar
    ctx.fillStyle = GREEN_FAINT
    ctx.fillRect(w * 0.03, h * 0.94, w * 0.94, 3)
    ctx.fillStyle = GREEN
    ctx.fillRect(w * 0.03, h * 0.94, w * 0.94 * (n ? shown / n : 0), 3)
    scanlines(ctx, w, h)
  }
}

// -------------------------------------------------------------- weather ----

const weatherSample = createAtmosphereSample()

export function drawWeather(): Feed['draw'] {
  return (ctx, w, h, t) => {
    const s = useSceneStore.getState()
    sampleAtmosphere(s.timeOfDay, s.weather, s.weatherIntensity, s.worldStyle, weatherSample)

    // Sky strip from the same colours the world is lit with
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, `#${weatherSample.skyTop.getHexString()}`)
    g.addColorStop(1, `#${weatherSample.skyBottom.getHexString()}`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(2,8,5,0.55)'
    ctx.fillRect(0, 0, w, h)

    // Weather, drawn as the streaks it would be
    const count = Math.round(s.weatherIntensity * 90)
    ctx.strokeStyle = 'rgba(150,215,255,0.5)'
    ctx.lineWidth = 1
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    if (s.weather === 'rain' || s.weather === 'storm') {
      for (let i = 0; i < count; i += 1) {
        const x = hash(i) * w
        const y = (hash(i + 50) * h + t * h * (0.9 + hash(i + 9))) % h
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - 5, y + 16)
        ctx.stroke()
      }
    } else if (s.weather === 'snow') {
      for (let i = 0; i < count; i += 1) {
        const x = (hash(i) * w + Math.sin(t + i) * 10) % w
        const y = (hash(i + 50) * h + t * h * 0.15) % h
        ctx.fillRect(x, y, 3, 3)
      }
    }

    // 24h dial with the current hour marked
    const r = Math.min(w, h) * 0.26
    const dx = w * 0.27
    const dy = h * 0.58
    ctx.lineWidth = 2
    ctx.strokeStyle = GREEN_DIM
    ctx.beginPath()
    ctx.arc(dx, dy, r, 0, Math.PI * 2)
    ctx.stroke()
    for (let hr = 0; hr < 24; hr += 1) {
      const a = (hr / 24) * Math.PI * 2 - Math.PI / 2
      const len = hr % 6 === 0 ? 0.16 : 0.07
      ctx.beginPath()
      ctx.moveTo(dx + Math.cos(a) * r, dy + Math.sin(a) * r)
      ctx.lineTo(dx + Math.cos(a) * r * (1 - len), dy + Math.sin(a) * r * (1 - len))
      ctx.stroke()
    }
    const ha = (s.timeOfDay / 24) * Math.PI * 2 - Math.PI / 2
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(dx, dy)
    ctx.lineTo(dx + Math.cos(ha) * r * 0.82, dy + Math.sin(ha) * r * 0.82)
    ctx.stroke()

    const hh = Math.floor(s.timeOfDay)
    const mm = Math.floor((s.timeOfDay - hh) * 60)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(h * 0.17)}px ${MONO}`
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      w * 0.5,
      h * 0.5,
    )

    ctx.font = `${Math.round(h * 0.06)}px ${MONO}`
    ctx.fillStyle = GREEN
    ctx.fillText(weatherLabels[s.weather].toUpperCase(), w * 0.5, h * 0.68)
    ctx.fillStyle = GREEN_FAINT
    ctx.fillRect(w * 0.5, h * 0.76, w * 0.42, 6)
    ctx.fillStyle = GREEN
    ctx.fillRect(w * 0.5, h * 0.76, w * 0.42 * s.weatherIntensity, 6)
    ctx.font = `${Math.round(h * 0.04)}px ${MONO}`
    ctx.fillStyle = GREEN_DIM
    ctx.fillText(
      `INTENSITY ${Math.round(s.weatherIntensity * 100)}%   CLOUD ${Math.round(weatherSample.cloudiness * 100)}%`,
      w * 0.5,
      h * 0.84,
    )
    ctx.textBaseline = 'top'

    frame(ctx, w, h, 'ATMOSPHERE // LIVE', s.worldStyle.toUpperCase())
    scanlines(ctx, w, h)
  }
}

// -------------------------------------------------------------- animals ----

export function drawAnimals(): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    const objects = useSceneStore.getState().sceneObjects
    const animals = objects.filter((o) => assetOf(o.assetId)?.category === 'Animals')

    // Top-down plan, square, left of the feed
    const size = h * 0.78
    const ox = w * 0.04
    const oy = h * 0.14
    const toX = (x: number) => ox + ((x + 19) / 38) * size
    const toY = (z: number) => oy + ((z + 19) / 38) * size
    ctx.strokeStyle = GREEN_DIM
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, size, size)
    ctx.strokeStyle = GREEN_FAINT
    for (let g = 1; g < 6; g += 1) {
      ctx.beginPath()
      ctx.moveTo(ox + (size / 6) * g, oy)
      ctx.lineTo(ox + (size / 6) * g, oy + size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(ox, oy + (size / 6) * g)
      ctx.lineTo(ox + size, oy + (size / 6) * g)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(90,200,255,0.4)'
    for (const [bx, bz, rw, rl] of riverBlobs) {
      ctx.beginPath()
      ctx.ellipse(toX(bx), toY(bz), (rw / 38) * size, (rl / 38) * size, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(109,255,154,0.35)'
    for (const o of objects) {
      if (assetOf(o.assetId)?.category === 'Animals') continue
      ctx.fillRect(toX(o.position[0]) - 1, toY(o.position[2]) - 1, 2, 2)
    }

    // A slow sweep over the plan
    const sweep = (t * 0.35) % 1
    ctx.fillStyle = 'rgba(109,255,154,0.10)'
    ctx.fillRect(ox, oy + sweep * size - 2, size, 4)

    animals.forEach((o, i) => {
      const x = toX(o.position[0])
      const y = toY(o.position[2])
      const b = 9 * (1 + Math.sin(t * 3 + i) * 0.12)
      ctx.strokeStyle = '#ffd88a'
      ctx.lineWidth = 2
      ctx.strokeRect(x - b, y - b, b * 2, b * 2)
      ctx.fillStyle = '#ffd88a'
      ctx.fillRect(x - 2, y - 2, 4, 4)
    })

    // Subject list
    ctx.font = `${Math.round(h * 0.045)}px ${MONO}`
    ctx.textBaseline = 'top'
    const lx = ox + size + w * 0.05
    if (!animals.length) {
      ctx.fillStyle = GREEN_DIM
      ctx.fillText('NO SUBJECTS IN FRAME', lx, h * 0.3)
    }
    animals.slice(0, 11).forEach((o, i) => {
      const y = h * 0.16 + i * h * 0.068
      ctx.fillStyle =
        i === Math.floor(t * 0.8) % Math.max(1, animals.length) ? '#ffffff' : GREEN
      ctx.fillText(`${String(i + 1).padStart(2, '0')} ${label(o.assetId)}`, lx, y)
      ctx.fillStyle = GREEN_DIM
      ctx.fillText(`${o.position[0].toFixed(1)},${o.position[2].toFixed(1)}`, lx + w * 0.34, y)
    })

    frame(ctx, w, h, 'SUBJECTS // TRACKING', `${animals.length} LOCATED`)
    scanlines(ctx, w, h)
  }
}

// ---------------------------------------------------------------- model ----

type V3 = [number, number, number]

/** A lighthouse, as wire: octagonal taper, gallery ring, lantern, cap. */
function lighthouseWire(): Array<[V3, V3]> {
  const lines: Array<[V3, V3]> = []
  const ring = (y: number, r: number): V3[] =>
    Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      return [Math.cos(a) * r, y, Math.sin(a) * r] as V3
    })
  const rings = [
    ring(0, 1.25),
    ring(1.6, 1.05),
    ring(3.2, 0.88),
    ring(4.6, 0.72),
    ring(4.9, 1.0),
    ring(5.0, 1.0),
    ring(6.1, 0.55),
    ring(6.8, 0.0),
  ]
  rings.forEach((rg, ri) => {
    rg.forEach((p, i) => lines.push([p, rg[(i + 1) % rg.length]]))
    if (ri < rings.length - 1 && ri !== 3) {
      rg.forEach((p, i) => lines.push([p, rings[ri + 1][i]]))
    }
  })
  return lines
}

const wire = lighthouseWire()

export function drawModel(speed: number, phase: number): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    const a = t * speed + phase
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const tilt = 0.32
    const ct = Math.cos(tilt)
    const st = Math.sin(tilt)
    const scale = h * 0.085
    const project = (p: V3): [number, number, number] => {
      const x = p[0] * ca - p[2] * sa
      const z = p[0] * sa + p[2] * ca
      const y = p[1] - 3.2
      const y2 = y * ct - z * st
      const z2 = y * st + z * ct
      const persp = 1 / (1 - z2 * 0.05)
      return [w * 0.5 + x * scale * persp, h * 0.52 - y2 * scale * persp, z2]
    }

    // Scan plane sweeping up the model
    const scanY = ((t * 0.5 + phase) % 1) * 6.8
    ctx.lineWidth = 1.4
    for (const [p, q] of wire) {
      const [x1, y1, z1] = project(p)
      const [x2, y2] = project(q)
      const lit = Math.abs((p[1] + q[1]) / 2 - scanY) < 0.5
      ctx.strokeStyle = lit ? '#ffffff' : z1 > 0 ? GREEN : GREEN_DIM
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    ctx.fillStyle = GREEN_DIM
    ctx.font = `${Math.round(h * 0.04)}px ${MONO}`
    ctx.textBaseline = 'top'
    ctx.fillText(`VERTS ${wire.length / 2}  EDGES ${wire.length}`, w * 0.03, h * 0.88)
    ctx.textAlign = 'right'
    ctx.fillText(
      `ROT ${Math.round((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2)) * 360)}`,
      w * 0.97,
      h * 0.88,
    )
    ctx.textAlign = 'left'
    frame(ctx, w, h, 'MODEL // LIGHTHOUSE_01', 'WIREFRAME')
    scanlines(ctx, w, h)
  }
}

// ------------------------------------------------------------------ log ----

export function drawLog(): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    const objects = useSceneStore.getState().sceneObjects
    const n = Math.max(1, objects.length)
    const size = Math.round(h * 0.052)
    ctx.font = `${size}px ${MONO}`
    ctx.textBaseline = 'top'
    const rows = Math.floor((h * 0.8) / (size * 1.25))
    const head = Math.floor(t * 2.2)
    for (let r = 0; r < rows; r += 1) {
      const i = (((head - (rows - 1 - r)) % n) + n) % n
      const o = objects[i]
      if (!o) continue
      const y = h * 0.13 + r * size * 1.25
      ctx.fillStyle = r === rows - 1 ? '#ffffff' : r > rows - 4 ? GREEN : GREEN_DIM
      ctx.fillText(
        `${String(i + 1).padStart(3, '0')} PLACE ${label(o.assetId).slice(0, 16).padEnd(16)} ${o.position[0].toFixed(1).padStart(5)} ${o.position[2].toFixed(1).padStart(5)}`,
        w * 0.03,
        y,
      )
    }
    frame(ctx, w, h, 'LEDGER // PLACEMENTS', 'APPEND-ONLY')
    scanlines(ctx, w, h)
  }
}

// ----------------------------------------------------------------- rain ----

const GLYPHS =
  'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789'

export function drawRain(seed: number): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = 'rgba(2,8,5,0.42)'
    ctx.fillRect(0, 0, w, h)
    const cell = Math.round(h * 0.06)
    const cols = Math.floor(w / cell)
    ctx.font = `${cell}px "MS Gothic", ${MONO}`
    ctx.textBaseline = 'top'
    for (let c = 0; c < cols; c += 1) {
      const speed = 3 + hash(c + seed) * 7
      const offset = hash(c * 3 + seed) * 100
      const head = ((t * speed + offset) % (h / cell + 14)) - 7
      const row = Math.floor(head)
      const x = c * cell
      for (let k = 0; k < 10; k += 1) {
        const r = row - k
        if (r < 0 || r * cell > h) continue
        const glyph =
          GLYPHS[
            Math.floor(
              hash(c * 31 + r * 7 + (k === 0 ? Math.floor(t * 4) : 0) + seed) * GLYPHS.length,
            )
          ]
        ctx.fillStyle =
          k === 0 ? '#eafff0' : `rgba(109,255,154,${Math.max(0.08, 1 - k / 10)})`
        ctx.fillText(glyph, x, r * cell)
      }
    }
  }
}

// ---------------------------------------------------------------- photo ----

/**
 * A full-colour still of the garden, drifting slowly as if on a camera, with
 * the barest overlay so the picture stays the picture.
 */
export function drawPhoto(index: number): Feed['draw'] {
  return (ctx, w, h, t) => {
    const frames = worldSnapshots.frames
    const shot = frames.length ? frames[index % frames.length] : null
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    if (!shot) {
      ctx.fillStyle = GREEN_DIM
      ctx.font = `${Math.round(h * 0.06)}px ${MONO}`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText('NO SIGNAL', w / 2, h / 2)
      ctx.textAlign = 'left'
      return
    }

    // Slow drift and breathe, never leaving the picture
    const zoom = 1.06 + 0.04 * Math.sin(t * 0.22 + index * 1.7)
    const sw = shot.canvas.width / zoom
    const sh = shot.canvas.height / zoom
    const sx = (shot.canvas.width - sw) / 2 + Math.sin(t * 0.17 + index) * (shot.canvas.width - sw) * 0.45
    const sy = (shot.canvas.height - sh) / 2 + Math.cos(t * 0.13 + index * 2) * (shot.canvas.height - sh) * 0.45
    ctx.drawImage(shot.canvas, sx, sy, sw, sh, 0, 0, w, h)

    // A whisper of screen: faint lines, a darkened corner for the caption
    ctx.fillStyle = 'rgba(0,0,0,0.07)'
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.2)
    g.addColorStop(0, 'rgba(0,0,0,0.55)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h * 0.2)

    ctx.font = `${Math.round(h * 0.05)}px ${MONO}`
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`CAM ${String((index % frames.length) + 1).padStart(2, '0')}  ${shot.label}`, w * 0.04, h * 0.045)
    if (Math.floor(t * 1.2) % 2 === 0) {
      ctx.fillStyle = '#ff4a4a'
      ctx.beginPath()
      ctx.arc(w * 0.94, h * 0.075, h * 0.018, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// --------------------------------------------------------------- hollow ----

/**
 * The screen for the Hollow. Dead black until you have been across; after that
 * it shows the garden with the colour drained out, ash falling, and the dragon
 * crossing the sky now and then.
 */
export function drawHollow(): Feed['draw'] {
  let wokeAt = -1
  return (ctx, w, h, t) => {
    if (!hollowMemory.visited) {
      wokeAt = -1
      ctx.fillStyle = '#010201'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.012)'
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
      return
    }
    if (wokeAt < 0) wokeAt = t

    const shot = worldSnapshots.frames[worldSnapshots.frames.length > 1 ? 1 : 0]
    ctx.fillStyle = '#0a0b0c'
    ctx.fillRect(0, 0, w, h)
    if (shot) {
      ctx.drawImage(shot.canvas, 0, 0, shot.canvas.width, shot.canvas.height, 0, 0, w, h)
      // Drain it: a flat grey laid over in "saturation" mode removes the colour
      ctx.globalCompositeOperation = 'saturation'
      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(130,136,140,0.28)'
      ctx.fillRect(0, 0, w, h)
    }

    // Ash
    ctx.fillStyle = 'rgba(225,228,230,0.55)'
    for (let i = 0; i < 70; i += 1) {
      const x = (hash(i) * w + Math.sin(t * 0.4 + i) * 14) % w
      const y = (hash(i + 31) * h + t * (8 + hash(i + 9) * 16)) % h
      const s = 1 + hash(i + 5) * 2
      ctx.fillRect(x, y, s, s)
    }

    // The dragon, crossing high up, wings working slowly
    const span = w + 260
    const dx = ((t * 22) % span) - 130
    const dy = h * 0.2 + Math.sin(t * 0.5) * h * 0.03
    const flap = Math.sin(t * 2.1)
    const k = h / 430
    ctx.fillStyle = 'rgba(10,12,13,0.9)'
    ctx.beginPath()
    ctx.ellipse(dx, dy, 34 * k, 9 * k, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath() // tail
    ctx.moveTo(dx - 30 * k, dy)
    ctx.quadraticCurveTo(dx - 80 * k, dy + 14 * k, dx - 120 * k, dy - 4 * k)
    ctx.lineTo(dx - 30 * k, dy + 4 * k)
    ctx.fill()
    ctx.beginPath() // neck and head
    ctx.moveTo(dx + 28 * k, dy - 2 * k)
    ctx.quadraticCurveTo(dx + 50 * k, dy - 12 * k, dx + 62 * k, dy - 8 * k)
    ctx.lineTo(dx + 30 * k, dy + 6 * k)
    ctx.fill()
    for (const side of [-1, 1]) {
      ctx.beginPath() // wing
      ctx.moveTo(dx - 4 * k, dy - 4 * k)
      ctx.lineTo(dx - 36 * k, dy + side * (46 + flap * 30) * k - 4 * k)
      ctx.lineTo(dx + 20 * k, dy + side * (28 + flap * 22) * k)
      ctx.closePath()
      ctx.fill()
    }

    // Edges close in
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, 'rgba(0,0,0,0.7)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, w, h)

    // Switching on: a short flicker the first moments after it wakes
    const since = t - wokeAt
    if (since < 0.9 && Math.floor(since * 24) % 3 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.fillRect(0, 0, w, h)
    }

    ctx.font = `${Math.round(h * 0.045)}px ${MONO}`
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(210,214,216,0.85)'
    ctx.fillText('HOLLOW // UNMAINTAINED', w * 0.03, h * 0.04)
    ctx.fillStyle = 'rgba(210,214,216,0.45)'
    ctx.textAlign = 'right'
    ctx.fillText('NO KEEPER', w * 0.97, h * 0.04)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  }
}
