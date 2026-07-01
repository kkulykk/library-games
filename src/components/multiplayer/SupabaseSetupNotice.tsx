import { cn } from '@/lib/utils'

interface SupabaseSetupNoticeProps {
  className?: string
}

// Shown by every online game when NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are unset
// (see isSupabaseConfigured in src/lib/supabase.ts).
export function SupabaseSetupNotice({ className }: SupabaseSetupNoticeProps) {
  return (
    <div
      className={cn(
        'bg-secondary/40 mx-auto max-w-md rounded-2xl border p-6 text-center',
        className
      )}
    >
      <div className="mb-3 text-4xl">🔧</div>
      <h2 className="mb-2 text-lg font-bold">Supabase setup required</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Online multiplayer requires a Supabase project. Create a free project at{' '}
        <span className="text-foreground font-medium">supabase.com</span>, run the schema from{' '}
        <code className="bg-secondary rounded px-1 text-xs">supabase/schema.sql</code>, then set:
      </p>
      <pre className="bg-secondary rounded-lg p-3 text-left text-xs">
        {`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
      </pre>
    </div>
  )
}
