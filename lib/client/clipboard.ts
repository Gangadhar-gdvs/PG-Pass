/**
 * Copy text to the clipboard and report whether it actually worked.
 *
 * `navigator.clipboard` is missing on insecure origins and some older mobile
 * browsers, and `writeText` can reject (permissions, unfocused document). Falls
 * back to a hidden textarea + `execCommand('copy')`. Callers must await this and
 * only show a "copied" toast when it resolves `true`.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
