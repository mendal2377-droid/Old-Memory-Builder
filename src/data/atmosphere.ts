import { Color } from 'three'
import type { AtmospherePreset } from '../types/scene'

/**
 * Atmosphere is two independent axes:
 *   timeOfDay  0..24  — drives sky colour, sun/moon position, light direction
 *   weather    kind + intensity — drives cloud cover, particles, fog
 *
 * The named `AtmospherePreset` values are just convenient coordinates in that
 * space, which keeps saved scenes and templates working unchanged.
 */

export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'storm' | 'snow'

/**
 * The setting the diorama sits in. A third axis alongside time and weather:
 * it swaps the sky palette, the distant backdrop and the ground treatment,
 * while leaving every placed object untouched.
 */
export type WorldStyle = 'natural' | 'cyber' | 'space'

export const worldStyles: WorldStyle[] = ['natural', 'cyber', 'space']

export const worldLabels: Record<WorldStyle, string> = {
  natural: 'Natural',
  cyber: 'Cyber City',
  space: 'Deep Space',
}

export const weatherKinds: WeatherKind[] = [
  'clear',
  'overcast',
  'rain',
  'storm',
  'snow',
]

export const weatherLabels: Record<WeatherKind, string> = {
  clear: 'Clear',
  overcast: 'Overcast',
  rain: 'Rain',
  storm: 'Storm',
  snow: 'Snow',
}

export interface AtmosphereCoord {
  timeOfDay: number
  weather: WeatherKind
  weatherIntensity: number
}

/** Where each legacy preset sits in (time × weather) space. */
export const presetCoords: Record<AtmospherePreset, AtmosphereCoord> = {
  'Clear Morning': { timeOfDay: 8.5, weather: 'clear', weatherIntensity: 0 },
  Sunset: { timeOfDay: 18.2, weather: 'clear', weatherIntensity: 0 },
  'Rainy Day': { timeOfDay: 13, weather: 'rain', weatherIntensity: 0.55 },
  'Heavy Rain': { timeOfDay: 13.5, weather: 'storm', weatherIntensity: 1 },
  'Snowy Day': { timeOfDay: 11, weather: 'snow', weatherIntensity: 0.7 },
  'Summer Night': { timeOfDay: 21.5, weather: 'clear', weatherIntensity: 0 },
}

/** Nearest named preset for a coordinate — used for ambient audio selection. */
export function representativePreset(
  weather: WeatherKind,
  isDay: boolean,
): AtmospherePreset {
  if (weather === 'rain') return 'Rainy Day'
  if (weather === 'storm') return 'Heavy Rain'
  if (weather === 'snow') return 'Snowy Day'
  if (!isDay) return 'Summer Night'
  return 'Clear Morning'
}

// -- Time-of-day keyframes ---------------------------------------------------

interface DayKeyframe {
  h: number
  bg: string
  top: string
  bot: string
  amb: number
  hemi: string
  hemiG: string
  hemiI: number
  dir: string
  dirI: number
  fog: string
  fogN: number
  fogF: number
  star: number
}

