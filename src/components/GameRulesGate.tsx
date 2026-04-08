'use client'

import { useState } from 'react'

interface GameRulesGateProps {
  emoji: string
  title: string
  rules: string[]
  children: React.ReactNode
}

export function GameRulesGate({ emoji, title, rules, children }: GameRulesGateProps) {
  const [started, setStarted] = useState(false)

  if (started) {
    return <>{children}</>
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 px-4">
      <div className="text-6xl">{emoji}</div>
      <h2 className="text-foreground text-2xl font-bold">{title}</h2>

      <div className="bg-card w-full rounded-lg border p-5">
        <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
          How to Play
        </h3>
        <ul className="space-y-2">
          {rules.map((rule, i) => (
            <li key={i} className="text-foreground/90 flex items-start gap-2.5 text-sm">
              <span className="bg-primary mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
              {rule}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => setStarted(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-8 py-3 text-sm font-semibold transition-colors"
      >
        Play
      </button>
    </div>
  )
}
