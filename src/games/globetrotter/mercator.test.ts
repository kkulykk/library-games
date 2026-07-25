import {
  clampView,
  easeInOut,
  fitPoints,
  lerpView,
  MAX_MERCATOR_LAT,
  project,
  tileBox,
  tileKey,
  tileZoom,
  unproject,
  visibleTiles,
  worldView,
  WORLD_SIZE,
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
