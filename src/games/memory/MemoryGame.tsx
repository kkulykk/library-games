'use client'

import { useState, useCallback, useRef } from 'react'
import { createDeck, flipCard, checkMatch, isGameComplete, type MemoryCard } from './logic'
import { cn } from '@/lib/utils'

const MATCH_CHECK_DELAY_MS = 800
const NUM_PAIRS = 8

export function MemoryGame() {
  const [cards, setCards] = useState<MemoryCard[]>(() => createDeck(NUM_PAIRS))
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const lockedRef = useRef(false)
  const [won, setWon] = useState(false)

  const restart = () => {
    setCards(createDeck(NUM_PAIRS))
    setFlipped([])
    setMoves(0)
    lockedRef.current = false
    setWon(false)
  }

  const handleCardClick = useCallback(
    (id: number) => {
      if (lockedRef.current || won) return
      const card = cards.find((c) => c.id === id)
      if (!card || card.flipped || card.matched) return
      if (flipped.includes(id)) return

      const newFlipped = [...flipped, id]
      const newCards = flipCard(cards, id)
      setCards(newCards)
      setFlipped(newFlipped)

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1)
        lockedRef.current = true
        setTimeout(() => {
          setCards((prev) => {
            const result = checkMatch(prev, newFlipped[0], newFlipped[1])
            if (isGameComplete(result)) setWon(true)
            return result
          })
          setFlipped([])
          lockedRef.current = false
        }, MATCH_CHECK_DELAY_MS)
      }
    },
    [cards, flipped, won]
  )

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">Moves: {moves}</span>
        <button
          onClick={restart}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-1.5 text-sm font-semibold"
        >
          Restart
        </button>
      </div>

      {won && (
        <div className="rounded-lg bg-emerald-100 px-4 py-2 font-semibold text-emerald-800">
          You matched all pairs in {moves} moves! 🎉
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-xl text-3xl transition-all duration-200 select-none',
              card.flipped || card.matched
                ? 'bg-blue-100 shadow-inner dark:bg-blue-900'
                : 'bg-secondary hover:bg-secondary/80 shadow-md'
            )}
          >
            {card.flipped || card.matched ? card.symbol : '?'}
          </button>
        ))}
      </div>
    </div>
  )
}
