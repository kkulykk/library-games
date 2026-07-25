'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { GeoPano } from './locations'

const COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function yawToDegrees(yaw: number): number {
  return Math.round((((yaw * 180) / Math.PI) % 360) + 360) % 360
}

// Minimal WebGL equirectangular panorama viewer (no dependencies): a
// fullscreen quad whose fragment shader casts a ray per pixel through a
// yaw/pitch/fov camera and samples the 360° image. Drag to look around,
// scroll to zoom. Wikimedia Commons serves images with CORS headers, so the
// texture upload works cross-origin.

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

export function PanoViewer({ pano, className }: PanoViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({})
  const cameraRef = useRef<Camera>({ yaw: 0, pitch: 0, fov: 75 })
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const renderRef = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [dragged, setDragged] = useState(false)
  const [compassDeg, setCompassDeg] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setStatus('loading')
    setDragged(false)
    cameraRef.current = { yaw: 0, pitch: 0, fov: 75 }

    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false })
    if (!gl) {
      setStatus('error')
      return
    }
    glRef.current = gl

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
      setStatus('error')
      return
    }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
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

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (disposed) return
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      // Non-power-of-two source: clamp + linear, wrap handled by fract() in
      // the shader. Downscale first if the GPU cannot take the full image.
      const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      let source: TexImageSource = image
      if (image.width > maxSize) {
        const scale = maxSize / image.width
        const offscreen = document.createElement('canvas')
        offscreen.width = Math.floor(image.width * scale)
        offscreen.height = Math.floor(image.height * scale)
        offscreen.getContext('2d')?.drawImage(image, 0, 0, offscreen.width, offscreen.height)
        source = offscreen
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      setStatus('ready')
      render()
    }
    image.onerror = () => {
      if (!disposed) setStatus('error')
    }
    image.src = pano.url

    function render() {
      const c = canvasRef.current
      if (!c || disposed) return
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

    renderRef.current = render
    const observer = new ResizeObserver(() => render())
    observer.observe(canvas)

    return () => {
      disposed = true
      observer.disconnect()
      renderRef.current = null
      glRef.current = null
    }
  }, [pano.url])

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const camera = cameraRef.current
    const rect = event.currentTarget.getBoundingClientRect()
    // Drag sensitivity scales with fov so zoomed-in panning feels natural.
    const radPerPx = (camera.fov * Math.PI) / 180 / rect.height
    camera.yaw += (event.clientX - drag.x) * radPerPx
    camera.pitch += (event.clientY - drag.y) * radPerPx
    camera.pitch = Math.max(-1.45, Math.min(1.45, camera.pitch))
    drag.x = event.clientX
    drag.y = event.clientY
    if (!dragged) setDragged(true)
    setCompassDeg(yawToDegrees(camera.yaw))
    renderRef.current?.()
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
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

  if (status === 'error') return null

  const dirLabel = COMPASS_DIRS[Math.round(compassDeg / 45) % 8]

  return (
    <div data-testid="globetrotter-pano" className={cn('gt-pano', className)}>
      <div className="gt-compass mono">
        <span>{dirLabel}</span>
        <span className="gt-compass-deg">{String(compassDeg).padStart(3, '0')}°</span>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label="360° panorama of the mystery location — drag to look around"
        role="img"
      />
      {status === 'loading' && <div className="gt-pano-loading mono">Developing film…</div>}
      {status === 'ready' && !dragged && (
        <div className="gt-pano-hint mono">⇄ Drag to look around · scroll to zoom</div>
      )}
      <a className="gt-pano-watermark mono" href={pano.page} target="_blank" rel="noreferrer">
        © {pano.author} · {pano.license} · Wikimedia Commons
      </a>
    </div>
  )
}