const naturalKeyframes: DayKeyframe[] = [
  { h: 0, bg: '#0a1120', top: '#070d18', bot: '#141f38', amb: 0.3, hemi: '#2a3a5e', hemiG: '#0e1524', hemiI: 0.18, dir: '#5f7bb5', dirI: 0.3, fog: '#0e1830', fogN: 20, fogF: 110, star: 1 },
  { h: 5, bg: '#20304f', top: '#101d38', bot: '#3a4c74', amb: 0.36, hemi: '#3c5382', hemiG: '#151d30', hemiI: 0.22, dir: '#7d8fc0', dirI: 0.45, fog: '#1c2c4c', fogN: 18, fogF: 105, star: 0.7 },
  { h: 6.5, bg: '#e6a074', top: '#6d7fae', bot: '#ffc48c', amb: 0.5, hemi: '#c9b7cf', hemiG: '#5a4636', hemiI: 0.5, dir: '#ffb266', dirI: 1.7, fog: '#e2a578', fogN: 22, fogF: 110, star: 0.15 },
  { h: 9, bg: '#f6eeda', top: '#9fcdf0', bot: '#fdf3d6', amb: 0.6, hemi: '#bcdcff', hemiG: '#e6d5b4', hemiI: 0.7, dir: '#ffe6b0', dirI: 2.05, fog: '#f4e8cf', fogN: 34, fogF: 120, star: 0 },
  { h: 12, bg: '#eaf2f7', top: '#7db6e8', bot: '#e3f1fb', amb: 0.68, hemi: '#cfe6ff', hemiG: '#dfe8dd', hemiI: 0.8, dir: '#fff5da', dirI: 2.35, fog: '#dfeef7', fogN: 40, fogF: 130, star: 0 },
  { h: 15, bg: '#f3ecd6', top: '#8fbfe6', bot: '#fdeecb', amb: 0.62, hemi: '#c4ddf7', hemiG: '#e4d3ad', hemiI: 0.72, dir: '#ffeec2', dirI: 2.1, fog: '#efe4c8', fogN: 34, fogF: 120, star: 0 },
  { h: 18, bg: '#e58d68', top: '#8e536d', bot: '#ffbd72', amb: 0.42, hemi: '#a5b7df', hemiG: '#c18d62', hemiI: 0.48, dir: '#ffb35f', dirI: 2, fog: '#dea074', fogN: 26, fogF: 108, star: 0.18 },
  { h: 19.5, bg: '#6a5578', top: '#3a2d52', bot: '#a06a86', amb: 0.36, hemi: '#6a5f96', hemiG: '#3a2d3a', hemiI: 0.32, dir: '#a884b8', dirI: 0.8, fog: '#4a3a5c', fogN: 22, fogF: 100, star: 0.55 },
  { h: 21, bg: '#172033', top: '#0b1730', bot: '#263f72', amb: 0.34, hemi: '#314f86', hemiG: '#111827', hemiI: 0.2, dir: '#8ba3d8', dirI: 0.5, fog: '#1a2740', fogN: 20, fogF: 100, star: 0.9 },
  { h: 24, bg: '#0a1120', top: '#070d18', bot: '#141f38', amb: 0.3, hemi: '#2a3a5e', hemiG: '#0e1524', hemiI: 0.18, dir: '#5f7bb5', dirI: 0.3, fog: '#0e1830', fogN: 20, fogF: 110, star: 1 },
]

