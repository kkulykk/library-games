import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import styles from './ArcadeShell.module.css'

interface ArcadeShellProps {
  title: string
  crumb: React.ReactNode
  children: React.ReactNode
  centered?: boolean
  backHref?: string
}

export function ArcadeShell({
  title,
  crumb,
  children,
  centered = true,
  backHref = '/',
}: ArcadeShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={cn(styles.topbarSide, styles.topbarSideStart)}>
          <Link href={backHref} className={styles.back}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Library
          </Link>
        </div>

        <div className={cn(styles.topbarSide, styles.topbarSideCenter, 'justify-center')}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark}>{title[0]}</span>
            <span className={styles.brandText}>{title}</span>
            <span className={styles.brandSuffix}>/ play</span>
          </Link>
        </div>

        <div className={cn(styles.topbarSide, styles.topbarSideRight)}>
          <div className={styles.crumb}>{crumb}</div>
        </div>
      </header>

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
