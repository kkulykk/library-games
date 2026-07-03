import { GameTopNav } from '@/components/GameTopNav'
import styles from './ArcadeShell.module.css'

interface ArcadeShellProps {
  title: string
  crumb: React.ReactNode
  children: React.ReactNode
  centered?: boolean
  backHref?: string
  /** Muted suffix after the title (e.g. the game's genre), matching other games. */
  suffix?: React.ReactNode
}

export function ArcadeShell({
  title,
  crumb,
  children,
  centered = true,
  backHref = '/',
  suffix,
}: ArcadeShellProps) {
  return (
    <div className={styles.shell}>
      <GameTopNav title={title} suffix={suffix} right={crumb} backHref={backHref} />

      {centered ? (
        <main className={styles.stage}>
          <div className={styles.stageInner}>{children}</div>
        </main>
      ) : (
        <main className={styles.fullBleed}>{children}</main>
      )}
    </div>
  )
}

export { styles as arcadeShellStyles }