// Cyber City: smog-hazed daylight that collapses into magenta/cyan neon at
// night. Darker and foggier than nature at every hour.
const cyberKeyframes: DayKeyframe[] = [
  { h: 0, bg: '#0a0618', top: '#05030f', bot: '#1a0a2e', amb: 0.34, hemi: '#2a1a4e', hemiG: '#0d0618', hemiI: 0.3, dir: '#b060ff', dirI: 0.5, fog: '#0d0722', fogN: 12, fogF: 78, star: 0.85 },
  { h: 5, bg: '#140a28', top: '#0a0620', bot: '#2e1444', amb: 0.38, hemi: '#3a2266', hemiG: '#120a22', hemiI: 0.32, dir: '#c070ff', dirI: 0.6, fog: '#150c2c', fogN: 12, fogF: 76, star: 0.6 },
  { h: 6.5, bg: '#3a2448', top: '#1e1236', bot: '#6a3a5e', amb: 0.46, hemi: '#6a4a8a', hemiG: '#241830', hemiI: 0.42, dir: '#ff8ab0', dirI: 1.1, fog: '#33203f', fogN: 14, fogF: 80, star: 0.2 },
  { h: 9, bg: '#5a4a66', top: '#38304e', bot: '#8a7086', amb: 0.55, hemi: '#8a7aa6', hemiG: '#3a3244', hemiI: 0.55, dir: '#ffc0a0', dirI: 1.4, fog: '#4e4258', fogN: 18, fogF: 88, star: 0 },
  { h: 12, bg: '#6e6274', top: '#4a4460', bot: '#9a8a96', amb: 0.6, hemi: '#9a92ae', hemiG: '#46404e', hemiI: 0.6, dir: '#ffd8b8', dirI: 1.6, fog: '#605868', fogN: 20, fogF: 92, star: 0 },
  { h: 15, bg: '#665a70', top: '#423a58', bot: '#927e90', amb: 0.56, hemi: '#928aa4', hemiG: '#423c4c', hemiI: 0.56, dir: '#ffc8a8', dirI: 1.45, fog: '#584e62', fogN: 18, fogF: 88, star: 0 },
  { h: 18, bg: '#4a2a52', top: '#2a1840', bot: '#8a3a70', amb: 0.46, hemi: '#7a4a96', hemiG: '#2e1c34', hemiI: 0.45, dir: '#ff70b0', dirI: 1.2, fog: '#3e2448', fogN: 14, fogF: 80, star: 0.25 },
  { h: 19.5, bg: '#2a1440', top: '#160a2c', bot: '#52206a', amb: 0.4, hemi: '#4e2a7a', hemiG: '#1a0e26', hemiI: 0.36, dir: '#d060ff', dirI: 0.8, fog: '#241236', fogN: 12, fogF: 74, star: 0.6 },
  { h: 21, bg: '#12082a', top: '#08041a', bot: '#2a0e4e', amb: 0.36, hemi: '#341c60', hemiG: '#100822', hemiI: 0.32, dir: '#b050ff', dirI: 0.6, fog: '#150a2e', fogN: 10, fogF: 72, star: 0.9 },
  { h: 24, bg: '#0a0618', top: '#05030f', bot: '#1a0a2e', amb: 0.34, hemi: '#2a1a4e', hemiG: '#0d0618', hemiI: 0.3, dir: '#b060ff', dirI: 0.5, fog: '#0d0722', fogN: 12, fogF: 78, star: 0.85 },
]

// Deep Space: an island adrift. Near-black at every hour with the stars always
// out; "time" only moves which star is lighting the rock and how warm it is.
const spaceKeyframes: DayKeyframe[] = [
  { h: 0, bg: '#04050e', top: '#010206', bot: '#090a1c', amb: 0.3, hemi: '#1a2246', hemiG: '#05060e', hemiI: 0.24, dir: '#9fb8ff', dirI: 0.7, fog: '#05060f', fogN: 60, fogF: 260, star: 1 },
  { h: 5, bg: '#060714', top: '#02030a', bot: '#0d0e26', amb: 0.32, hemi: '#20295a', hemiG: '#06070f', hemiI: 0.26, dir: '#b9c8ff', dirI: 0.95, fog: '#060713', fogN: 60, fogF: 260, star: 1 },
  { h: 6.5, bg: '#0a0a1a', top: '#04040e', bot: '#151230', amb: 0.36, hemi: '#2c2a66', hemiG: '#08080f', hemiI: 0.3, dir: '#ffd2a8', dirI: 1.35, fog: '#08081a', fogN: 60, fogF: 260, star: 0.95 },
  { h: 9, bg: '#0d0f22', top: '#050614', bot: '#191a3c', amb: 0.42, hemi: '#33386f', hemiG: '#0a0b16', hemiI: 0.34, dir: '#ffeccf', dirI: 1.7, fog: '#0b0c1e', fogN: 60, fogF: 260, star: 0.88 },
  { h: 12, bg: '#101228', top: '#070818', bot: '#1c1e44', amb: 0.46, hemi: '#3a4080', hemiG: '#0c0d1a', hemiI: 0.38, dir: '#fff6e2', dirI: 1.95, fog: '#0d0f24', fogN: 60, fogF: 260, star: 0.82 },
  { h: 15, bg: '#0e1024', top: '#060716', bot: '#1a1b3f', amb: 0.43, hemi: '#363c76', hemiG: '#0b0c18', hemiI: 0.35, dir: '#ffe8c8', dirI: 1.72, fog: '#0c0d20', fogN: 60, fogF: 260, star: 0.88 },
  { h: 18, bg: '#0a0a1c', top: '#040510', bot: '#151334', amb: 0.37, hemi: '#2e2c6a', hemiG: '#09090f', hemiI: 0.3, dir: '#ffbf9a', dirI: 1.3, fog: '#08081b', fogN: 60, fogF: 260, star: 0.94 },
  { h: 19.5, bg: '#070816', top: '#02030b', bot: '#100f28', amb: 0.33, hemi: '#242a5e', hemiG: '#07070d', hemiI: 0.27, dir: '#c3b4ff', dirI: 0.95, fog: '#060714', fogN: 60, fogF: 260, star: 0.98 },
  { h: 21, bg: '#050610', top: '#010207', bot: '#0b0b20', amb: 0.31, hemi: '#1c2350', hemiG: '#05060e', hemiI: 0.25, dir: '#a5b8ff', dirI: 0.78, fog: '#050611', fogN: 60, fogF: 260, star: 1 },
  { h: 24, bg: '#04050e', top: '#010206', bot: '#090a1c', amb: 0.3, hemi: '#1a2246', hemiG: '#05060e', hemiI: 0.24, dir: '#9fb8ff', dirI: 0.7, fog: '#05060f', fogN: 60, fogF: 260, star: 1 },
]

