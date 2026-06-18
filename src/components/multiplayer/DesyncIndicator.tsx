import { cn } from '@/lib/utils'
import styles from './DesyncIndicator.module.css'

interface DesyncIndicatorProps {
  /** True when connectionStatus === 'desynced'. When false, renders null. */
  active: boolean
  /** Override-able label; the shared default used by all 6 games. */
  message?: string
  /** cn()-merged onto the root for per-game positioning overrides if ever needed. */
  className?: string
}

/**
 * Non-blocking, self-healing desync indicator (CLIENT-01 / 04-UI-SPEC).
 *
 * Presentational only — props in, JSX out. Surfaces recoverable realtime
 * trouble (invalid Zod payloads + channel CHANNEL_ERROR/TIMED_OUT/CLOSED) as a
 * polite "Reconnecting…" pill, auto-hiding on recovery.
 *
 * Visually distinct from the terminal error banner (D-01): it uses the caution
 * accent `var(--amber)` for the pulsing dot + border, never the reserved
 * destructive error-banner token.
 */
export function DesyncIndicator({
  active,
  message = 'Reconnecting…',
  className,
}: DesyncIndicatorProps) {
  if (!active) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="desync-indicator"
      className={cn(styles.indicator, className)}
      // Amber caution accent for the border (distinct from the destructive error banner, D-01).
      style={{ borderColor: 'var(--amber)' }}
    >
      <span aria-hidden="true" className={styles.dot} style={{ background: 'var(--amber)' }} />
      <span className={styles.label}>{message}</span>
    </div>
  )
}
