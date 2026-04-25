import { cn } from '@/lib/utils'
import { ArcadeAvatar } from './ArcadeAvatar'

export interface MultiplayerRosterPlayer {
  id: string
  name: string
  avatar: number
  isHost: boolean
}

interface PlayerRosterProps {
  players: MultiplayerRosterPlayer[]
  currentPlayerId: string
  onlinePlayerIds: string[]
  maxPlayers: number
  currentPlayerIsHost?: boolean
  onRemovePlayer?: (playerId: string) => void
  title?: string
  className?: string
  headerClassName?: string
  listClassName?: string
  rowClassName?: string
  currentPlayerRowClassName?: string
  avatarClassName?: string
  infoClassName?: string
  nameClassName?: string
  metaClassName?: string
  tagsClassName?: string
  tagClassName?: string
  hostTagClassName?: string
  removeButtonClassName?: string
}

export function PlayerRoster({
  players,
  currentPlayerId,
  onlinePlayerIds,
  maxPlayers,
  currentPlayerIsHost = false,
  onRemovePlayer,
  title = 'Players',
  className,
  headerClassName,
  listClassName,
  rowClassName,
  currentPlayerRowClassName,
  avatarClassName,
  infoClassName,
  nameClassName,
  metaClassName,
  tagsClassName,
  tagClassName,
  hostTagClassName,
  removeButtonClassName,
}: PlayerRosterProps) {
  return (
    <section data-testid="player-roster" className={className}>
      <div className={headerClassName}>
        <span>{title}</span>
        <span>
          {players.length} / {maxPlayers}
        </span>
      </div>

      <div className={listClassName}>
        {players.map((player) => {
          const isOnline = onlinePlayerIds.includes(player.id)
          const isCurrentPlayer = player.id === currentPlayerId
          const canRemove =
            currentPlayerIsHost && !isOnline && !player.isHost && player.id !== currentPlayerId

          return (
            <div
              key={player.id}
              className={cn(rowClassName, isCurrentPlayer && currentPlayerRowClassName)}
            >
              <div className={avatarClassName}>
                <ArcadeAvatar index={player.avatar} size={30} />
              </div>

              <div className={infoClassName}>
                <div className={nameClassName}>{player.name}</div>
                <div className={metaClassName}>
                  {isCurrentPlayer ? 'you' : isOnline ? 'online' : 'offline'}
                </div>
              </div>

              <div className={tagsClassName}>
                {player.isHost && <span className={cn(tagClassName, hostTagClassName)}>host</span>}
                {!isOnline && <span className={tagClassName}>away</span>}
                {canRemove && onRemovePlayer && (
                  <button
                    type="button"
                    onClick={() => onRemovePlayer(player.id)}
                    className={cn(tagClassName, removeButtonClassName)}
                    aria-label={`Remove ${player.name}`}
                  >
                    remove
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