const prepare = (frames: DayKeyframe[]) =>
  frames.map((k) => ({
  ...k,
  cBg: new Color(k.bg),
  cTop: new Color(k.top),
  cBot: new Color(k.bot),
  cHemi: new Color(k.hemi),
  cHemiG: new Color(k.hemiG),
  cDir: new Color(k.dir),
  cFog: new Color(k.fog),
  }))

const keyframesByWorld: Record<WorldStyle, ReturnType<typeof prepare>> = {
  natural: prepare(naturalKeyframes),
  cyber: prepare(cyberKeyframes),
  space: prepare(spaceKeyframes),
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Mutable result object so callers can sample every frame without allocating. */
export interface AtmosphereSample {
  background: Color
  skyTop: Color
  skyBottom: Color
  ambientIntensity: number
  hemiSky: Color
  hemiGround: Color
  hemiIntensity: number
  sunColor: Color
  sunIntensity: number
  fogColor: Color
  fogNear: number
  fogFar: number
  starOpacity: number
  /** -1 (deep night) .. 1 (noon) */
  sunElevation: number
  isDay: boolean
  /** 0..1 cloud cover, drives darkening and particle density */
  cloudiness: number
}

export function createAtmosphereSample(): AtmosphereSample {
  return {
    background: new Color(),
    skyTop: new Color(),
    skyBottom: new Color(),
    ambientIntensity: 0.6,
    hemiSky: new Color(),
    hemiGround: new Color(),
    hemiIntensity: 0.7,
    sunColor: new Color(),
    sunIntensity: 2,
    fogColor: new Color(),
    fogNear: 34,
    fogFar: 120,
    starOpacity: 0,
    sunElevation: 0,
    isDay: true,
    cloudiness: 0,
  }
}

/** How much cloud cover each weather kind implies at full intensity. */
const cloudFactor: Record<WeatherKind, number> = {
  clear: 0,
  overcast: 0.8,
  rain: 0.85,
  storm: 1,
  snow: 0.72,
}

/** Desaturate toward the colour's own luminance, then darken. */
function overcastify(color: Color, desaturate: number, darken: number) {
  const lum = color.r * 0.299 + color.g * 0.587 + color.b * 0.114
  color.r = lerp(color.r, lum, desaturate)
  color.g = lerp(color.g, lum, desaturate)
  color.b = lerp(color.b, lum, desaturate)
  color.multiplyScalar(1 - darken)
}

/**
 * Resolve the full atmosphere for a (time, weather) coordinate.
 * Time sets the base; weather modulates it — so a rainy morning and a rainy
 * dusk are genuinely different, instead of one flat "Rainy Day" grey.
 */
export function sampleAtmosphere(
  hour: number,
  weather: WeatherKind,
  intensity: number,
  world: WorldStyle = 'natural',
  out: AtmosphereSample = createAtmosphereSample(),
): AtmosphereSample {
  const clampedHour = Math.max(0, Math.min(24, hour))
  const keyframes = keyframesByWorld[world] ?? keyframesByWorld.natural

  let i = 0
  while (i < keyframes.length - 2 && clampedHour > keyframes[i + 1].h) {
    i += 1
  }
  const a = keyframes[i]
  const b = keyframes[i + 1]
  const span = b.h - a.h || 1
  const t = Math.max(0, Math.min(1, (clampedHour - a.h) / span))

  out.background.lerpColors(a.cBg, b.cBg, t)
  out.skyTop.lerpColors(a.cTop, b.cTop, t)
  out.skyBottom.lerpColors(a.cBot, b.cBot, t)
  out.hemiSky.lerpColors(a.cHemi, b.cHemi, t)
  out.hemiGround.lerpColors(a.cHemiG, b.cHemiG, t)
  out.sunColor.lerpColors(a.cDir, b.cDir, t)
  out.fogColor.lerpColors(a.cFog, b.cFog, t)
  out.ambientIntensity = lerp(a.amb, b.amb, t)
  out.hemiIntensity = lerp(a.hemiI, b.hemiI, t)
  out.sunIntensity = lerp(a.dirI, b.dirI, t)
  out.fogNear = lerp(a.fogN, b.fogN, t)
  out.fogFar = lerp(a.fogF, b.fogF, t)
  out.starOpacity = lerp(a.star, b.star, t)

  // Sun rides an arc from 06:00 to 18:00
  out.isDay = clampedHour >= 6 && clampedHour <= 18
  out.sunElevation = Math.sin(((clampedHour - 6) / 12) * Math.PI)

  const cloud = Math.max(0, Math.min(1, intensity)) * cloudFactor[weather]
  out.cloudiness = cloud

  if (cloud > 0) {
    // Cloud cover flattens and dims the sky, whatever hour it is
    overcastify(out.background, cloud * 0.72, cloud * 0.3)
    overcastify(out.skyTop, cloud * 0.78, cloud * 0.34)
    overcastify(out.skyBottom, cloud * 0.72, cloud * 0.26)
    overcastify(out.fogColor, cloud * 0.7, cloud * 0.24)
    overcastify(out.hemiSky, cloud * 0.6, cloud * 0.2)

    // Direct sun is blocked; diffuse bounce lifts slightly
    out.sunIntensity *= 1 - cloud * 0.82
    out.ambientIntensity *= 1 + cloud * 0.16
    // Weather closes the view in
    out.fogNear = lerp(out.fogNear, 8, cloud * 0.75)
    out.fogFar = lerp(out.fogFar, 55, cloud * 0.7)
    // Clouds hide the stars
    out.starOpacity *= 1 - cloud
  }

  // Snow brightens the scene back up (high albedo, bright overcast).
  // The neon city keeps more of its own colour.
  if (weather === 'snow' && world !== 'space') {
    const s = Math.max(0, Math.min(1, intensity))
    out.ambientIntensity *= 1 + s * 0.35
    out.background.lerp(new Color('#dce8ef'), s * 0.4 * (out.isDay ? 1 : 0.4))
    out.fogColor.lerp(new Color('#e8f1f4'), s * 0.45 * (out.isDay ? 1 : 0.35))
  }

  return out
}
