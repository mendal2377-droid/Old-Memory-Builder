import { useSceneStore } from '../../store/sceneStore'
import type { Feed } from './feeds'

/**
 * The screens as they are when the garden has been torn loose and set adrift.
 *
 * In the Deep Space world the room's screens stop watching rain and start
 * watching the things that are actually out there: the stars rushing past, the
 * moons and the debris ring, the sister islands on radar, the reactor under the
 * board, the nebula. Same room, same wall; a different view of a different sky.
 */

const CYAN = '#39d8ff'
const CYAN_DIM = '#1b6f9c'
const CYAN_FAINT = 'rgba(57,216,255,0.14)'
const BG = '#02040b'
const MONO = '"Consolas", "Courier New", monospace'

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 1.7) * 43758.5453
  return x - Math.floor(x)
}

function lines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
}

function head(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, right: string) {
  ctx.font = `${Math.round(h * 0.045)}px ${MONO}`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = CYAN
  ctx.fillText(title, w * 0.03, h * 0.035)
  ctx.textAlign = 'right'
  ctx.fillStyle = CYAN_DIM
  ctx.fillText(right, w * 0.97, h * 0.035)
  ctx.textAlign = 'left'
}

function stars(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, t: number, seed: number) {
  for (let i = 0; i < count; i += 1) {
    const x = hash(i + seed) * w
    const y = hash(i * 3 + seed) * h
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.6 + hash(i) * 1.4) + i))
    ctx.fillStyle = `rgba(210,230,255,${0.25 + tw * 0.6})`
    const s = hash(i * 7 + seed) > 0.93 ? 2 : 1
    ctx.fillRect(x, y, s, s)
  }
}

// ----------------------------------------------------------- hyperspace ----

/** Stars streaming past as the island drifts. */
export function drawStarfield(seed: number, speed: number): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h / 2
    const reach = Math.hypot(cx, cy)
    for (let i = 0; i < 170; i += 1) {
      const a = hash(i + seed) * Math.PI * 2
      const z = (hash(i * 3 + seed) + t * speed * (0.5 + hash(i * 5) * 0.7)) % 1
      const far = Math.pow(z, 2.4)
      const near = Math.pow(Math.max(0, z - 0.035), 2.4)
      const x0 = cx + Math.cos(a) * near * reach
      const y0 = cy + Math.sin(a) * near * reach
      const x1 = cx + Math.cos(a) * far * reach
      const y1 = cy + Math.sin(a) * far * reach
      ctx.strokeStyle = `rgba(${150 + z * 100},${200 + z * 50},255,${0.15 + z * 0.85})`
      ctx.lineWidth = 0.6 + z * 1.6
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
    head(ctx, w, h, 'FORWARD // OPTICAL', `${(0.08 + 0.02 * Math.sin(t)).toFixed(3)} c`)
    lines(ctx, w, h)
  }
}

// ---------------------------------------------------------------- orbit ----

