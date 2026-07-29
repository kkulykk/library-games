import {
  ANSWER_HOLD_MS,
  clampView,
  CLOSE_VIEW_WIDTH,
  closeView,
  easeInOut,
  fitPoints,
  GUESS_HOLD_MS,
  lerpView,
  MAX_MERCATOR_LAT,
  pinchView,
  project,
  revealTour,
  tileBox,
  tileKey,
  tileZoom,
  TRAVEL_MS,
  unproject,
  visibleTiles,
  WHEEL_ZOOM_DISTANCE_PX,
  wheelZoomFactor,
  worldView,
  WORLD_SIZE,
  ZOOM_OUT_MS,
  type ViewBox,
} from './mercator'
import { countryShapes } from './countryShapes'

describe('projection', () => {
  it('maps the world onto the square, north up', () => {
    expect(project(0, -180)).toEqual({ x: 0, y: WORLD_SIZE / 2 })
    expect(project(0, 180)).toEqual({ x: WORLD_SIZE, y: WORLD_SIZE / 2 })
    expect(project(0, 0)).toEqual({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 })
    expect(project(60, 0).y).toBeLessThan(WORLD_SIZE / 2)
    expect(project(-60, 0).y).toBeGreaterThan(WORLD_SIZE / 2)
  })

  it('clamps beyond the Mercator limit instead of running to infinity', () => {
    expect(project(90, 0).y).toBeCloseTo(0, 6)
    expect(project(-90, 0).y).toBeCloseTo(WORLD_SIZE, 6)
    expect(project(MAX_MERCATOR_LAT, 0).y).toBeCloseTo(0, 6)
  })

  it('round-trips through unproject', () => {
    for (const [lat, lng] of [
      [48.8566, 2.3522],
      [-33.86, 151.21],
      [64.14, -21.94],
      [0, 0],
    ]) {
      const { x, y } = project(lat, lng)
      const back = unproject(x, y)
      expect(back.lat).toBeCloseTo(lat, 6)
      expect(back.lng).toBeCloseTo(lng, 6)
    }
  })

  it('clamps out-of-range screen coordinates', () => {
    expect(unproject(-50, -50).lng).toBe(-180)
    expect(unproject(-50, -50).lat).toBeCloseTo(MAX_MERCATOR_LAT, 4)
    expect(unproject(WORLD_SIZE + 50, WORLD_SIZE + 50).lng).toBe(180)
    expect(unproject(WORLD_SIZE + 50, WORLD_SIZE + 50).lat).toBeCloseTo(-MAX_MERCATOR_LAT, 4)
  })
})

describe('view box', () => {
  it('gives the default view the full world width at the viewport aspect', () => {
    const view = worldView(2)
    expect(view.w).toBe(WORLD_SIZE)
    expect(view.h).toBe(WORLD_SIZE / 2)
    expect(view.y).toBe(WORLD_SIZE / 4)
  })

  it('keeps the view inside the world when panning', () => {
    const view = clampView({ x: -400, y: -400, w: 64, h: 32 }, 2)
    expect(view.x).toBe(0)
    expect(view.y).toBe(0)
    const far = clampView({ x: 9999, y: 9999, w: 64, h: 32 }, 2)
    expect(far.x).toBe(WORLD_SIZE - 64)
    expect(far.y).toBe(WORLD_SIZE - 32)
  })

  it('centers instead of drifting once the view is bigger than the world', () => {
    const view = clampView({ x: 0, y: 0, w: WORLD_SIZE * 2, h: WORLD_SIZE }, 2)
    expect(view.w).toBe(WORLD_SIZE * 2)
    expect(view.x).toBe(-WORLD_SIZE / 2)
    expect(view.y).toBe(0)
  })

  it('bounds the zoom range', () => {
    const deep = clampView({ x: 0, y: 0, w: 0.0001, h: 0.00005 }, 2)
    expect(deep.w).toBeCloseTo(WORLD_SIZE / 4096, 8)
    expect(deep.h).toBeCloseTo(deep.w / 2, 8)
  })

  it('survives a degenerate aspect ratio', () => {
    expect(clampView({ x: 0, y: 0, w: WORLD_SIZE, h: 1 }, 0).h).toBe(WORLD_SIZE / 2)
    expect(clampView({ x: 0, y: 0, w: WORLD_SIZE, h: 1 }, Number.NaN).h).toBe(WORLD_SIZE / 2)
  })
})

