import { render, screen } from '@testing-library/react'
import { SupabaseSetupNotice } from './SupabaseSetupNotice'

describe('SupabaseSetupNotice', () => {
  it('explains how to configure Supabase', () => {
    render(<SupabaseSetupNotice />)

    expect(screen.getByText('Supabase setup required')).toBeInTheDocument()
    expect(screen.getByText('supabase/schema.sql')).toBeInTheDocument()
    expect(screen.getByText(/NEXT_PUBLIC_SUPABASE_URL/)).toBeInTheDocument()
    expect(screen.getByText(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)).toBeInTheDocument()
  })

  it('merges a custom className onto the container', () => {
    render(<SupabaseSetupNotice className="custom-shell" />)

    expect(screen.getByText('Supabase setup required').closest('div.custom-shell')).toBeTruthy()
  })
})
