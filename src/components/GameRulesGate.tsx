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
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>

      <div className="w-full rounded-lg border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          How to Play
        </h3>
        <ul className="space-y-2">
          {rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              {rule}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => setStarted(true)}
        className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Play
      </button>
    </div>
  )
}