/** The island at the middle, its moons and its ring of rock going round. */
export function drawOrbit(): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    stars(ctx, w, h, 60, t, 4)
    const cx = w / 2
    const cy = h * 0.54
    const u = h * 0.0075

    // The island: a small bright core
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14 * u)
    glow.addColorStop(0, 'rgba(160,240,255,0.95)')
    glow.addColorStop(0.35, 'rgba(57,216,255,0.45)')
    glow.addColorStop(1, 'rgba(57,216,255,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, 14 * u, 0, Math.PI * 2)
    ctx.fill()

    // Orbits, drawn as ellipses seen at an angle
    const tilt = 0.38
    ctx.strokeStyle = CYAN_FAINT
    ctx.lineWidth = 1
    for (const r of [22, 34, 47]) {
      ctx.beginPath()
      ctx.ellipse(cx, cy, r * u * 2.2, r * u * 2.2 * tilt, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    // The ring of debris
    ctx.fillStyle = 'rgba(170,184,214,0.7)'
    for (let i = 0; i < 70; i += 1) {
      const a = (i / 70) * Math.PI * 2 + t * 0.12 * (0.7 + hash(i) * 0.6)
      const r = 47 * u * 2.2 * (0.97 + hash(i + 9) * 0.06)
      ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * tilt, 1.5, 1.5)
    }

    // Moons
    const moons = [
      { r: 22, speed: 0.55, size: 4.2, name: 'MOON A', tone: '#b9c4e0' },
      { r: 34, speed: -0.34, size: 6.2, name: 'MOON B', tone: '#8d9ac0' },
    ]
    moons.forEach((m, i) => {
      const a = t * m.speed + i * 2.1
      const rx = m.r * u * 2.2
      const x = cx + Math.cos(a) * rx
      const y = cy + Math.sin(a) * rx * tilt
      const size = m.size * u * 0.9
      ctx.fillStyle = m.tone
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
      // The lit side faces the star, which is off to one side
      ctx.fillStyle = 'rgba(2,4,11,0.55)'
      ctx.beginPath()
      ctx.arc(x + size * 0.45, y, size * 0.95, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = CYAN
      ctx.lineWidth = 1
      ctx.strokeRect(x - size - 3, y - size - 3, (size + 3) * 2, (size + 3) * 2)
      ctx.font = `${Math.round(h * 0.04)}px ${MONO}`
      ctx.fillStyle = CYAN
      ctx.textBaseline = 'top'
      ctx.fillText(m.name, x + size + 6, y - size - 2)
    })

    head(ctx, w, h, 'ORBITAL // CHART', 'DRIFT')
    lines(ctx, w, h)
  }
}

// ---------------------------------------------------------------- radar ----

/** A sweep over the local sky: sister islands holding still, ships passing. */
export function drawRadar(): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h * 0.55
    const R = Math.min(w * 0.42, h * 0.4)

    ctx.strokeStyle = CYAN_FAINT
    ctx.lineWidth = 1
    for (let k = 1; k <= 3; k += 1) {
      ctx.beginPath()
      ctx.arc(cx, cy, (R * k) / 3, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx - R, cy)
    ctx.lineTo(cx + R, cy)
    ctx.moveTo(cx, cy - R)
    ctx.lineTo(cx, cy + R)
    ctx.stroke()

    // Sweep with a fading tail
    const sweep = (t * 0.9) % (Math.PI * 2)
    for (let k = 0; k < 24; k += 1) {
      const a = sweep - k * 0.045
      ctx.strokeStyle = `rgba(57,216,255,${0.5 * (1 - k / 24)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.stroke()
    }

    const blip = (a: number, r: number, label: string, size: number, tone: string) => {
      let behind = sweep - a
      behind = ((behind % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const glowAmount = Math.exp(-behind * 0.9)
      const x = cx + Math.cos(a) * r * R
      const y = cy + Math.sin(a) * r * R
      ctx.fillStyle = tone
      ctx.globalAlpha = 0.18 + glowAmount * 0.82
      ctx.fillRect(x - size / 2, y - size / 2, size, size)
      if (glowAmount > 0.35) {
        ctx.font = `${Math.round(h * 0.038)}px ${MONO}`
        ctx.textBaseline = 'top'
        ctx.fillText(label, x + size, y - size)
      }
      ctx.globalAlpha = 1
    }

    // Sister islands: fixed contacts
    for (let i = 0; i < 4; i += 1) {
      blip(hash(i + 20) * Math.PI * 2, 0.35 + hash(i + 30) * 0.55, `ISLAND ${i + 1}`, 7, CYAN)
    }
    // Ships: slow movers
    for (let i = 0; i < 3; i += 1) {
      const a = hash(i + 50) * Math.PI * 2 + t * (0.05 + i * 0.02)
      blip(a, 0.55 + hash(i + 60) * 0.35, `VESSEL ${i + 1}`, 4, '#ffd88a')
    }

    head(ctx, w, h, 'RADAR // LOCAL', 'RANGE 3 KM')
    lines(ctx, w, h)
  }
}

// ----------------------------------------------------------------- core ----

/** The reactor slung under the board: power, pulse, a trace that scrolls by. */
export function drawCore(): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    const cx = w * 0.3
    const cy = h * 0.5
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2)

    for (let k = 0; k < 5; k += 1) {
      const r = h * (0.07 + k * 0.045) * (1 + pulse * 0.05 * (5 - k))
      ctx.strokeStyle = `rgba(57,216,255,${0.85 - k * 0.15})`
      ctx.lineWidth = 2 - k * 0.25
      ctx.beginPath()
      for (let s = 0; s <= 6; s += 1) {
        const a = (s / 6) * Math.PI * 2 + t * (0.3 + k * 0.1) * (k % 2 ? -1 : 1)
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        if (s) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.stroke()
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.12)
    g.addColorStop(0, `rgba(210,250,255,${0.6 + pulse * 0.35})`)
    g.addColorStop(1, 'rgba(57,216,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(cx - h * 0.15, cy - h * 0.15, h * 0.3, h * 0.3)

    // Readouts
    ctx.font = `${Math.round(h * 0.055)}px ${MONO}`
    ctx.textBaseline = 'top'
    const rows: Array<[string, number]> = [
      ['OUTPUT', 0.94 + 0.04 * Math.sin(t * 0.8)],
      ['COOLANT', 0.71 + 0.05 * Math.sin(t * 0.5 + 1)],
      ['STABILITY', 0.98 - 0.02 * Math.abs(Math.sin(t * 1.3))],
    ]
    rows.forEach(([label, v], i) => {
      const y = h * (0.2 + i * 0.13)
      ctx.fillStyle = CYAN
      ctx.fillText(label, w * 0.56, y)
      ctx.fillStyle = CYAN_FAINT
      ctx.fillRect(w * 0.56, y + h * 0.065, w * 0.38, 4)
      ctx.fillStyle = CYAN
      ctx.fillRect(w * 0.56, y + h * 0.065, w * 0.38 * v, 4)
      ctx.textAlign = 'right'
      ctx.fillStyle = CYAN_DIM
      ctx.fillText(`${Math.round(v * 100)}%`, w * 0.94, y)
      ctx.textAlign = 'left'
    })

    // A trace scrolling along the bottom
    ctx.strokeStyle = CYAN
    ctx.lineWidth = 1.4
    ctx.beginPath()
    for (let x = 0; x <= w; x += 3) {
      const p = x / w
      const y =
        h * 0.88 -
        (Math.sin(p * 18 + t * 4) * 0.5 + Math.sin(p * 7 - t * 1.7) * 0.5) * h * 0.04 * (0.6 + pulse * 0.6)
      if (x) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.stroke()

    head(ctx, w, h, 'REACTOR // ISLAND CORE', 'ONLINE')
    lines(ctx, w, h)
  }
}

// --------------------------------------------------------------- nebula ----

/** Slow clouds of gas, the colour of the sky out there. */
export function drawNebula(seed: number): Feed['draw'] {
  const tones = [
    [120, 70, 255],
    [40, 170, 255],
    [255, 90, 190],
    [60, 220, 200],
  ]
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 6; i += 1) {
      const [r, g, b] = tones[(i + seed) % tones.length]
      const x = w * (0.5 + 0.38 * Math.sin(t * 0.07 * (1 + hash(i + seed)) + i * 2.1 + seed))
      const y = h * (0.5 + 0.3 * Math.cos(t * 0.05 * (1 + hash(i + seed + 5)) + i * 1.3))
      const rad = h * (0.5 + 0.25 * hash(i + seed * 3))
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rad)
      grad.addColorStop(0, `rgba(${r},${g},${b},0.42)`)
      grad.addColorStop(0.6, `rgba(${r},${g},${b},0.12)`)
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }
    ctx.globalCompositeOperation = 'source-over'
    stars(ctx, w, h, 90, t, seed * 11)
    head(ctx, w, h, 'SKY // NEBULA', `SECTOR ${String(seed * 7 + 12).padStart(3, '0')}`)
    lines(ctx, w, h)
  }
}

// ---------------------------------------------------------------- model ----

type V3 = [number, number, number]

/** A sister island in wire: a flat top, a rock keel, a few towers. */
function islandWire(): Array<[V3, V3]> {
  const out: Array<[V3, V3]> = []
  const ring = (y: number, r: number, n = 9): V3[] =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return [Math.cos(a) * r, y, Math.sin(a) * r] as V3
    })
  const top = ring(0, 2.4)
  const mid = ring(-0.9, 1.9)
  const low = ring(-2, 1.0)
  const tip: V3 = [0, -3.4, 0]
  for (const rg of [top, mid, low]) rg.forEach((p, i) => out.push([p, rg[(i + 1) % rg.length]]))
  top.forEach((p, i) => out.push([p, mid[i]]))
  mid.forEach((p, i) => out.push([p, low[i]]))
  low.forEach((p) => out.push([p, tip]))
  const tower = (x: number, z: number, hgt: number, r: number) => {
    const b = [
      [x - r, 0, z - r], [x + r, 0, z - r], [x + r, 0, z + r], [x - r, 0, z + r],
    ] as V3[]
    const t = b.map((p) => [p[0], hgt, p[2]] as V3)
    b.forEach((p, i) => {
      out.push([p, b[(i + 1) % 4]])
      out.push([t[i], t[(i + 1) % 4]])
      out.push([p, t[i]])
    })
  }
  tower(-0.9, 0.4, 2.2, 0.3)
  tower(0.5, -0.6, 3.1, 0.35)
  tower(0.9, 0.8, 1.5, 0.28)
  return out
}

const island = islandWire()

export function drawIslandModel(speed: number, phase: number): Feed['draw'] {
  return (ctx, w, h, t) => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    stars(ctx, w, h, 40, t, 77)
    const a = t * speed + phase
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const tilt = 0.4
    const ct = Math.cos(tilt)
    const st = Math.sin(tilt)
    const scale = h * 0.075
    const bob = Math.sin(t * 0.8 + phase) * 0.12
    const project = (p: V3): [number, number, number] => {
      const x = p[0] * ca - p[2] * sa
      const z = p[0] * sa + p[2] * ca
      const y = p[1] + 0.3 + bob
      const y2 = y * ct - z * st
      const z2 = y * st + z * ct
      const persp = 1 / (1 - z2 * 0.05)
      return [w * 0.5 + x * scale * persp, h * 0.5 - y2 * scale * persp, z2]
    }
    const scanY = -3.4 + ((t * 0.45 + phase) % 1) * 6.8
    ctx.lineWidth = 1.3
    for (const [p, q] of island) {
      const [x1, y1, z1] = project(p)
      const [x2, y2] = project(q)
      const lit = Math.abs((p[1] + q[1]) / 2 - scanY) < 0.45
      ctx.strokeStyle = lit ? '#ffffff' : z1 > 0 ? CYAN : CYAN_DIM
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
    head(ctx, w, h, 'MODEL // SISTER ISLAND', 'WIREFRAME')
    lines(ctx, w, h)
  }
}

// ------------------------------------------------------------ conditions ----

/** The big "weather" screen out here: there is none, which is the report. */
export function drawSpaceConditions(): Feed['draw'] {
  return (ctx, w, h, t) => {
    const s = useSceneStore.getState()
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    stars(ctx, w, h, 120, t, 31)

    // The same dial as the garden's, still keeping the garden's hours
    const r = Math.min(w, h) * 0.26
    const dx = w * 0.27
    const dy = h * 0.58
    ctx.lineWidth = 2
    ctx.strokeStyle = CYAN_DIM
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
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, w * 0.5, h * 0.42)

    ctx.font = `${Math.round(h * 0.048)}px ${MONO}`
    const rows: Array<[string, string]> = [
      ['ATMOSPHERE', 'NONE'],
      ['SOLAR WIND', `${Math.round(410 + 38 * Math.sin(t * 0.6))} KM/S`],
      ['RADIATION', `${(0.31 + 0.04 * Math.sin(t * 1.1)).toFixed(2)} MSV/H`],
      ['HULL TEMP', `${Math.round(-181 + 3 * Math.sin(t * 0.4))} C`],
    ]
    rows.forEach(([k, v], i) => {
      const y = h * (0.56 + i * 0.1)
      ctx.fillStyle = CYAN_DIM
      ctx.fillText(k, w * 0.5, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = CYAN
      ctx.fillText(v, w * 0.95, y)
      ctx.textAlign = 'left'
    })
    ctx.textBaseline = 'top'
    head(ctx, w, h, 'CONDITIONS // EXTERIOR', 'DEEP SPACE')
    lines(ctx, w, h)
  }
}