describe('pinchView', () => {
  // A quarter of the world, centred — plenty of room to zoom either way.
  const origin: ViewBox = { x: 64, y: 64, w: 128, h: 64 }
  const centre = { x: 0.5, y: 0.5 }

  it('keeps the world under the fingers as they spread', () => {
    const view = pinchView(origin, { from: centre, to: centre, scale: 2 }, 2)
    expect(view.w).toBeCloseTo(64, 6)
    // The point under the midpoint before the pinch is still under it after.
    expect(view.x + view.w / 2).toBeCloseTo(origin.x + origin.w / 2, 6)
    expect(view.y + view.h / 2).toBeCloseTo(origin.y + origin.h / 2, 6)
  })

  it('zooms out when the fingers close', () => {
    expect(pinchView(origin, { from: centre, to: centre, scale: 0.5 }, 2).w).toBeCloseTo(256, 6)
  })

  it('anchors on the fingers, not the centre of the map', () => {
    const corner = { x: 0.25, y: 0.25 }
    const view = pinchView(origin, { from: corner, to: corner, scale: 2 }, 2)
    expect(view.x + view.w * 0.25).toBeCloseTo(origin.x + origin.w * 0.25, 6)
    expect(view.y + view.h * 0.25).toBeCloseTo(origin.y + origin.h * 0.25, 6)
  })

  it('drags the map when both fingers slide without spreading', () => {
    const view = pinchView(origin, { from: centre, to: { x: 0.75, y: 0.5 }, scale: 1 }, 2)
    expect(view.w).toBeCloseTo(origin.w, 6)
    expect(view.x).toBeCloseTo(origin.x - origin.w * 0.25, 6)
  })

  it('stays inside the world and the zoom limits', () => {
    const edge = pinchView(origin, { from: centre, to: { x: 3, y: 3 }, scale: 1 }, 2)
    expect(edge.x).toBeGreaterThanOrEqual(0)
    expect(edge.y).toBeGreaterThanOrEqual(0)
    const deep = pinchView(origin, { from: centre, to: centre, scale: 1e6 }, 2)
    expect(deep.w).toBeCloseTo(WORLD_SIZE / 4096, 8)
  })

  it('treats a degenerate scale as no zoom rather than collapsing', () => {
    expect(pinchView(origin, { from: centre, to: centre, scale: 0 }, 2).w).toBeCloseTo(origin.w, 6)
    expect(pinchView(origin, { from: centre, to: centre, scale: Number.NaN }, 2).w).toBeCloseTo(
      origin.w,
      6
    )
  })
})

