// Shareable calculator results. The calculators keep their inputs in the page
// state; a share link is the bare page path plus those inputs as a query string,
// so opening it fills the form in. Only the numbers the visitor typed go in the
// link, nothing about the visitor. The server ignores the query string and its
// canonical stays the bare path, so these URLs are not separate pages for search.

/** A non-negative number with at most 6 integer digits and 2 decimals, else ''. */
export function cleanNumberParam(v: string | null): string {
  return v !== null && /^\d{1,6}(\.\d{1,2})?$/.test(v) ? v : '';
}

/** `value` if it is one of `allowed`, else `fallback`. */
export function cleanChoiceParam<T extends string>(v: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** origin + path + only the non-empty params, in the order given. */
export function buildShareUrl(origin: string, pathname: string, params: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v.trim() !== '') q.set(k, v.trim());
  const s = q.toString();
  return `${origin}${pathname}${s ? `?${s}` : ''}`;
}

/** Copy text to the clipboard; false when the browser refuses or has no clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea fallback
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
