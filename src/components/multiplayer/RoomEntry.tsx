'use client'

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { normalizeRoomCode } from '@/lib/room-code'
import { getSavedAvatar, saveAvatar } from '@/lib/avatar'
import { AvatarPicker } from './AvatarPicker'
import styles from './RoomEntry.module.css'

export interface RoomEntryCopy {
  /** Headline above the create/join cards, e.g. "Ready to play?" */
  chooseTitle: string
  chooseSubtitle: string
  /** Create card. */
  createTitle: string
  createHint: string
  /** Join card. */
  joinTitle: string
  joinHint: string
  /** Form headers. */
  createFormTitle: string
  createFormSubtitle: string
  joinFormTitle: string
  joinFormSubtitle: string
  namePlaceholder?: string
  codePlaceholder?: string
  backLabel?: string
  createSubmitLabel?: string
  joinSubmitLabel?: string
}

interface RoomEntryProps {
  copy: RoomEntryCopy
  loading: boolean
  error: string | null
  initialCode?: string | null
  /** Show the avatar picker in the form (Skribbl). */
  withAvatar?: boolean
  onCreate: (name: string, avatar: number) => void
  onJoin: (code: string, name: string, avatar: number) => void
  /** Back to the how-to screen, if the game offers one. */
  onBack?: () => void
  /** Optional resume-session card (rendered in the choose view). */
  resume?: ReactNode
}

/**
 * Shared "create / join a room" window for online multiplayer games. Renders a
 * choose view (Create / Join cards + optional resume) and a create/join form
 * (name, optional avatar, room code). Game-specific copy and callbacks come
 * from props, so every game shares one consistent entry experience.
 */
export function RoomEntry({
  copy,
  loading,
  error,
  initialCode,
  withAvatar = false,
  onCreate,
  onJoin,
  onBack,
  resume,
}: RoomEntryProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialCode ? 'join' : 'choose')
  const [name, setName] = useState(getSavedPlayerName)
  const [avatar, setAvatar] = useState(getSavedAvatar)
  const [code, setCode] = useState(initialCode ?? '')

  useEffect(() => {
    if (!initialCode) return
    setMode('join')
    setCode(initialCode)
  }, [initialCode])

  const canSubmit = name.trim().length >= 2 && (mode === 'create' || code.trim().length >= 6)

  function submit() {
    if (!canSubmit) return
    const trimmedName = name.trim()
    savePlayerName(trimmedName)
    if (withAvatar) saveAvatar(avatar)
    if (mode === 'create') {
      onCreate(trimmedName, avatar)
      return
    }
    onJoin(code.trim().toUpperCase(), trimmedName, avatar)
  }

  if (mode === 'choose') {
    return (
      <div className={styles.shell}>
        <div className={styles.head}>
          <h2>{copy.chooseTitle}</h2>
          <p>{copy.chooseSubtitle}</p>
        </div>

        {resume}

        <div className={styles.choiceGrid}>
          <button
            type="button"
            data-testid="create-room-button"
            className={cn(styles.card, styles.cardAccent)}
            onClick={() => setMode('create')}
          >
            <span className={styles.cardIcon}>{PLUS_ICON}</span>
            <div>
              <div className={styles.cardTitle}>{copy.createTitle}</div>
              <div className={cn(styles.cardCopy, styles.mono)}>{copy.createHint}</div>
            </div>
          </button>

          <button
            type="button"
            data-testid="join-room-button"
            className={styles.card}
            onClick={() => setMode('join')}
          >
            <span className={styles.cardIcon}>{ARROW_ICON}</span>
            <div>
              <div className={styles.cardTitle}>{copy.joinTitle}</div>
              <div className={cn(styles.cardCopy, styles.mono)}>{copy.joinHint}</div>
            </div>
          </button>
        </div>

        {onBack && (
          <div className={styles.actions}>
            <button
              type="button"
              className={cn(styles.button, styles.buttonGhost, styles.buttonSmall)}
              onClick={onBack}
            >
              {copy.backLabel ?? '← Back to how to play'}
            </button>
          </div>
        )}
      </div>
    )
  }

  const isCreate = mode === 'create'

  return (
    <div className={styles.shell}>
      <div className={styles.head}>
        <h2>{isCreate ? copy.createFormTitle : copy.joinFormTitle}</h2>
        <p>{isCreate ? copy.createFormSubtitle : copy.joinFormSubtitle}</p>
      </div>

      <div className={styles.form}>
        {error && (
          <div data-testid="room-error" className={styles.error}>
            {error}
          </div>
        )}

        <label className={styles.field}>
          <span className={cn(styles.label, styles.mono)}>Your name</span>
          <input
            data-testid="player-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={16}
            placeholder={copy.namePlaceholder ?? 'e.g. Marble'}
            className={styles.input}
          />
        </label>

        {withAvatar && (
          <div className={styles.field}>
            <span className={cn(styles.label, styles.mono)}>Pick an avatar</span>
            <AvatarPicker
              selectedIndex={avatar}
              onSelect={setAvatar}
              className={styles.avatarGrid}
              buttonClassName={styles.avatarButton}
              selectedButtonClassName={styles.avatarButtonActive}
            />
          </div>
        )}

        {mode === 'join' && (
          <label className={styles.field}>
            <span className={cn(styles.label, styles.mono)}>Room code</span>
            <input
              data-testid="room-code-input"
              value={code}
              onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
              maxLength={6}
              placeholder={copy.codePlaceholder ?? '7H2K9F'}
              className={cn(styles.input, styles.codeInput)}
            />
          </label>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={cn(styles.button, styles.buttonGhost, styles.buttonSmall)}
            onClick={() => setMode('choose')}
          >
            ← Back
          </button>
          <button
            type="button"
            data-testid={isCreate ? 'create-room-button' : 'join-room-button'}
            onClick={submit}
            disabled={loading || !canSubmit}
            className={styles.button}
          >
            {loading
              ? 'Connecting...'
              : isCreate
                ? (copy.createSubmitLabel ?? 'Create room')
                : (copy.joinSubmitLabel ?? 'Join room')}
          </button>
        </div>
      </div>
    </div>
  )
}

const ICON_PROPS = {
  viewBox: '0 0 40 40',
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
} as const

const PLUS_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M 20 8 L 20 32 M 8 20 L 32 20" />
  </svg>
)

const ARROW_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M 8 20 L 32 20 M 24 12 L 32 20 L 24 28" />
  </svg>
)
