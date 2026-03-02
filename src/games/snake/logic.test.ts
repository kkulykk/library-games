import {
  createInitialSnake,
  getNextHead,
  isOutOfBounds,
  collidesWithSelf,
  randomFood,
  isOppositeDirection,
  getSpeed,
  GRID_SIZE,
  INITIAL_SPEED,
} from './logic'

describe('createInitialSnake', () => {
  it('creates a snake of length 3', () => {
    const snake = createInitialSnake()
    expect(snake.length).toBe(3)
  })

  it('starts at the center of the grid', () => {
    const snake = createInitialSnake()
    const mid = Math.floor(GRID_SIZE / 2)
    expect(snake[0].x).toBe(mid)
    expect(snake[0].y).toBe(mid)
  })
})

describe('getNextHead', () => {
  it('moves up correctly', () => {
    const head = { x: 5, y: 5 }
    expect(getNextHead(head, 'UP')).toEqual({ x: 5, y: 4 })
  })

  it('moves down correctly', () => {
    const head = { x: 5, y: 5 }
    expect(getNextHead(head, 'DOWN')).toEqual({ x: 5, y: 6 })
  })

  it('moves left correctly', () => {
    const head = { x: 5, y: 5 }
    expect(getNextHead(head, 'LEFT')).toEqual({ x: 4, y: 5 })
  })

  it('moves right correctly', () => {
    const head = { x: 5, y: 5 }
    expect(getNextHead(head, 'RIGHT')).toEqual({ x: 6, y: 5 })
  })
})

describe('isOutOfBounds', () => {
  it('returns true for negative coordinates', () => {
    expect(isOutOfBounds({ x: -1, y: 5 })).toBe(true)
    expect(isOutOfBounds({ x: 5, y: -1 })).toBe(true)
  })

  it('returns true for coordinates at or beyond grid size', () => {
    expect(isOutOfBounds({ x: GRID_SIZE, y: 5 })).toBe(true)
    expect(isOutOfBounds({ x: 5, y: GRID_SIZE })).toBe(true)
  })

  it('returns false for valid coordinates', () => {
    expect(isOutOfBounds({ x: 0, y: 0 })).toBe(false)
    expect(isOutOfBounds({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 })).toBe(false)
  })
})

describe('collidesWithSelf', () => {
  it('returns true when head overlaps body', () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ]
    expect(collidesWithSelf(snake, { x: 5, y: 6 })).toBe(true)
  })

  it('returns false when head does not overlap body', () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
    ]
    expect(collidesWithSelf(snake, { x: 5, y: 4 })).toBe(false)
  })
})

describe('randomFood', () => {
  it('places food on an empty cell', () => {
    const snake = createInitialSnake()
    const food = randomFood(snake)
    expect(snake.some((p) => p.x === food.x && p.y === food.y)).toBe(false)
  })

  it('places food within bounds', () => {
    const food = randomFood([])
    expect(food.x).toBeGreaterThanOrEqual(0)
    expect(food.x).toBeLessThan(GRID_SIZE)
    expect(food.y).toBeGreaterThanOrEqual(0)
    expect(food.y).toBeLessThan(GRID_SIZE)
  })
})

describe('isOppositeDirection', () => {
  it('detects opposite directions', () => {
    expect(isOppositeDirection('UP', 'DOWN')).toBe(true)
    expect(isOppositeDirection('DOWN', 'UP')).toBe(true)
    expect(isOppositeDirection('LEFT', 'RIGHT')).toBe(true)
    expect(isOppositeDirection('RIGHT', 'LEFT')).toBe(true)
  })

  it('returns false for non-opposite directions', () => {
    expect(isOppositeDirection('UP', 'LEFT')).toBe(false)
    expect(isOppositeDirection('UP', 'RIGHT')).toBe(false)
    expect(isOppositeDirection('UP', 'UP')).toBe(false)
  })
})

describe('getSpeed', () => {
  it('returns initial speed at score 0', () => {
    expect(getSpeed(0)).toBe(INITIAL_SPEED)
  })

  it('returns faster speed as score increases', () => {
    expect(getSpeed(10)).toBeLessThan(getSpeed(0))
  })

  it('does not go below minimum speed of 60ms', () => {
    expect(getSpeed(1000)).toBe(60)
  })
})