describe('wheelZoomFactor', () => {
  it('zooms in scrolling up and out scrolling down, by the same amount', () => {
    const inward = wheelZoomFactor(-100)
    const outward = wheelZoomFactor(100)
    expect(inward).toBeGreaterThan(1)
    expect(outward).toBeLessThan(1)
    expect(inward * outward).toBeCloseTo(1, 6)
  })

  it('doubles the scale over the nominal scroll distance', () => {
    // Scrolled the way a wheel or a trackpad actually delivers it: in steps
    // inside the per-event cap, which multiply out to the full distance.
    const step = WHEEL_ZOOM_DISTANCE_PX / 3
    const zoomIn = Array.from({ length: 3 }, () => wheelZoomFactor(-step)).reduce(
      (a, b) => a * b,
      1
    )
    expect(zoomIn).toBeCloseTo(2, 6)
    const zoomOut = Array.from({ length: 3 }, () => wheelZoomFactor(step)).reduce(
      (a, b) => a * b,
      1
    )
    expect(zoomOut).toBeCloseTo(0.5, 6)
  })

  it('keeps a single mouse notch to a gentle step', () => {
    // The old per-event 1.4× is what made one flick of a trackpad — a dozen
    // events — dive straight to street level.
    expect(wheelZoomFactor(-100)).toBeLessThan(1.4)
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1.1)
  })

  it('adds up: many small trackpad deltas equal one big one', () => {
    const oneGo = wheelZoomFactor(-60)
    const inSteps = Array.from({ length: 6 }, () => wheelZoomFactor(-10)).reduce((a, b) => a * b, 1)
    expect(inSteps).toBeCloseTo(oneGo, 6)
  })

  it('reads line and page deltas as scroll distance, not as pixels', () => {
    expect(wheelZoomFactor(-3, 1)).toBeGreaterThan(wheelZoomFactor(-3, 0))
    expect(wheelZoomFactor(-1, 2)).toBeGreaterThan(wheelZoomFactor(-1, 1))
  })

  it('caps one enormous event so a notch cannot cross zoom levels', () => {
    expect(wheelZoomFactor(-100000)).toBeLessThanOrEqual(wheelZoomFactor(-180))
    expect(wheelZoomFactor(100000)).toBeGreaterThanOrEqual(wheelZoomFactor(180))
  })

  it('treats a zero or non-finite delta as no zoom', () => {
    expect(wheelZoomFactor(0)).toBe(1)
    expect(wheelZoomFactor(Number.NaN)).toBe(1)
    expect(wheelZoomFactor(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('fitPoints', () => {
  it('frames both the guess and the answer', () => {
    const guess = { lat: 48.85, lng: 2.35 }
    const target = { lat: 51.5, lng: -0.12 }
    const view = fitPoints([guess, target], 2)

    for (const point of [guess, target]) {
      const { x, y } = project(point.lat, point.lng)
      expect(x).toBeGreaterThanOrEqual(view.x)
      expect(x).toBeLessThanOrEqual(view.x + view.w)
      expect(y).toBeGreaterThanOrEqual(view.y)
      expect(y).toBeLessThanOrEqual(view.y + view.h)
    }
    // Two nearby cities should zoom in well past the whole world.
    expect(view.w).toBeLessThan(WORLD_SIZE / 4)
  })

  it('does not collapse on a single point', () => {
    const view = fitPoints([{ lat: 10, lng: 10 }], 2)
    expect(view.w).toBeGreaterThan(0)
    expect(Number.isFinite(view.x)).toBe(true)
  })

  it('falls back to the world when there is nothing to frame', () => {
    expect(fitPoints([], 2)).toEqual(worldView(2))
  })
})

describe('closeView', () => {
  it('centers a street-level box on the point', () => {
    const point = { lat: 48.8566, lng: 2.3522 }
    const view = closeView(point, 1.5)
    const center = project(point.lat, point.lng)

    expect(view.w).toBeCloseTo(CLOSE_VIEW_WIDTH, 8)
    expect(view.h).toBeCloseTo(CLOSE_VIEW_WIDTH / 1.5, 8)
    expect(view.x + view.w / 2).toBeCloseTo(center.x, 8)
    expect(view.y + view.h / 2).toBeCloseTo(center.y, 8)
  })

  it('stays inside the world at the edges of the map', () => {
    for (const point of [
      { lat: 84, lng: -180 },
      { lat: -84, lng: 180 },
    ]) {
      const view = closeView(point, 1.5)
      expect(view.x).toBeGreaterThanOrEqual(0)
      expect(view.y).toBeGreaterThanOrEqual(0)
      expect(view.x + view.w).toBeLessThanOrEqual(WORLD_SIZE)
      expect(view.y + view.h).toBeLessThanOrEqual(WORLD_SIZE)
    }
  })
})

describe('revealTour', () => {
  const target = { lat: 48.85, lng: 2.35 } // Paris
  const far = { lat: -33.86, lng: 151.21 } // Sydney
  const near = { lat: 48.87, lng: 2.4 } // a few km across Paris

  function contains(view: ViewBox, point: { lat: number; lng: number }): boolean {
    const { x, y } = project(point.lat, point.lng)
    return x >= view.x && x <= view.x + view.w && y >= view.y && y <= view.y + view.h
  }

  it('opens tight on the guess, ends framing both pins', () => {
    const steps = revealTour(target, far, [], 1.5)

    expect(steps[0].travelMs).toBe(0)
    expect(steps[0].holdMs).toBe(GUESS_HOLD_MS)
    expect(contains(steps[0].view, far)).toBe(true)
    expect(steps[0].view.w).toBeCloseTo(CLOSE_VIEW_WIDTH, 6)

    const last = steps[steps.length - 1]
    expect(last.travelMs).toBe(ZOOM_OUT_MS)
    expect(contains(last.view, far)).toBe(true)
    expect(contains(last.view, target)).toBe(true)
  })

  it('holds close on the answer before pulling back', () => {
    const steps = revealTour(target, far, [], 1.5)
    const answer = steps[steps.length - 2]

    expect(answer.holdMs).toBe(ANSWER_HOLD_MS)
    expect(answer.view.w).toBeCloseTo(CLOSE_VIEW_WIDTH, 6)
    expect(contains(answer.view, target)).toBe(true)
  })

  it('arcs out over a long distance and pans directly over a short one', () => {
    const long = revealTour(target, far, [], 1.5)
    const short = revealTour(target, near, [], 1.5)

    // The long trip gets an extra keyframe framing both ends of the journey.
    expect(long).toHaveLength(4)
    expect(long[1].view.w).toBeGreaterThan(long[0].view.w)
    expect(short).toHaveLength(3)
    expect(short[1].travelMs).toBe(TRAVEL_MS)
  })

  it('frames every other player in the final pull-back', () => {
    const others = [
      { lat: 64.14, lng: -21.94 },
      { lat: 1.35, lng: 103.82 },
    ]
    const last = revealTour(target, near, others, 1.5).slice(-1)[0]
    for (const point of [target, near, ...others]) {
      expect(contains(last.view, point)).toBe(true)
    }
  })

  it('opens on the answer when the player never guessed', () => {
    const steps = revealTour(target, null, [], 1.5)
    expect(steps).toHaveLength(2)
    expect(steps[0].travelMs).toBe(0)
    expect(steps[0].holdMs).toBe(ANSWER_HOLD_MS)
    expect(contains(steps[0].view, target)).toBe(true)
  })

  it('keeps every keyframe a legal view', () => {
    for (const steps of [
      revealTour(target, far, [], 1.5),
      revealTour({ lat: 84, lng: 179 }, { lat: -84, lng: -179 }, [], 0.6),
    ]) {
      for (const step of steps) {
        expect(step.view).toEqual(clampView(step.view, step.view.w / step.view.h))
        expect(step.view.w).toBeGreaterThan(0)
      }
    }
  })
})

describe('animation helpers', () => {
  it('lerps between two views and clamps the parameter', () => {
    const a = { x: 0, y: 0, w: 100, h: 50 }
    const b = { x: 10, y: 20, w: 50, h: 25 }
    expect(lerpView(a, b, 0)).toEqual(a)
    expect(lerpView(a, b, 1)).toEqual(b)
    expect(lerpView(a, b, 2)).toEqual(b)
    expect(lerpView(a, b, 0.5)).toEqual({ x: 5, y: 10, w: 75, h: 37.5 })
  })

  it('eases in and out symmetrically', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6)
    expect(easeInOut(1)).toBe(1)
    expect(easeInOut(0.25)).toBeLessThan(0.25)
    expect(easeInOut(0.75)).toBeGreaterThan(0.75)
  })
})

describe('tiles', () => {
  it('picks the pyramid level closest to 1:1 pixels', () => {
    expect(tileZoom(worldView(2), 256)).toBe(0)
    expect(tileZoom({ x: 0, y: 0, w: WORLD_SIZE / 4, h: WORLD_SIZE / 8 }, 256)).toBe(2)
    expect(tileZoom({ x: 0, y: 0, w: 0.001, h: 0.0005 }, 1000, 12)).toBe(12)
    expect(tileZoom({ x: 0, y: 0, w: 0, h: 0 }, 256)).toBe(0)
  })

  it('covers the visible box and nothing outside the world', () => {
    expect(visibleTiles(worldView(2), 0)).toEqual([{ z: 0, x: 0, y: 0 }])

    const tiles = visibleTiles({ x: 0, y: 0, w: WORLD_SIZE, h: WORLD_SIZE }, 2)
    expect(tiles).toHaveLength(16)
    expect(tiles.every((tile) => tile.x >= 0 && tile.x < 4 && tile.y >= 0 && tile.y < 4)).toBe(true)

    const corner = visibleTiles({ x: 0, y: 0, w: WORLD_SIZE / 4, h: WORLD_SIZE / 4 }, 2)
    expect(corner).toEqual([{ z: 2, x: 0, y: 0 }])
  })

  it('places a tile at the right spot in world coordinates', () => {
    expect(tileBox({ z: 0, x: 0, y: 0 })).toEqual({ x: 0, y: 0, w: 256, h: 256 })
    expect(tileBox({ z: 2, x: 3, y: 1 })).toEqual({ x: 192, y: 64, w: 64, h: 64 })
    expect(tileKey({ z: 2, x: 3, y: 1 })).toBe('2/3/1')
  })
})

describe('country shapes', () => {
  it('projects every country into a drawable path with a label anchor', () => {
    const shapes = countryShapes()
    expect(shapes.length).toBeGreaterThan(150)

    for (const shape of shapes) {
      expect(shape.d.startsWith('M')).toBe(true)
      expect(shape.d.endsWith('Z')).toBe(true)
      expect(Number.isFinite(shape.label.x)).toBe(true)
      expect(Number.isFinite(shape.label.y)).toBe(true)
      expect(shape.extent).toBeGreaterThanOrEqual(0)
    }
  })

  it('memoizes the projection work', () => {
    expect(countryShapes()).toBe(countryShapes())
  })

  it('flags countries that straddle the antimeridian so they can be redrawn', () => {
    const shapes = countryShapes()
    const russia = shapes.find((shape) => shape.name === 'Russia')
    expect(russia?.wraps).toBe(true)
    expect(shapes.find((shape) => shape.name === 'France')?.wraps).toBe(false)
  })

  it('anchors labels near the country they name', () => {
    const shapes = countryShapes()
    const france = shapes.find((shape) => shape.name === 'France')!
    const paris = project(46.5, 2.5)
    expect(Math.abs(france.label.x - paris.x)).toBeLessThan(6)
    expect(Math.abs(france.label.y - paris.y)).toBeLessThan(6)
  })
})
