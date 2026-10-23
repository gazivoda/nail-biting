// Copy text to the clipboard, with a fallback for browsers or pages where the async
// Clipboard API is unavailable or refused (an insecure origin, an old browser, a
// permission policy). Returns whether it worked, so the card can say "Copied" or ask
// the person to copy by hand. The text is never stored anywhere.

export interface ClipboardDeps {
  /** `navigator.clipboard`, if there is one. */
  writeText?: (text: string) => Promise<void>;
  /** Selects the visible link and runs the legacy copy command. */
  legacyCopy?: () => boolean;
}

export async function copyText(text: string, deps: ClipboardDeps): Promise<boolean> {
  if (deps.writeText) {
    try {
      await deps.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  if (deps.legacyCopy) {
    try {
      return deps.legacyCopy() === true;
    } catch {
      return false;
    }
  }
  return false;
}

/** The browser's dependencies for an input that shows the text. */
export function browserClipboard(input: HTMLInputElement | null): ClipboardDeps {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    writeText: nav?.clipboard?.writeText ? (t: string) => nav.clipboard.writeText(t) : undefined,
    legacyCopy: () => {
      if (!input || typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      return document.execCommand('copy');
    },
  };
}
