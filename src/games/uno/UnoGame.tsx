'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { ArcadeShell, arcadeShellStyles } from '@/components/multiplayer/ArcadeShell'
import { LobbyActions } from '@/components/multiplayer/LobbyActions'
import { PlayerRoster } from '@/components/multiplayer/PlayerRoster'
import { ResultsTable } from '@/components/multiplayer/ResultsTable'
import { ResumeSessionCard } from '@/components/multiplayer/ResumeSessionCard'
import { RoomInviteCard } from '@/components/multiplayer/RoomInviteCard'
import type { SavedSessionSummary } from '@/components/multiplayer/ResumeSessionButton'
import { useUnoRoom } from './useUnoRoom'
import {
  getPlayableCards,
  getCurrentPlayer,
  getTopCard,
  redactForPlayer,
  type Card,
  type CardColor,
  type GameState,
} from './logic'
import styles from './UnoGame.module.css'

// ─── Animations (injected once) ─────────────────────────────────────────────

function UnoStyles() {
  return (
    <style>{`
      @keyframes uno-fade-in {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes uno-slide-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes uno-card-deal {
        from { opacity: 0; transform: translateY(-30px) rotate(-5deg); }
        to { opacity: 1; transform: translateY(0) rotate(0deg); }
      }
      @keyframes uno-pulse-ring {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
        50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      }
      @keyframes uno-bounce-sm {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes uno-discard-pop {
        0% { transform: scale(0.8) rotate(-8deg); opacity: 0.5; }
        60% { transform: scale(1.05) rotate(1deg); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes confetti-fall {
        0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
      .animate-uno-fade-in { animation: uno-fade-in 0.3s ease-out; }
      .animate-uno-slide-up { animation: uno-slide-up 0.35s ease-out; }
      .animate-uno-card-deal { animation: uno-card-deal 0.3s ease-out both; }
      .animate-uno-pulse-ring { animation: uno-pulse-ring 1.5s ease-in-out infinite; }
      .animate-uno-bounce-sm { animation: uno-bounce-sm 0.6s ease-in-out infinite; }
      .animate-uno-discard-pop { animation: uno-discard-pop 0.35s ease-out; }
      .uno-hand-scroll { overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
      .uno-hand-scroll::-webkit-scrollbar { display: none; }
    `}</style>
  )
}

// ─── Card rendering (sprite-based) ──────────────────────────────────────────

const SPRITE_URL = '/library-games/uno-cards-deck.svg'

const ACTIVE_COLOR_BG: Record<CardColor, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
}

/** Map a card to its {row, col} in the sprite grid (14 cols × 8 rows). */
function getCardSpritePos(card: Card): { row: number; col: number } {
  const colorRow: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3 }

  // Wild cards: row 0, col 13; Wild Draw 4: row 4, col 13
  if (card.value === 'wild') return { row: 0, col: 13 }
  if (card.value === 'wild4') return { row: 4, col: 13 }

  const row = colorRow[card.color] ?? 0
  if (typeof card.value === 'number') {
    return { row, col: card.value }
  }
  const actionCol: Record<string, number> = { skip: 10, reverse: 11, draw2: 12 }
  return { row, col: actionCol[card.value] ?? 0 }
}

/** CSS background properties to show a single card from the sprite sheet. */
function spriteStyle(card: Card): React.CSSProperties {
  const { row, col } = getCardSpritePos(card)
  // percentage-based positioning: x = col/(cols-1)*100, y = row/(rows-1)*100
  const x = (col / 13) * 100
  const y = (row / 7) * 100
  return {
    backgroundImage: `url(${SPRITE_URL})`,
    backgroundSize: '1400% 800%',
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: 'no-repeat',
  }
}

interface UnoCardProps {
  card: Card
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  selected?: boolean
  faceDown?: boolean
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
}

