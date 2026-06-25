/**
 * Copy text to the clipboard, resilient to non-secure contexts.
 *
 * `navigator.clipboard` is only defined in secure contexts (HTTPS or
 * localhost), so it is `undefined` when the dev server is opened over plain
 * HTTP on a LAN IP — calling it there throws. We fall back to a hidden
 * textarea + `execCommand('copy')`. Never rejects; resolves whether it copied.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Secure API present but blocked (permissions, focus) — try the fallback.
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
