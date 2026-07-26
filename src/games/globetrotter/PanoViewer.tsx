'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { GeoPano } from './locations'
import { panoCandidates } from './panoTexture'

const COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function yawToDegrees(yaw: number): number {
  return Math.round((((yaw * 180) / Math.PI) % 360) + 360) % 360
}

// Minimal WebGL equirectangular panorama viewer (no dependencies): a
// fullscreen quad whose fragment shader casts a ray per pixel through a
// yaw/pitch/fov camera and samples the 360° image. Drag to look around,
// scroll or pinch to zoom. Wikimedia Commons serves images with CORS headers,
// so the texture upload works cross-origin.
//
// Panoramas are multi-megabyte files, so the download is streamed and its
// progress surfaced — a silent black rectangle reads as a frozen app.

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 vNdc;
void main() {
  vNdc = position;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vNdc;
uniform sampler2D uTex;
uniform float uYaw;
uniform float uPitch;
uniform float uTanHalfFov;
uniform float uAspect;
const float PI = 3.141592653589793;
void main() {
  vec3 d = normalize(vec3(vNdc.x * uAspect * uTanHalfFov, vNdc.y * uTanHalfFov, -1.0));
  float cp = cos(uPitch); float sp = sin(uPitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  float cy = cos(uYaw); float sy = sin(uYaw);
  d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(fract(lon / (2.0 * PI) + 0.5), 0.5 - lat / PI);
  gl_FragColor = texture2D(uTex, uv);
}
`

const MIN_FOV = 30
const MAX_FOV = 100
/** Below this the shrink-and-retry ladder gives up — a 512px sphere is unusable anyway. */
const MIN_TEXTURE_WIDTH = 512

interface Camera {
  yaw: number
  pitch: number
  fov: number
}

interface PanoViewerProps {
  pano: GeoPano
  className?: string
}

type Status = 'loading' | 'ready' | 'error'

/**
 * Stream the panorama so the download can report progress, falling back to a
 * plain <img> load when streaming is unavailable (then progress is unknown).
 */
async function loadPanoramaFrom(
  url: string,
  onProgress: (ratio: number | null) => void,
  signal: AbortSignal
): Promise<TexImageSource> {
  let status: number | null = null
  try {
    const response = await fetch(url, { mode: 'cors', signal })
    if (!response.ok) {
      status = response.status
      throw new Error(`HTTP ${response.status}`)
    }
    const total = Number(response.headers.get('content-length') ?? 0)
    const reader = response.body?.getReader()
    let blob: Blob
    if (reader) {
      const chunks: Uint8Array[] = []
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        onProgress(total > 0 ? Math.min(1, received / total) : null)
      }
      blob = new Blob(chunks as BlobPart[], { type: 'image/jpeg' })
    } else {
      blob = await response.blob()
    }
    onProgress(1)
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(blob)
      } catch {
        // Safari's ImageBitmap decoder gives up on some large JPEGs; the
        // <img> decoder handles them, and is a valid texture source too.
      }
    }
    return await decodeViaImage(URL.createObjectURL(blob), true)
  } catch (error) {
    if (signal.aborted) throw error
    // Streaming can fail where a plain image load still succeeds (proxies,
    // odd CORS setups) — try the simple path before giving up.
    onProgress(null)
    try {
      return await decodeViaImage(url, false)
    } catch {
      // Report what the server said, not the <img> tag's contentless failure.
      throw status === null ? error : new Error(`HTTP ${status}`)
    }
  }
}

/** Walk the renditions cheapest-first; only a fully exhausted list is an error. */
async function loadPanorama(
  urls: string[],
  onProgress: (ratio: number | null) => void,
  signal: AbortSignal
): Promise<TexImageSource> {
  let last: unknown
  for (const url of urls) {
    try {
      return await loadPanoramaFrom(url, onProgress, signal)
    } catch (error) {
      if (signal.aborted) throw error
      last = error
      onProgress(null)
    }
  }
  throw last instanceof Error ? last : new Error('Panorama failed to load')
}

/**
 * Turn a failure into something a player can act on. "It broke" sends people
 * to the Try again button forever; naming the cause tells them whether it is
 * their network, their browser or the archive.
 */
function failureHint(error: unknown): string {
  const status = error instanceof Error ? error.message.match(/^HTTP (\d+)$/)?.[1] : undefined
  if (status) return `Wikimedia answered ${status} for this image.`
  return 'Could not reach upload.wikimedia.org — a content blocker, VPN or restricted network does this.'
}

function decodeViaImage(src: string, revoke: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (revoke) URL.revokeObjectURL(src)
      resolve(image)
    }
    image.onerror = () => {
      if (revoke) URL.revokeObjectURL(src)
      reject(new Error('Panorama failed to load'))
    }
    image.src = src
  })
}

function sourceSize(source: TexImageSource): { width: number; height: number } {
  const width = 'width' in source ? Number(source.width) : 0
  const height = 'height' in source ? Number(source.height) : 0
  return { width, height }
}

/** Redraw a decoded panorama at a smaller size — also normalises the source type. */
function rescale(source: TexImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(width))
  canvas.height = Math.max(1, Math.floor(height))
  canvas.getContext('2d')?.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Upload the panorama, shrinking on failure until it fits.
 *
 * Mobile GPUs reject textures a desktop swallows whole — sometimes by throwing
 * (an `ImageBitmap` the driver will not take), sometimes by quietly raising
 * `OUT_OF_MEMORY`. Both are recoverable at half the size, so try the ladder
 * before calling the round a loss.
 */
function uploadTexture(gl: WebGLRenderingContext, source: TexImageSource): boolean {
  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  const { width, height } = sourceSize(source)
  let upload: TexImageSource = source
  let currentWidth = width
  let currentHeight = height
  if (width > maxSize && width > 0) {
    currentWidth = maxSize
    currentHeight = Math.max(1, Math.round((height * maxSize) / width))
    upload = rescale(source, currentWidth, currentHeight)
  }

  for (;;) {
    // Drain stale errors so the check below is about this upload alone.
    let pending = gl.getError()
    while (pending !== gl.NO_ERROR) pending = gl.getError()
    let threw = false
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload)
    } catch {
      threw = true
    }
    if (!threw && gl.getError() === gl.NO_ERROR) return true
    if (gl.isContextLost()) return false

    // A raw ImageBitmap the driver refuses may still upload once it has been
    // through a 2D canvas, so re-wrap at full size before giving up any pixels.
    if (upload === source && currentWidth > 0) {
      upload = rescale(source, currentWidth, currentHeight)
      continue
    }
    if (currentWidth <= MIN_TEXTURE_WIDTH || currentWidth === 0) return false
    currentWidth = Math.floor(currentWidth / 2)
    currentHeight = Math.max(1, Math.floor(currentHeight / 2))
    upload = rescale(source, currentWidth, currentHeight)
  }
}

export function PanoViewer({ pano, className }: PanoViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({})
  const cameraRef = useRef<Camera>({ yaw: 0, pitch: 0, fov: 75 })
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ distance: number; fov: number } | null>(null)
  const renderRef = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [progress, setProgress] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [dragged, setDragged] = useState(false)
  const [compassDeg, setCompassDeg] = useState(0)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setStatus('loading')
    setProgress(null)
    setHint(null)
    setDragged(false)
    cameraRef.current = { yaw: 0, pitch: 0, fov: 75 }
    pointersRef.current.clear()
    pinchRef.current = null

    // preserveDrawingBuffer keeps the last frame alive across compositing.
    // Without it iOS Safari clears the buffer after each composite and the
    // panorama goes black between drags, since this viewer renders on demand.
    const options: WebGLContextAttributes = {
      antialias: false,
      preserveDrawingBuffer: true,
    }
    const gl = (canvas.getContext('webgl', options) ??
      canvas.getContext('experimental-webgl', options)) as WebGLRenderingContext | null
    if (!gl) {
      setHint('This browser will not give the page a WebGL canvas.')
      setStatus('error')
      return
    }

    function compile(type: number, source: string): WebGLShader | null {
      const shader = gl!.createShader(type)
      if (!shader) return null
      gl!.shaderSource(shader, source)
      gl!.compileShader(shader)
      return shader
    }

    const program = gl.createProgram()
    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!program || !vertex || !fragment) {
      setHint('WebGL would not compile the panorama shader.')
      setStatus('error')
      return
    }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setHint('WebGL would not link the panorama shader.')
      setStatus('error')
      return
    }
    gl.useProgram(program)

    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    uniformsRef.current = {
      uYaw: gl.getUniformLocation(program, 'uYaw'),
      uPitch: gl.getUniformLocation(program, 'uPitch'),
      uTanHalfFov: gl.getUniformLocation(program, 'uTanHalfFov'),
      uAspect: gl.getUniformLocation(program, 'uAspect'),
    }

    let disposed = false
    let textured = false
    const controller = new AbortController()

    function render() {
      const c = canvasRef.current
      if (!c || disposed || !textured || gl!.isContextLost()) return
      // Cap the backing store: a 3× phone would otherwise allocate a buffer
      // several times larger than the panorama can fill.
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.floor(c.clientWidth * dpr))
      const height = Math.max(1, Math.floor(c.clientHeight * dpr))
      if (c.width !== width || c.height !== height) {
        c.width = width
        c.height = height
      }
      gl!.viewport(0, 0, width, height)
      const { yaw, pitch, fov } = cameraRef.current
      const u = uniformsRef.current
      gl!.uniform1f(u.uYaw, yaw)
      gl!.uniform1f(u.uPitch, pitch)
      gl!.uniform1f(u.uTanHalfFov, Math.tan(((fov / 2) * Math.PI) / 180))
      gl!.uniform1f(u.uAspect, width / height)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    }

    const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth
    loadPanorama(
      panoCandidates(pano.url, viewportWidth),
      (ratio) => !disposed && setProgress(ratio),
      controller.signal
    )
      .then((source) => {
        if (disposed || gl.isContextLost()) return
        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        // Non-power-of-two source: clamp + linear, wrap handled by fract() in
        // the shader.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        if (!uploadTexture(gl, source)) {
          setHint('This device could not fit the photosphere in video memory.')
          setStatus('error')
          return
        }
        textured = true
        setStatus('ready')
        render()
        // Some mobile browsers only size the canvas correctly on the frame
        // after layout settles; a second pass costs nothing and avoids a
        // stretched first paint.
        requestAnimationFrame(render)
      })
      .catch((error: unknown) => {
        if (disposed) return
        setHint(failureHint(error))
        setStatus('error')
      })

    renderRef.current = render
    const observer = new ResizeObserver(() => render())
    observer.observe(canvas)
    // Returning to a backgrounded tab discards the drawing buffer on iOS.
    const repaint = () => render()
    document.addEventListener('visibilitychange', repaint)
    window.addEventListener('pageshow', repaint)
    window.addEventListener('orientationchange', repaint)

    return () => {
      disposed = true
      controller.abort()
      observer.disconnect()
      document.removeEventListener('visibilitychange', repaint)
      window.removeEventListener('pageshow', repaint)
      window.removeEventListener('orientationchange', repaint)
      renderRef.current = null
    }
  }, [pano.url, attempt])

  // A phone under memory pressure has its WebGL context taken away; without
  // preventDefault the browser will never offer it back.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onLost = (event: Event) => {
      event.preventDefault()
      setStatus('loading')
      setProgress(null)
    }
    const onRestored = () => setAttempt((n) => n + 1)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [])

  function applyPinch(): boolean {
    const points = [...pointersRef.current.values()]
    if (points.length < 2) {
      pinchRef.current = null
      return false
    }
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    const pinch = pinchRef.current
    if (!pinch) {
      pinchRef.current = { distance, fov: cameraRef.current.fov }
      return true
    }
    if (distance > 0 && pinch.distance > 0) {
      cameraRef.current.fov = Math.max(
        MIN_FOV,
        Math.min(MAX_FOV, (pinch.fov * pinch.distance) / distance)
      )
      renderRef.current?.()
    }
    return true
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    applyPinch()
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const previous = pointersRef.current.get(event.pointerId)
    if (!previous) return
    const next = { x: event.clientX, y: event.clientY }
    pointersRef.current.set(event.pointerId, next)
    if (!dragged) setDragged(true)
    if (applyPinch()) return

    const camera = cameraRef.current
    const rect = event.currentTarget.getBoundingClientRect()
    // Drag sensitivity scales with fov so zoomed-in panning feels natural.
    const radPerPx = (camera.fov * Math.PI) / 180 / Math.max(1, rect.height)
    camera.yaw += (next.x - previous.x) * radPerPx
    camera.pitch += (next.y - previous.y) * radPerPx
    camera.pitch = Math.max(-1.45, Math.min(1.45, camera.pitch))
    setCompassDeg(yawToDegrees(camera.yaw))
    renderRef.current?.()
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(event.pointerId)
    pinchRef.current = null
    applyPinch()
  }

  // Wheel zoom needs preventDefault, so attach non-passively.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const camera = cameraRef.current
      camera.fov = Math.max(
        MIN_FOV,
        Math.min(MAX_FOV, camera.fov * (event.deltaY > 0 ? 1.1 : 1 / 1.1))
      )
      renderRef.current?.()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const dirLabel = COMPASS_DIRS[Math.round(compassDeg / 45) % 8]
  const percent = progress === null ? null : Math.round(progress * 100)

  return (
    <div data-testid="globetrotter-pano" className={cn('gt-pano', className)}>
      {status === 'ready' && (
        <div className="gt-compass mono">
          <span>{dirLabel}</span>
          <span className="gt-compass-deg">{String(compassDeg).padStart(3, '0')}°</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="360° panorama of the mystery location — drag to look around"
        role="img"
      />

      {status === 'loading' && (
        <div className="gt-pano-loading" data-testid="globetrotter-pano-loading">
          <div className="gt-pano-shimmer" aria-hidden="true" />
          <div className="gt-pano-loading-inner">
            <span className="gt-spinner" aria-hidden="true" />
            <span className="mono gt-pano-loading-text">
              Developing film{percent === null ? '' : ` · ${percent}%`}
            </span>
            <span className="gt-pano-bar" role="progressbar" aria-label="Panorama download">
              <span
                className={cn('gt-pano-bar-fill', percent === null && 'is-indeterminate')}
                style={percent === null ? undefined : { width: `${percent}%` }}
              />
            </span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="gt-pano-loading" data-testid="globetrotter-pano-error">
          <div className="gt-pano-loading-inner">
            <span className="mono gt-pano-loading-text">This photosphere would not load.</span>
            {hint && (
              <span className="mono gt-pano-error-hint" data-testid="globetrotter-pano-error-hint">
                {hint}
              </span>
            )}
            <button className="sk-btn sk-btn-sm" type="button" onClick={retry}>
              Try again
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && !dragged && (
        <div className="gt-pano-hint mono">
          <span className="gt-pano-hint-desktop">⇄ Drag to look around · scroll to zoom</span>
          <span className="gt-pano-hint-touch">⇄ Swipe to look · pinch to zoom</span>
        </div>
      )}
      <a className="gt-pano-watermark mono" href={pano.page} target="_blank" rel="noreferrer">
        © {pano.author} · {pano.license} · Wikimedia Commons
      </a>
    </div>
  )
}