function UnoCard({
  card,
  size = 'md',
  playable,
  selected,
  faceDown,
  onClick,
  className,
  style,
}: UnoCardProps) {
  // 2:3 aspect ratio sizes matching actual card proportions
  const sizeClasses = {
    sm: 'w-9 h-[3.375rem] rounded-md',
    md: 'w-[3.25rem] h-[4.875rem] sm:w-14 sm:h-[5.25rem] rounded-lg',
    lg: 'w-16 h-24 sm:w-[4.75rem] sm:h-[7.125rem] rounded-xl',
  }

  return (
    <button
      data-testid={!faceDown && onClick ? 'uno-hand-card' : undefined}
      onClick={onClick}
      disabled={!playable && !faceDown && onClick !== undefined}
      className={cn(
        'relative overflow-hidden shadow-md transition-all duration-200 select-none',
        sizeClasses[size],
        playable &&
          !selected &&
          'cursor-pointer hover:-translate-y-2 hover:shadow-xl hover:brightness-110 active:scale-95',
        selected &&
          '-translate-y-3 scale-105 cursor-pointer shadow-xl ring-2 ring-white ring-offset-2 ring-offset-black/50',
        !playable && !faceDown && onClick !== undefined && 'cursor-not-allowed opacity-40',
        faceDown && 'cursor-default',
        className
      )}
      style={faceDown ? style : { ...spriteStyle(card), ...style }}
      title={faceDown ? 'Draw pile' : `${card.color} ${card.value}`}
    >
      {faceDown && (
        <div className="flex h-full w-full items-center justify-center rounded-[inherit] border-2 border-gray-800 bg-gray-900">
          <div className="absolute inset-[3px] rounded-[inherit] border border-gray-700" />
          <div className="relative flex h-[55%] w-[65%] items-center justify-center rounded-[50%] bg-red-600 shadow-inner">
            <span
              className="text-xs font-black tracking-tight text-yellow-300 sm:text-sm"
              style={{
                transform: 'rotate(-15deg)',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              UNO
            </span>
          </div>
        </div>
      )}
    </button>
  )
}

// ─── Color picker ────────────────────────────────────────────────────────────

const COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue']

function makeCrumb(
  gameState: GameState | null,
  roomCode: string | null,
  playerId: string | null,
  inviteCode: string | null | undefined
) {
  if (!gameState) {
    return (
      <>
        /{' '}
        <span className={arcadeShellStyles.crumbAccent}>
          {inviteCode === undefined ? 'Loading' : inviteCode ? 'Join a game' : 'How to play'}
        </span>
      </>
    )
  }

  if (gameState.phase === 'lobby') {
    return (
      <>
        / Lobby · <span className={arcadeShellStyles.crumbAccent}>{roomCode}</span>
      </>
    )
  }

  if (gameState.phase === 'playing') {
    const currentPlayer = getCurrentPlayer(gameState)
    return (
      <>
        /{' '}
        <span className={arcadeShellStyles.crumbAccent}>
          {currentPlayer?.id === playerId
            ? 'Your turn'
            : `${currentPlayer?.name ?? 'Player'}\u2019s turn`}
        </span>
      </>
    )
  }

  return (
    <>
      / <span className={arcadeShellStyles.crumbAccent}>Game over</span>
    </>
  )
}

const COLOR_PICKER_STYLES: Record<CardColor, string> = {
  red: 'bg-red-500 hover:bg-red-400',
  yellow: 'bg-yellow-400 hover:bg-yellow-300',
  green: 'bg-emerald-500 hover:bg-emerald-400',
  blue: 'bg-blue-500 hover:bg-blue-400',
}

interface ColorPickerProps {
  onPick: (color: CardColor) => void
}

function ColorPicker({ onPick }: ColorPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-uno-fade-in flex flex-col items-center gap-5 rounded-3xl bg-gray-900/95 p-7 shadow-2xl ring-1 ring-white/10">
        <p className="text-base font-bold text-white">Choose a color</p>
        <div className="grid grid-cols-2 gap-4">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onPick(color)}
              className={cn(
                'h-16 w-16 rounded-full border-[3px] border-white/30 shadow-lg sm:h-20 sm:w-20',
                'transition-all duration-150 hover:scale-110 hover:border-white/60 active:scale-95',
                COLOR_PICKER_STYLES[color]
              )}
              title={color}
            >
              <span className="text-sm font-bold text-white capitalize drop-shadow sm:text-base">
                {color}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function SetupRequired() {
  return (
    <div className={styles.setup}>
      <div className="mb-4 text-5xl">🔧</div>
      <h2>Supabase setup required</h2>
      <p>
        Online multiplayer rooms still run through Supabase. The redesign is ready, but the game
        needs the same backend wiring as before.
      </p>
      <pre>{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}</pre>
    </div>
  )
}

function InviteResolvingScreen() {
  return (
    <div className={styles.entryShell}>
      <div className={styles.entryHead}>
        <h2>Loading room…</h2>
        <p>Checking your invite link and preparing the right entry screen.</p>
      </div>
    </div>
  )
}

function HowToScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroLeft}>
        <span className={cn(styles.tag, arcadeShellStyles.mono)}>Multiplayer · 2-10 players</span>
        <h1 className={styles.heroTitle}>
          Match it.
          <br />
          Stack it.
          <br />
          <span className={styles.heroTitleAccent}>UNO it.</span>
        </h1>
        <p className={styles.heroCopy}>
          Race to empty your hand in a private online room. Match colors or numbers, drop action
          cards, call UNO before your friends catch you, and survive the draw piles.
        </p>
        <div className={styles.heroActions}>
          <button
            type="button"
            data-testid="play-game-button"
            onClick={onStart}
            className={arcadeShellStyles.button}
          >
            Play now →
          </button>
          <span className={cn(styles.heroMeta, arcadeShellStyles.mono)}>
            realtime · private rooms · chaos encouraged
          </span>
        </div>
      </div>

      <div className={styles.steps}>
        {[
          [
            '01 · Join',
            'Grab a room',
            'Host a private room or enter a four-character invite code.',
            '▣',
          ],
          [
            '02 · Match',
            'Play smart',
            'Match the active color or value. Wilds let you bend the table.',
            '◆',
          ],
          [
            '03 · Punish',
            'Stack pressure',
            'Skip, reverse, and draw cards keep everyone sweating.',
            '↯',
          ],
          ['04 · UNO', 'Say it fast', 'One card left? Call UNO before somebody catches you.', '!'],
        ].map(([number, title, copy, icon], index) => (
          <article key={number} className={cn(styles.step, index === 1 && styles.stepAccent)}>
            <span className={cn(styles.stepNumber, arcadeShellStyles.mono)}>{number}</span>
            <div className={styles.stepIcon}>{icon}</div>
            <div className={styles.stepTitle}>{title}</div>
            <div className={styles.stepDescription}>{copy}</div>
          </article>
        ))}
      </div>
    </div>
  )
}

