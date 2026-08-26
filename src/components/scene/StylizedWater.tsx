import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, ShaderMaterial } from 'three'
import {
  createAtmosphereSample,
  sampleAtmosphere,
} from '../../data/atmosphere'
import { windUniforms } from '../../data/wind'
import { useSceneStore } from '../../store/sceneStore'

// River centreline as [x, z, halfWidth, halfLength, rotation] blobs.
export type WaterBlob = [number, number, number, number, number]

/** Body colour of the water itself, before the sky is mixed in. */
const bodyDeep = new Color('#0d4a4e')
const bodyShallow = new Color('#4fb8a6')
const white = new Color('#ffffff')

const vertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying float vViewY;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vec3 viewDir = normalize(cameraPosition - wp.xyz);
    vViewY = viewDir.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying float vViewY;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHighlight;
  uniform float uOpacity;
  uniform float uChoppy;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 p = vWorldPos.xz;
    float t = uTime;

    // Layered travelling ripples in world space (seamless across meshes)
    float w1 = sin(p.x * 1.25 + t * 1.35);
    float w2 = sin(p.y * 1.7 - t * 1.05 + p.x * 0.5);
    float w3 = sin((p.x + p.y) * 2.3 + t * 1.9);
    float ripple = ((w1 + w2 + w3) / 3.0) * 0.5 + 0.5;

    // Drifting surface noise for texture and sparkle
    float nBase = noise(p * 2.4 + vec2(t * 0.22, -t * 0.16));
    float nFine = noise(p * 6.5 - vec2(t * 0.45, t * 0.3));
    float sparkle = smoothstep(0.84, 1.0, nFine * (0.45 + 0.55 * ripple));

    // Fresnel: at grazing angles you see the sky, looking down you see depth
    float fres = pow(1.0 - clamp(abs(vViewY), 0.0, 1.0), 3.0);

    vec3 col = mix(uDeep, uShallow, clamp(ripple * 0.7 + nBase * 0.25, 0.0, 1.0));
    col = mix(col, uHighlight, fres * 0.5);
    col += uHighlight * sparkle * (0.7 + 0.4 * uChoppy);

    // Distance out from the middle of the channel, 0 at the centre line and
    // 1 at the bank. Each river blob is an ellipse, so its own UVs give this
    // for free without needing to know where the terrain is.
    float toBank = clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0);

    // Foam gathers in a band just short of the bank, broken up by the same
    // drifting noise so it churns instead of sitting as a clean ring
    float foamBand = smoothstep(0.62, 0.93, toBank) * (1.0 - smoothstep(0.93, 1.0, toBank));
    float foam = foamBand * smoothstep(0.35, 0.85, nFine * 0.6 + ripple * 0.55);
    col = mix(col, vec3(0.92, 0.97, 0.97), foam * 0.75);

    // Shallows go clear at the edge so grass and stones read through
    float shallowFade = 1.0 - smoothstep(0.72, 1.0, toBank) * 0.72;

    float alpha = (uOpacity + fres * 0.28 + sparkle * 0.3) * shallowFade + foam * 0.5;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`

function makeWaterMaterial(opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: bodyDeep.clone() },
      uShallow: { value: bodyShallow.clone() },
      uHighlight: { value: white.clone() },
      uOpacity: { value: opacity },
      uChoppy: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  })
}

/**
 * Water that reflects the live sky. Colour is derived from the current
 * atmosphere sample every frame — so the river turns gold at sunset and deep
 * blue at midnight without any per-preset table — and its surface roughens
 * with the shared wind.
 */
export function useWaterMaterial(opacity = 0.82) {
  const material = useMemo(() => makeWaterMaterial(opacity), [opacity])
  const sample = useMemo(() => createAtmosphereSample(), [])

  useFrame(({ clock }) => {
    const state = useSceneStore.getState()
    sampleAtmosphere(
      state.timeOfDay,
      state.weather,
      state.weatherIntensity,
      state.worldStyle,
      sample,
    )

    // How bright the sky is right now drives how lit the water body reads
    const sky = sample.skyBottom
    const skyLuminance = sky.r * 0.299 + sky.g * 0.587 + sky.b * 0.114

    const deep = material.uniforms.uDeep.value as Color
    const shallow = material.uniforms.uShallow.value as Color
    const highlight = material.uniforms.uHighlight.value as Color

    // Depth: the body colour, dimmed to match the ambient light level
    deep.copy(bodyDeep).multiplyScalar(0.5 + skyLuminance * 0.95)
    // Surface: mostly the reflected sky, pulled toward water's own hue
    shallow.copy(sky).lerp(bodyShallow, 0.3)
    // Specular glints take the colour of whatever is lighting the scene
    highlight.copy(sample.sunColor).lerp(white, 0.25)

    // Wind roughens the surface and speeds the flow
    const windStrength = windUniforms.uWindStrength.value
    material.uniforms.uChoppy.value = 0.85 + windStrength * 2.2
    material.uniforms.uTime.value =
      clock.elapsedTime * (1.15 + windStrength * 1.6)
  })

  return material
}

/**
 * Flowing river rendered as overlapping soft discs sharing one animated
 * shader. World-space ripples keep the surface seamless across the discs.
 */
export function RiverWater({
  blobs,
  y = 0.028,
}: {
  blobs: WaterBlob[]
  y?: number
}) {
  const material = useWaterMaterial(0.82)

  return (
    <group raycast={() => null}>
      {blobs.map(([x, z, halfWidth, halfLength, rotation], index) => (
        <mesh
          key={`river-water-${index}`}
          position={[x, y + index * 0.0004, z]}
          rotation={[-Math.PI / 2, 0, rotation]}
          scale={[halfWidth, halfLength, 1]}
          material={material}
          raycast={() => null}
        >
          <circleGeometry args={[1, 40]} />
        </mesh>
      ))}
    </group>
  )
}

/** Single elliptical body of water (ponds / lakes / placed water assets). */
export function PondWater({
  radius = 0.75,
  segments = 40,
  y = 0.03,
  opacity = 0.85,
}: {
  radius?: number
  segments?: number
  y?: number
  opacity?: number
}) {
  const material = useWaterMaterial(opacity)

  return (
    <mesh
      position={[0, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      raycast={() => null}
    >
      <circleGeometry args={[radius, segments]} />
    </mesh>
  )
}
