'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { MutableRefObject } from 'react'
import { ConeGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three'
import type { Material, Object3D } from 'three'
import type { GlobeMethods, GlobeProps } from 'react-globe.gl'
import { cn } from '@/lib/utils'

// react-globe.gl renders to WebGL and touches `window`, so it can only load in
// the browser. `next/dynamic` strips `ref`, hence the `globeRef` pass-through prop.
type GlobeWithRefProps = GlobeProps & {
  globeRef: MutableRefObject<GlobeMethods | undefined>
}

const Globe = dynamic(
  () =>
    import('react-globe.gl').then((mod) => {
      const GlobeGl = mod.default
      function GlobeWithRef({ globeRef, ...props }: GlobeWithRefProps) {
        return <GlobeGl {...props} ref={globeRef} />
      }
      return GlobeWithRef
    }),
  { ssr: false },
)

// Natural Earth 1:110m country boundaries (self-hosted copy of
// https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson)
const GEOJSON_URL = '/countries.geojson'

// All palette knobs in one place for visual fine-tuning later.
// NOTE: `ocean`/`oceanEmissive` feed a three.js material, which only parses
// 3- or 6-digit hex — no alpha suffix. Use `oceanOpacity` for translucency.
const COLORS = {
  ocean: '#0c3e76',
  oceanOpacity: .9, // the "b7" alpha from the original #266ec1b7
  oceanEmissive: '#082147',
  mutedCap: 'rgba(201, 229, 235, 0.16)',
  mutedSide: 'rgba(201, 229, 235, 0.03)',
  mutedStroke: 'rgba(201, 229, 235, 0.28)',
  // Highlighted countries pulse between these two.
  highlightFrom: '#3cb6b2',
  highlightTo: '#8fe8dc',
  // Cap color while the cursor is on a highlighted country.
  highlightHover: '#0a2a55',
  highlightSide: 'rgba(25, 157, 152, 0.35)',
  highlightStroke: 'rgb(19, 2, 2)',
  marker: '#ff0000',
  ring: (t: number) => `rgba(246, 185, 59, ${(0.55 * Math.max(0, 1 - t)).toFixed(3)})`,
  atmosphere: '#ffffff',
} as const

const PULSE_PERIOD_MS = 2600
const PULSE_FRAME_MS = 50 // ~20fps is plenty for a slow color pulse
const RESUME_DELAY_MS = 3500
const AUTO_ROTATE_SPEED = 0.55
const MUTED_ALTITUDE = 0.006
const HIGHLIGHT_ALTITUDE = 0.01
const HIGHLIGHT_HOVER_ALTITUDE = 0.09
const MARKER_ALTITUDE = 0.0
const MARKER_RADIUS = 0.0
const GLOBE_RADIUS = 100
const PIN_HEIGHT = 3.2
const PIN_RADIUS = 0.95
const PIN_HEAD_RADIUS = 1.05
const RING_MAX_RADIUS_DEG = 4.5
const RING_SPEED_DEG_S = 1.6
// Width of the highlighted-country outline, in screen pixels (three-globe
// feeds pathStroke straight into LineMaterial.linewidth). The polygon layer's
// own stroke is stuck at 1px (WebGL line limitation), so the thick outline is
// drawn as a paths layer following each country's border rings.
const HIGHLIGHT_OUTLINE_WIDTH_PX = 1
const INITIAL_POV = { lat: 6, lng: 2, altitude: 1.9 } // centered on the Gulf of Guinea

interface CountryFeature {
  type: 'Feature'
  properties: {
    ADMIN: string
    NAME: string
    ISO_A2?: string
    ISO_A3?: string
    ADM0_A3?: string
    [key: string]: unknown
  }
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
}

interface OutlinePath {
  __outline: true
  points: [number, number, number][] // [lat, lng, altitude]
}

export interface GlobeMarker {
  lat: number
  lng: number
  name: string
  /** Second tooltip line. Country markers default to the children-supported line. */
  subtitle?: string
  /** Per-marker overrides so standalone pins stay visible even when the country pin size is zeroed. */
  radius?: number
  altitude?: number
  markerType?: 'cylinder' | 'pin'
}

export interface HighlightedCountry {
  name: string
  isoCode: string | null
}

/** Signed-area centroid of a GeoJSON ring (planar approximation, fine for pin placement). */
function ringCentroid(ring: number[][]): { lat: number; lng: number } {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    const cross = x1 * y2 - x2 * y1
    area += cross
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  if (Math.abs(area) < 1e-9) {
    const lng = ring.reduce((sum, p) => sum + p[0], 0) / ring.length
    const lat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length
    return { lat, lng }
  }
  area /= 2
  return { lng: cx / (6 * area), lat: cy / (6 * area) }
}

/** Centroid of a country's largest polygon ring (its main landmass). */
function countryCentroid(feature: CountryFeature): { lat: number; lng: number } {
  const outerRings =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates[0]]
      : feature.geometry.coordinates.map((polygon) => polygon[0])
  const largest = outerRings.reduce((a, b) => (b.length > a.length ? b : a))
  return ringCentroid(largest)
}