interface EntryScreenProps {
  onCreate: (name: string) => void
  onJoin: (code: string, name: string) => void
  onRestore?: () => void
  savedSession: SavedSessionSummary | null
  loading: boolean
  error: string | null
  initialCode?: string | null
}

function EntryScreen({
  onCreate,
  onJoin,
  onRestore,
  savedSession,
  loading,
  error,
  initialCode,
  onBackToHowTo,
}: EntryScreenProps & { onBackToHowTo?: () => void }) {
  const [name, setName] = useState(getSavedPlayerName)
  const [joinCode, setJoinCode] = useState(initialCode ?? '')
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialCode ? 'join' : 'choose')

  useEffect(() => {
    if (!initialCode) return
    setMode('join')
    setJoinCode(initialCode)
  }, [initialCode])

  const canSubmit = name.trim().length >= 2 && (mode === 'create' || joinCode.trim().length >= 4)

  function submit() {
    if (!canSubmit) return
    const trimmedName = name.trim()
    savePlayerName(trimmedName)

    if (mode === 'create') {
      onCreate(trimmedName)
      return
    }

    onJoin(joinCode.trim().toUpperCase(), trimmedName)
  }

  if (mode === 'choose') {
    return (
      <div className={styles.entryShell}>
        <div className={styles.entryHead}>
          <h2>Ready to play?</h2>
          <p>Host a new room or jump into a friend&apos;s game with a code.</p>
        </div>

        {savedSession && onRestore && (
          <ResumeSessionCard
            session={savedSession}
            onResume={onRestore}
            className={styles.resumeCard}
            titleClassName={styles.resumeTitle}
            descriptionClassName={styles.resumeCopy}
            actionClassName={cn(arcadeShellStyles.button, arcadeShellStyles.buttonSmall)}
          />
        )}

        <div className={styles.entryChoiceGrid}>
          <button
            type="button"
            data-testid="create-room-button"
            className={cn(styles.entryCard, styles.entryCardAccent)}
            onClick={() => setMode('create')}
          >
            <div className={styles.entryCardTitle}>Create Room</div>
            <div className={cn(styles.entryCardCopy, arcadeShellStyles.mono)}>
              Host a private game
            </div>
          </button>

          <button
            type="button"
            data-testid="join-room-button"
            className={styles.entryCard}
            onClick={() => setMode('join')}
          >
            <div className={styles.entryCardTitle}>Join Room</div>
            <div className={cn(styles.entryCardCopy, arcadeShellStyles.mono)}>
              Enter a 4-char code
            </div>
          </button>
        </div>

        {onBackToHowTo && (
          <div className={styles.entryActions}>
            <button
              type="button"
              className={cn(
                arcadeShellStyles.button,
                arcadeShellStyles.buttonGhost,
                arcadeShellStyles.buttonSmall
              )}
              onClick={onBackToHowTo}
            >
              ← Back to how it works
            </button>
          </div>
        )}
      </div>
    )
  }

  const isCreate = mode === 'create'
  return (
    <div className={styles.entryShell}>
      <div className={styles.entryHead}>
        <h2>{isCreate ? 'Create a room' : 'Join a room'}</h2>
        <p>{isCreate ? "You'll be the host." : 'Ask the host for the room code.'}</p>
      </div>

      <div className={styles.entryForm}>
        {error && (
          <div data-testid="room-error" className={styles.error}>
            {error}
          </div>
        )}

        <label className={styles.field}>
          <span className={cn(styles.label, arcadeShellStyles.mono)}>Your name</span>
          <input
            data-testid="player-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Marble"
            maxLength={16}
            className={arcadeShellStyles.input}
          />
        </label>

        {!isCreate && (
          <label className={styles.field}>
            <span className={cn(styles.label, arcadeShellStyles.mono)}>Room code</span>
            <input
              data-testid="room-code-input"
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
              placeholder="AB23"
              maxLength={4}
              className={cn(arcadeShellStyles.input, styles.codeInput)}
            />
          </label>
        )}

        <div className={styles.entryActions}>
          <button
            type="button"
            className={cn(
              arcadeShellStyles.button,
              arcadeShellStyles.buttonGhost,
              arcadeShellStyles.buttonSmall
            )}
            onClick={() => setMode('choose')}
          >
            ← Back
          </button>
          <button
            type="button"
            data-testid={isCreate ? 'create-room-button' : 'join-room-button'}
            disabled={loading || !canSubmit}
            onClick={submit}
            className={arcadeShellStyles.button}
          >
            {loading ? 'Connecting...' : isCreate ? 'Create room' : 'Join room'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface LobbyScreenProps {
  gameState: GameState
  playerId: string
  roomCode: string
  onlinePlayerIds: string[]
  onStart: () => void
  onLeave: () => void
}

function LobbyScreen({
  gameState,
  playerId,
  roomCode,
  onlinePlayerIds,
  onStart,
  onLeave,
}: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  function copyValue(value: string, kind: 'code' | 'link') {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(kind)
        window.setTimeout(() => setCopied(null), 1800)
      },
      () => {}
    )
  }

  const rosterPlayers = gameState.players.map((player, index) => ({ ...player, avatar: index % 8 }))

  return (
    <div className={styles.lobby}>
      <RoomInviteCard
        roomCode={roomCode}
        inviteLink={getInviteLink('uno', roomCode)}
        copied={copied}
        onCopy={copyValue}
        className={styles.roomCard}
        titleClassName={cn(styles.roomLabel, arcadeShellStyles.mono)}
        roomCodeClassName={styles.roomCode}
        actionsClassName={styles.roomActions}
        actionClassName={cn(styles.roomAction, arcadeShellStyles.mono)}
        metaClassName={cn(styles.roomMeta, arcadeShellStyles.mono)}
      />

      <div className={styles.lobbySide}>
        <PlayerRoster
          players={rosterPlayers}
          currentPlayerId={playerId}
          onlinePlayerIds={onlinePlayerIds}
          maxPlayers={10}
          currentPlayerIsHost={isHost}
          className={styles.playersPanel}
          headerClassName={cn(styles.panelHead, arcadeShellStyles.mono)}
          listClassName={styles.playerList}
          rowClassName={styles.playerRow}
          currentPlayerRowClassName={styles.playerRowYou}
          avatarClassName={styles.playerAvatar}
          infoClassName={styles.playerInfo}
          nameClassName={styles.playerName}
          metaClassName={styles.playerMeta}
          tagsClassName={styles.playerTags}
          tagClassName={styles.playerTag}
          hostTagClassName={styles.playerTagHost}
        />
      </div>

      <LobbyActions
        isHost={isHost}
        canStart={gameState.players.length >= 2}
        onLeave={onLeave}
        onStart={onStart}
        className={styles.lobbyFooter}
        statusClassName={cn(styles.waiting, arcadeShellStyles.mono)}
        actionsClassName={styles.entryActions}
        leaveButtonClassName={cn(
          arcadeShellStyles.button,
          arcadeShellStyles.buttonGhost,
          arcadeShellStyles.buttonSmall
        )}
        startButtonClassName={arcadeShellStyles.button}
      />
    </div>
  )
}

