'use client'

import { useState, useCallback } from 'react'
import {
  generatePuzzle,
  isValidPlacement,
  isBoardComplete,
  type SudokuGrid,
  type Difficulty,
} from './logic'
import { cn } from '@/lib/utils'

export function SudokuGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [userGrid, setUserGrid] = useState<SudokuGrid>(() => generatePuzzle('easy').puzzle)
  const [lockedCells, setLockedCells] = useState<boolean[][]>(() =>
    generatePuzzle('easy').puzzle.map((row) => row.map((cell) => cell !== null))
  )
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [won, setWon] = useState(false)
  const [errors, setErrors] = useState<Set<string>>(new Set())

  const startGame = useCallback((diff: Difficulty) => {
    setDifficulty(diff)
    const { puzzle } = generatePuzzle(diff)
    setUserGrid(puzzle.map((row) => [...row]))
    setLockedCells(puzzle.map((row) => row.map((cell) => cell !== null)))
    setSelected(null)
    setWon(false)
    setErrors(new Set())
  }, [])

  const handleCellClick = (row: number, col: number) => {
    if (lockedCells[row][col]) return
    setSelected([row, col])
  }

  const handleNumberInput = useCallback(
    (num: number | null) => {
      if (!selected || won) return
      const [row, col] = selected
      if (lockedCells[row][col]) return

      const newGrid = userGrid.map((r) => [...r])
      newGrid[row][col] = num

      const newErrors = new Set(errors)
      const key = `${row}-${col}`
      if (
        num !== null &&
        !isValidPlacement(
          newGrid
            .map((r) => [...r])
            .map((r, ri) => r.map((v, ci) => (ri === row && ci === col ? null : v))),
          row,
          col,
          num
        )
      ) {
        newErrors.add(key)
      } else {
        newErrors.delete(key)
      }

      setUserGrid(newGrid)
      setErrors(newErrors)
      if (isBoardComplete(newGrid) && newErrors.size === 0) setWon(true)
    },
    [selected, won, lockedCells, userGrid, errors]
  )

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {/* Difficulty selector */}
      <div className="flex gap-2">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => startGame(d)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
              difficulty === d
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {won && (
        <div className="rounded-lg bg-emerald-100 px-4 py-2 font-semibold text-emerald-800">
          Puzzle complete! 🎉
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-9 overflow-hidden rounded border-2 border-foreground">
        {userGrid.map((row, ri) =>
          row.map((value, ci) => {
            const isSelected = selected?.[0] === ri && selected?.[1] === ci
            const isLocked = lockedCells[ri][ci]
            const isError = errors.has(`${ri}-${ci}`)
            const isSameBox =
              selected &&
              Math.floor(selected[0] / 3) === Math.floor(ri / 3) &&
              Math.floor(selected[1] / 3) === Math.floor(ci / 3)
            const isSameRowCol = selected && (selected[0] === ri || selected[1] === ci)
            const isHighlighted = !isSelected && (isSameBox || isSameRowCol)

            return (
              <button
                key={`${ri}-${ci}`}
                onClick={() => handleCellClick(ri, ci)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center text-sm font-semibold transition-colors',
                  'border border-border/50',
                  ci % 3 === 2 && ci !== 8 ? 'border-r-2 border-r-foreground' : '',
                  ri % 3 === 2 && ri !== 8 ? 'border-b-2 border-b-foreground' : '',
                  isSelected ? 'bg-blue-200 dark:bg-blue-800' : '',
                  isHighlighted && !isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : '',
                  !isSelected && !isHighlighted ? 'bg-background' : '',
                  isLocked ? 'font-bold text-foreground' : 'text-blue-600 dark:text-blue-400',
                  isError ? 'text-red-500' : ''
                )}
              >
                {value ?? ''}
              </button>
            )
          })
        )}
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => handleNumberInput(n)}
            className="h-10 w-10 rounded-lg bg-secondary text-sm font-bold text-secondary-foreground hover:bg-secondary/80"
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => handleNumberInput(null)}
          className="h-10 w-10 rounded-lg bg-destructive/20 text-sm font-bold text-destructive hover:bg-destructive/30"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