// Country names and counts can come from admin-editable DB rows, and this string is
// rendered via a raw innerHTML tooltip (float-tooltip's `.html()`), not React — so it
// must be escaped by hand or it's a stored-XSS vector on this public, unauthenticated page.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function lerpHexColor(from: string, to: string, t: number): string {
  const f = parseInt(from.slice(1), 16)
  const g = parseInt(to.slice(1), 16)
  const channel = (shift: number) => {
    const a = (f >> shift) & 0xff
    const b = (g >> shift) & 0xff
    return Math.round(a + (b - a) * t)
  }
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

const EMPTY_MARKERS: GlobeMarker[] = []

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  us: 'united states of america',
  usa: 'united states of america',
  'u.s.': 'united states of america',
  'u.s.a.': 'united states of america',
  'united states': 'united states of america',
}

function normalizeCountryName(name: string): string {
  const normalized = name.trim().toLowerCase()
  return COUNTRY_NAME_ALIASES[normalized] ?? normalized
}

function normalizeCountryCode(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase()
  return normalized ? normalized : null
}

function latLngToCartesian(lat: number, lng: number, altitude = 0): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (90 - lng) * (Math.PI / 180)
  const radius = GLOBE_RADIUS * (1 + altitude)
  const phiSin = Math.sin(phi)
  return new Vector3(
    radius * phiSin * Math.cos(theta),
    radius * Math.cos(phi),
    radius * phiSin * Math.sin(theta),
  )
}

export interface AfricaGlobeProps {
  /** Countries to highlight. `isoCode` should be ISO-3166 alpha-2 or alpha-3 when available. */
  highlightedCountries: HighlightedCountry[]
  /** Standalone pins (e.g. the US home base) shown in addition to country markers. */
  extraMarkers?: GlobeMarker[]
  className?: string
}