// ─── Game Board ──────────────────────────────────────────────────────────────

interface GameBoardProps {
  gameState: GameState
  playerId: string
  onlinePlayerIds: string[]
  onDispatch: (cardId: string, chosenColor?: CardColor) => void
  onDraw: () => void
  onPassAfterDraw: () => void
  onSayUno: () => void
  onCatchUno: (targetId: string) => void
  onLeave: () => void
}

function GameBoard({
  gameState,
  playerId,
  onlinePlayerIds,
  onDispatch,
  onDraw,
  onPassAfterDraw,
  onSayUno,
  onCatchUno,
  onLeave,
}: GameBoardProps) {
  const [pendingWild, setPendingWild] = useState<string | null>(null)
  const [discardKey, setDiscardKey] = useState(0)
  const prevTopCardRef = useRef<string | null>(null)

  const currentPlayer = getCurrentPlayer(gameState)
  const isMyTurn = currentPlayer?.id === playerId
  const myHand = gameState.hands[playerId] ?? []
  const topCard = getTopCard(gameState)
  const otherPlayers = gameState.players.filter((p) => p.id !== playerId)
  const hasDrawnCard = gameState.drawnCardId !== null && isMyTurn
  const mustDraw = isMyTurn && gameState.pendingDrawCount > 0

  const topCardId = topCard?.id ?? null
  useEffect(() => {
    if (topCardId !== prevTopCardRef.current) {
      setDiscardKey((k) => k + 1)
      prevTopCardRef.current = topCardId
    }
  }, [topCardId])

  const playableIds =
    isMyTurn && topCard
      ? getPlayableCards(
          myHand,
          topCard,
          gameState.currentColor,
          gameState.pendingDrawCount,
          gameState.drawnCardId
        )
      : new Set<string>()

  function handleCardClick(card: Card) {
    if (!isMyTurn || !playableIds.has(card.id)) return
    if (card.color === 'wild') {
      setPendingWild(card.id)
    } else {
      onDispatch(card.id)
    }
  }

  function handleColorPick(color: CardColor) {
    if (pendingWild) {
      onDispatch(pendingWild, color)
      setPendingWild(null)
    }
  }

  const statusText = !isMyTurn
    ? `${currentPlayer?.name ?? '?'}'s turn`
    : mustDraw
      ? `You must draw ${gameState.pendingDrawCount} cards`
      : hasDrawnCard
        ? 'Play the drawn card or pass'
        : 'Your turn — play a card or draw'

  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const windows = Object.values(gameState.unoWindow)
    const nextExpiry = windows.filter((w) => w > Date.now()).sort((a, b) => a - b)[0]
    if (!nextExpiry) return
    const delay = nextExpiry - Date.now()
    const timer = setTimeout(() => setNow(Date.now()), delay + 50)
    return () => clearTimeout(timer)
  }, [gameState.unoWindow])

  const catchableTargets = otherPlayers.filter((p) => {
    const hand = gameState.hands[p.id] ?? []
    const windowUntil = gameState.unoWindow[p.id] ?? 0
    return hand.length === 1 && !gameState.calledUno.includes(p.id) && now >= windowUntil
  })

  return (
    <div className={styles.board}>
      {pendingWild && <ColorPicker onPick={handleColorPick} />}

      <aside className={styles.tablePanel}>
        <div className={cn(styles.scoreHead, arcadeShellStyles.mono)}>
          <span>Players</span>
          <span>{gameState.players.length} / 10</span>
        </div>
        <div className={styles.opponents}>
          {otherPlayers.map((p) => {
            const hand = gameState.hands[p.id] ?? []
            const isTurn = currentPlayer?.id === p.id
            const calledUno = gameState.calledUno.includes(p.id)
            const isCatchable = catchableTargets.includes(p)
            const isOnline = onlinePlayerIds.includes(p.id)

            return (
              <div key={p.id} className={cn(styles.opponentRow, isTurn && styles.opponentTurn)}>
                <div>
                  <div className={styles.playerName}>{p.name}</div>
                  <div className={styles.opponentMeta}>
                    {isOnline ? 'online' : 'offline'} · {hand.length} cards
                  </div>
                </div>
                <div className={styles.playerTags}>
                  {isTurn && (
                    <span className={cn(styles.playerTag, styles.playerTagHost)}>turn</span>
                  )}
                  {calledUno && <span className={styles.playerTag}>UNO</span>}
                  {isCatchable && (
                    <button
                      type="button"
                      onClick={() => onCatchUno(p.id)}
                      className={cn(styles.playerTag, styles.playerTagHost)}
                    >
                      catch
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <div data-testid="uno-status" className={cn(styles.statusBar, arcadeShellStyles.mono)}>
          {isMyTurn && (
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
          )}
          {statusText}
        </div>

        <div className={styles.playArea}>
          <div className={cn(styles.direction, arcadeShellStyles.mono)}>
            <span style={{ transform: gameState.direction === 1 ? 'scaleX(1)' : 'scaleX(-1)' }}>
              →
            </span>{' '}
            {gameState.direction === 1 ? 'clockwise' : 'counter-clockwise'}
          </div>

          <div data-testid="uno-draw-pile" className={styles.pile}>
            <div className="relative">
              <div className="absolute -top-0.5 -right-0.5 h-full w-full border-2 border-gray-300 bg-gray-200" />
              <div className="relative">
                <UnoCard
                  card={{ id: 'draw', color: 'wild', value: 'wild' }}
                  size="lg"
                  faceDown
                  playable={isMyTurn && !hasDrawnCard}
                  onClick={isMyTurn && !hasDrawnCard ? onDraw : undefined}
                />
              </div>
            </div>
            <span className={arcadeShellStyles.mono}>{gameState.drawPile.length} cards</span>
          </div>

          <div className={styles.pile}>
            <div
              className={cn(styles.colorPuck, ACTIVE_COLOR_BG[gameState.currentColor])}
              title={`Current color: ${gameState.currentColor}`}
            />
            <span className={cn(styles.label, arcadeShellStyles.mono)}>
              {gameState.currentColor}
            </span>
          </div>

          <div data-testid="uno-discard-pile" className={styles.pile}>
            {topCard && (
              <div key={discardKey} className="animate-uno-discard-pop">
                <UnoCard card={topCard} size="lg" />
              </div>
            )}
            <span className={cn(styles.label, arcadeShellStyles.mono)}>discard</span>
          </div>
        </div>

        <div className={styles.actionPanel}>
          <div className={styles.entryActions}>
            {isMyTurn && !hasDrawnCard && (
              <button
                type="button"
                onClick={onDraw}
                className={cn(
                  arcadeShellStyles.button,
                  arcadeShellStyles.buttonSmall,
                  mustDraw && 'animate-uno-bounce-sm'
                )}
              >
                {mustDraw ? `Draw ${gameState.pendingDrawCount}` : 'Draw card'}
              </button>
            )}

            {hasDrawnCard && (
              <button
                type="button"
                onClick={onPassAfterDraw}
                className={cn(arcadeShellStyles.button, arcadeShellStyles.buttonSmall)}
              >
                Pass
              </button>
            )}

            {myHand.length === 1 && !gameState.calledUno.includes(playerId) && (
              <button type="button" onClick={onSayUno} className={arcadeShellStyles.button}>
                UNO!
              </button>
            )}

            <button
              type="button"
              onClick={onLeave}
              className={cn(
                arcadeShellStyles.button,
                arcadeShellStyles.buttonGhost,
                arcadeShellStyles.buttonSmall
              )}
            >
              Leave
            </button>
          </div>
        </div>

        <div className={styles.handPanel}>
          <p className={cn(styles.handTitle, arcadeShellStyles.mono)}>
            Your hand ({myHand.length}){hasDrawnCard && <span> — play drawn card or pass</span>}
          </p>
          <div className="uno-hand-scroll p-4 pt-5">
            <div className="mx-auto flex w-fit items-end justify-center">
              {myHand.map((card, i) => {
                const isDrawn = card.id === gameState.drawnCardId
                return (
                  <div
                    key={card.id}
                    className={cn(
                      'transition-all duration-200',
                      i > 0 && '-ml-2 sm:-ml-3',
                      isDrawn && 'relative z-10'
                    )}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <UnoCard
                      card={card}
                      size="md"
                      playable={isMyTurn && playableIds.has(card.id)}
                      onClick={() => handleCardClick(card)}
                      className={cn(isDrawn && 'ring-2 ring-[var(--arcade-accent)] ring-offset-1')}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Finished screen ─────────────────────────────────────────────────────────

interface FinishedScreenProps {
  gameState: GameState
  playerId: string
  onPlayAgain: () => void
  onLeave: () => void
}

function FinishedScreen({ gameState, playerId, onPlayAgain, onLeave }: FinishedScreenProps) {
  const sortedPlayers = [...gameState.players].sort(
    (left, right) =>
      (gameState.hands[left.id]?.length ?? 0) - (gameState.hands[right.id]?.length ?? 0)
  )
  const winner = gameState.players.find((p) => p.id === gameState.winnerId) ?? sortedPlayers[0]
  const isWinner = gameState.winnerId === playerId
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={styles.endShell}>
      {isWinner && showConfetti && <ConfettiEffect />}
      <p className={cn(styles.endMeta, arcadeShellStyles.mono)}>Game over · final standings</p>
      <h2 data-testid="uno-winner-banner" className={styles.endTitle}>
        {isWinner ? 'You win' : `${winner?.name ?? 'Winner'} wins`}
      </h2>
      <p className={styles.endWord}>
        with <span className={styles.endWordAccent}>zero cards</span> left
      </p>

      <ResultsTable
        rows={sortedPlayers.map((player, index) => ({
          id: player.id,
          rankLabel: player.id === winner?.id ? '👑' : index + 1,
          name: player.name,
          avatar: index % 8,
          secondaryLabel: player.id === winner?.id ? 'Winner' : '',
          totalLabel: gameState.hands[player.id]?.length ?? 0,
          isWinner: player.id === winner?.id,
        }))}
        className={styles.resultsTable}
        rowClassName={styles.resultRow}
        winnerRowClassName={styles.resultRowWinner}
        rankClassName={cn(styles.resultTotal, arcadeShellStyles.mono)}
        playerClassName={styles.resultPlayer}
        secondaryClassName={styles.resultDelta}
        totalClassName={styles.resultTotal}
      />

      <div className={styles.endActions}>
        <button
          type="button"
          onClick={onLeave}
          className={cn(
            arcadeShellStyles.button,
            arcadeShellStyles.buttonGhost,
            arcadeShellStyles.buttonSmall
          )}
        >
          Back to library
        </button>
        {isHost ? (
          <button type="button" onClick={onPlayAgain} className={arcadeShellStyles.button}>
            Play again
          </button>
        ) : (
          <span className={cn(styles.endCountdown, arcadeShellStyles.mono)}>waiting for host</span>
        )}
      </div>
    </div>
  )
}

function generateConfettiParticles() {
  return Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1.5,
    color: ['#ef4444', '#eab308', '#22c55e', '#3b82f6'][i % 4],
    size: 4 + Math.random() * 6,
  }))
}

function ConfettiEffect() {
  const [particles] = useState(generateConfettiParticles)

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function UnoGame() {
  const inviteCode = useInviteCode()
  const inviteCodeResolved = inviteCode !== undefined
  const [entryMode, setEntryMode] = useState<'howto' | 'entry'>(
    process.env.NEXT_PUBLIC_E2E_FAKE_SUPABASE === '1' ? 'entry' : 'howto'
  )
  const {
    gameState,
    playerId,
    roomCode,
    status,
    error,
    savedSession,
    onlinePlayerIds,
    createRoom,
    joinRoom,
    restoreSession,
    dispatch,
    leaveRoom,
  } = useUnoRoom()

  useEffect(() => {
    if (inviteCode) setEntryMode('entry')
  }, [inviteCode])

  const redactedState = useMemo(
    () => (gameState && playerId ? redactForPlayer(gameState, playerId) : gameState),
    [gameState, playerId]
  )

  const crumb = makeCrumb(gameState, roomCode, playerId, inviteCode)
  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'
  const isEntryState = !gameState || !playerId || !roomCode
  const isResolvingInvite = isEntryState && !inviteCodeResolved

  const handleCreate = useCallback(
    (name: string) => {
      void createRoom(name)
    },
    [createRoom]
  )

  const handleJoin = useCallback(
    (code: string, name: string) => {
      void joinRoom(code, name)
    },
    [joinRoom]
  )

  const handleLeave = useCallback(() => {
    void leaveRoom()
  }, [leaveRoom])

  return (
    <ArcadeShell title="Uno" crumb={crumb} centered>
      <UnoStyles />
      {!isSupabaseConfigured ? (
        <SetupRequired />
      ) : isResolvingInvite ? (
        <InviteResolvingScreen />
      ) : isEntryState ? (
        entryMode === 'howto' ? (
          <HowToScreen onStart={() => setEntryMode('entry')} />
        ) : (
          <EntryScreen
            onCreate={handleCreate}
            onJoin={handleJoin}
            onRestore={savedSession ? () => void restoreSession() : undefined}
            savedSession={savedSession}
            loading={isLoading}
            error={error}
            initialCode={inviteCode ?? null}
            onBackToHowTo={!inviteCode ? () => setEntryMode('howto') : undefined}
          />
        )
      ) : gameState.phase === 'finished' ? (
        <FinishedScreen
          gameState={gameState}
          playerId={playerId}
          onPlayAgain={() => void dispatch({ type: 'PLAY_AGAIN', playerId })}
          onLeave={handleLeave}
        />
      ) : gameState.phase === 'lobby' ? (
        <LobbyScreen
          gameState={gameState}
          playerId={playerId}
          roomCode={roomCode}
          onlinePlayerIds={onlinePlayerIds}
          onStart={() => void dispatch({ type: 'START_GAME', playerId })}
          onLeave={handleLeave}
        />
      ) : (
        <GameBoard
          gameState={redactedState!}
          playerId={playerId}
          onlinePlayerIds={onlinePlayerIds}
          onDispatch={(cardId, chosenColor) =>
            void dispatch({ type: 'PLAY_CARD', playerId, cardId, chosenColor, now: Date.now() })
          }
          onDraw={() => void dispatch({ type: 'DRAW_CARD', playerId })}
          onPassAfterDraw={() => void dispatch({ type: 'PASS_AFTER_DRAW', playerId })}
          onSayUno={() => void dispatch({ type: 'SAY_UNO', playerId })}
          onCatchUno={(targetId) =>
            void dispatch({ type: 'CATCH_UNO', playerId, targetId, now: Date.now() })
          }
          onLeave={handleLeave}
        />
      )}
    </ArcadeShell>
  )
}
