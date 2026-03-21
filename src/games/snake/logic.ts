export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
export type Point = { x: number; y: number }

export const GRID_SIZE = 20
export const INITIAL_SPEED = 150 // ms per tick

export function createInitialSnake(): Point[] {
  const mid = Math.floor(GRID_SIZE / 2)
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ]
}

export function getNextHead(head: Point, direction: Direction): Point {
  switch (direction) {
    case 'UP':
      return { x: head.x, y: head.y - 1 }
    case 'DOWN':
      return { x: head.x, y: head.y + 1 }
    case 'LEFT':
      return { x: head.x - 1, y: head.y }
    case 'RIGHT':
      return { x: head.x + 1, y: head.y }
  }
}

export function isOutOfBounds(point: Point): boolean {
  return point.x < 0 || point.x >= GRID_SIZE || point.y < 0 || point.y >= GRID_SIZE
}

export function collidesWithSelf(snake: Point[], head: Point): boolean {
  return snake.some((p) => p.x === head.x && p.y === head.y)
}

export function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`))
  const empty: Point[] = []
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!occupied.has(`${x},${y}`)) empty.push({ x, y })
    }
  }
  if (empty.length === 0) return { x: 0, y: 0 }
  return empty[Math.floor(Math.random() * empty.length)]
}

export function isOppositeDirection(current: Direction, next: Direction): boolean {
  return (
    (current === 'UP' && next === 'DOWN') ||
    (current === 'DOWN' && next === 'UP') ||
    (current === 'LEFT' && next === 'RIGHT') ||
    (current === 'RIGHT' && next === 'LEFT')
  )
}

export function getSpeed(score: number): number {
  return Math.max(60, INITIAL_SPEED - score * 5)
}