export default function AfricaGlobe({
  highlightedCountries,
  extraMarkers,
  className,
}: AfricaGlobeProps) {
  const extras = extraMarkers ?? EMPTY_MARKERS
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reducedMotionRef = useRef(false)

  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [hovered, setHovered] = useState<CountryFeature | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [glow, setGlow] = useState(0.5)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [globeMaterial, setGlobeMaterial] = useState<Material>()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = (matches: boolean) => {
      setReducedMotion(matches)
      reducedMotionRef.current = matches
      const controls = globeRef.current?.controls()
      if (controls) controls.autoRotate = !matches && controls.autoRotate
    }
    apply(query.matches)
    const onChange = (event: MediaQueryListEvent) => apply(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // Track container size so the canvas resizes with its flex/grid parent.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch(GEOJSON_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`country boundaries request failed: ${res.status}`)
        return res.json()
      })
      .then((geojson: { features: CountryFeature[] }) => {
        setCountries(geojson.features.filter((f) => f.properties.ADMIN !== 'Antarctica'))
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('AfricaGlobe: could not load country boundaries', err)
        }
      })
    return () => controller.abort()
  }, [])

  // The sphere material is loaded lazily so `three` stays out of the page's
  // initial bundle (it's shared with the react-globe.gl chunk).
  useEffect(() => {
    let cancelled = false
    import('three').then(({ MeshPhongMaterial }) => {
      if (cancelled) return
      setGlobeMaterial(
        new MeshPhongMaterial({
          color: COLORS.ocean,
          emissive: COLORS.oceanEmissive,
          emissiveIntensity: 0.4,
          transparent: COLORS.oceanOpacity < 1,
          opacity: COLORS.oceanOpacity,
        }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Slow sine pulse driving the highlight color. Altitude stays static per tick —
  // animating it would re-extrude every polygon each frame.
  useEffect(() => {
    if (reducedMotion) return
    let frame: number
    let last = 0
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      if (now - last < PULSE_FRAME_MS) return
      last = now
      setGlow((Math.sin((now / PULSE_PERIOD_MS) * Math.PI * 2) + 1) / 2)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [reducedMotion])

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
    }
  }, [])

  const highlightSet = useMemo(
    () => new Set(highlightedCountries.map((country) => normalizeCountryName(country.name))),
    [highlightedCountries],
  )
  const highlightCodeSet = useMemo(
    () =>
      new Set(
        highlightedCountries
          .map((country) => normalizeCountryCode(country.isoCode))
          .filter((code): code is string => Boolean(code)),
      ),
    [highlightedCountries],
  )

  const isHighlighted = useCallback(
    (feature: CountryFeature) => {
      const featureCodes = [
        normalizeCountryCode(feature.properties.ISO_A2),
        normalizeCountryCode(feature.properties.ISO_A3),
        normalizeCountryCode(feature.properties.ADM0_A3),
      ]
      return (
        featureCodes.some((code) => code !== null && highlightCodeSet.has(code)) ||
        highlightSet.has(normalizeCountryName(feature.properties.ADMIN)) ||
        highlightSet.has(normalizeCountryName(feature.properties.NAME))
      )
    },
    [highlightCodeSet, highlightSet],
  )

  const markers = useMemo<GlobeMarker[]>(
    () => [
      ...countries
        .filter(isHighlighted)
        .map((feature) => ({ ...countryCentroid(feature), name: feature.properties.ADMIN })),
      ...extras.filter((marker) => marker.markerType !== 'pin'),
    ],
    [countries, isHighlighted, extras],
  )

  const pinMarkers = useMemo(
    () => extras.filter((marker) => marker.markerType === 'pin'),
    [extras],
  )

  // Border rings of highlighted countries, drawn as paths so they can be
  // thicker than the polygon layer's 1px stroke. Rebuilt on hover so the
  // outline rises with its raised country cap.
  const outlinePaths = useMemo<OutlinePath[]>(
    () =>
      countries.filter(isHighlighted).flatMap((feature) => {
        const alt =
          (feature === hovered ? HIGHLIGHT_HOVER_ALTITUDE : HIGHLIGHT_ALTITUDE) + 0.002
        const polygons =
          feature.geometry.type === 'Polygon'
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates
        return polygons.flatMap((rings) =>
          rings.map(
            (ring): OutlinePath => ({
              __outline: true,
              points: ring.map(([lng, lat]) => [lat, lng, alt]),
            }),
          ),
        )
      }),
    [countries, isHighlighted, hovered],
  )

  const pauseRotation = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    const controls = globeRef.current?.controls()
    if (controls) controls.autoRotate = false
  }, [])

  const scheduleResume = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => {
      if (reducedMotionRef.current) return
      const controls = globeRef.current?.controls()
      if (controls) controls.autoRotate = true
    }, RESUME_DELAY_MS)
  }, [])

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return
    globe.pointOfView(INITIAL_POV, 0)
    const controls = globe.controls()
    controls.autoRotate = !reducedMotionRef.current
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED
    controls.enableZoom = false // keep page scroll usable over the globe
    controls.addEventListener('start', pauseRotation)
    controls.addEventListener('end', scheduleResume)
    setReady(true)
  }, [pauseRotation, scheduleResume])

  const handlePolygonHover = useCallback(
    (polygon: object | null) => {
      const feature = polygon as CountryFeature | null
      const active = feature && isHighlighted(feature) ? feature : null
      setHovered(active)
      // Hold still while someone reads a tooltip; drift onward after they leave.
      if (active) pauseRotation()
      else scheduleResume()
    },
    [isHighlighted, pauseRotation, scheduleResume],
  )

  const tooltipHtml = useCallback(
    (name: string, subtitle?: string) => {
      const safeName = escapeHtml(name)
      const safeSubtitle = subtitle ? escapeHtml(subtitle) : ''
      return `
        <div style="position: relative; min-width: 0; overflow: hidden; border: 1px solid rgba(143, 232, 220, 0.34); border-left: 2px solid #8fe8dc; border-radius: 9px; background: rgba(12, 31, 58, 0.94); color: #f8f8fa; padding: 7px 10px 8px; font-family: inherit; line-height: 1.3; box-shadow: 0 8px 22px rgba(0, 8, 24, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08); backdrop-filter: blur(10px); white-space: nowrap;">
          <div style="display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 750; letter-spacing: 0.01em;">
            <span aria-hidden="true" style="display: inline-block; width: 6px; height: 6px; flex: 0 0 6px; border-radius: 999px; background: #8fe8dc; box-shadow: 0 0 0 2px rgba(143, 232, 220, 0.14);"></span>
            <span>${safeName}</span>
          </div>
          ${safeSubtitle ? `<div style="margin-top: 5px; border-top: 1px solid rgba(201, 229, 235, 0.16); padding-top: 5px; color: #b9d3e3; font-size: 10px; font-weight: 600; letter-spacing: 0.02em;">${safeSubtitle}</div>` : ''}
        </div>`
    },
    [],
  )

  // Only this accessor depends on the pulse — the others keep a stable identity
  // across ticks so globe.gl doesn't recompute geometry 20 times a second.
  const effectiveGlow = reducedMotion ? 0.5 : glow

  const capColor = useCallback(
    (feature: object) => {
      if (!isHighlighted(feature as CountryFeature)) return COLORS.mutedCap
      if (feature === hovered) return COLORS.highlightHover
      return lerpHexColor(COLORS.highlightFrom, COLORS.highlightTo, effectiveGlow)
    },
    [isHighlighted, hovered, effectiveGlow],
  )

  const sideColor = useCallback(
    (feature: object) =>
      isHighlighted(feature as CountryFeature) ? COLORS.highlightSide : COLORS.mutedSide,
    [isHighlighted],
  )

  const strokeColor = useCallback(
    (feature: object) =>
      isHighlighted(feature as CountryFeature) ? COLORS.highlightStroke : COLORS.mutedStroke,
    [isHighlighted],
  )

  const polygonAltitude = useCallback(
    (feature: object) => {
      if (!isHighlighted(feature as CountryFeature)) return MUTED_ALTITUDE
      return feature === hovered ? HIGHLIGHT_HOVER_ALTITUDE : HIGHLIGHT_ALTITUDE
    },
    [isHighlighted, hovered],
  )

  const polygonLabel = useCallback(
    (feature: object) => {
      const country = feature as CountryFeature
      return isHighlighted(country) ? tooltipHtml(country.properties.ADMIN) : ''
    },
    [isHighlighted, tooltipHtml],
  )

  const pointLabel = useCallback(
    (marker: object) => {
      const { name, subtitle } = marker as GlobeMarker
      return tooltipHtml(name, subtitle)
    },
    [tooltipHtml],
  )

  const markerColor = useCallback(() => COLORS.marker, [])
  const ringColor = useCallback(() => COLORS.ring, [])
  const markerAltitude = useCallback(
    (marker: object) => (marker as GlobeMarker).altitude ?? MARKER_ALTITUDE,
    [],
  )
  const markerRadius = useCallback(
    (marker: object) => (marker as GlobeMarker).radius ?? MARKER_RADIUS,
    [],
  )

  const createPin = useCallback(() => {
    const pin = new Group()
    const material = new MeshBasicMaterial({ color: COLORS.marker })
    const stem = new Mesh(new ConeGeometry(PIN_RADIUS, PIN_HEIGHT, 20), material)
    stem.rotation.z = Math.PI
    stem.position.y = PIN_HEIGHT / 2
    pin.add(stem)

    const head = new Mesh(new SphereGeometry(PIN_HEAD_RADIUS, 20, 12), material)
    head.position.y = PIN_HEIGHT + PIN_HEAD_RADIUS * 0.65
    pin.add(head)
    return pin
  }, [])

  const updatePin = useCallback((object: Object3D, data: object) => {
    const marker = data as GlobeMarker
    const position = latLngToCartesian(marker.lat, marker.lng, marker.altitude ?? 0.002)
    object.position.copy(position)
    object.quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      position.clone().normalize(),
    )
  }, [])

  const outlineColor = useCallback(() => COLORS.highlightStroke, [])
  const outlinePointLat = useCallback((point: unknown) => (point as number[])[0], [])
  const outlinePointLng = useCallback((point: unknown) => (point as number[])[1], [])
  const outlinePointAlt = useCallback((point: unknown) => (point as number[])[2], [])
  // Keep the outline tubes from stealing hover/tooltips at country borders.
  const pointerEventsFilter = useCallback(
    (_obj: object, data?: object) => !(data && '__outline' in data),
    [],
  )

  const countryList = highlightedCountries.map((country) => country.name).join(', ')

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Interactive globe highlighting the countries where we operate: ${countryList}`}
      className={cn('relative overflow-hidden', className)}
    >
      {size.width > 0 && size.height > 0 && (
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Globe
            globeRef={globeRef}
            width={size.width}
            height={size.height}
            backgroundColor="rgba(0,0,0,0)"
            globeMaterial={globeMaterial}
            showAtmosphere
            atmosphereColor={COLORS.atmosphere}
            atmosphereAltitude={0.18}
            polygonsData={countries}
            polygonCapColor={capColor}
            polygonSideColor={sideColor}
            polygonStrokeColor={strokeColor}
            polygonAltitude={polygonAltitude}
            polygonsTransitionDuration={0}
            polygonLabel={polygonLabel}
            onPolygonHover={handlePolygonHover}
            pointsData={markers}
            pointLat="lat"
            pointLng="lng"
            pointColor={markerColor}
            pointAltitude={markerAltitude}
            pointRadius={markerRadius}
            pointLabel={pointLabel}
            customLayerData={pinMarkers}
            customThreeObject={createPin}
            customThreeObjectUpdate={updatePin}
            customLayerLabel={pointLabel}
            pathsData={outlinePaths}
            pathPoints="points"
            pathPointLat={outlinePointLat}
            pathPointLng={outlinePointLng}
            pathPointAlt={outlinePointAlt}
            pathColor={outlineColor}
            pathStroke={HIGHLIGHT_OUTLINE_WIDTH_PX}
            pathTransitionDuration={0}
            pointerEventsFilter={pointerEventsFilter}
            ringsData={reducedMotion ? [] : markers}
            ringLat="lat"
            ringLng="lng"
            ringColor={ringColor}
            ringMaxRadius={RING_MAX_RADIUS_DEG}
            ringPropagationSpeed={RING_SPEED_DEG_S}
            ringRepeatPeriod={PULSE_PERIOD_MS}
            onGlobeReady={handleGlobeReady}
          />
        </div>
      )}
    </div>
  )
}
