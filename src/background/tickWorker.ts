// The worker behind src/background/ticker.ts. It does one thing: post a number back every `ms` milliseconds for
// each timer the page started. A dedicated worker's timers are not slowed down when the tab is hidden (measured,
// docs/agents/ws7a-notes.md). No imports: it must stay a few hundred bytes and the page's CSP only allows
// same-origin workers, so Vite emits it as its own file under /assets/.

interface Scope {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(message: number): void;
}
const scope = self as unknown as Scope;
const timers = new Map<number, ReturnType<typeof setInterval>>();

scope.onmessage = (event) => {
  const message = event.data as { cmd?: string; id?: number; ms?: number } | null;
  if (!message || typeof message.id !== 'number') return;
  const id = message.id;
  const running = timers.get(id);
  if (running !== undefined) {
    clearInterval(running);
    timers.delete(id);
  }
  if (message.cmd === 'start' && typeof message.ms === 'number' && message.ms >= 10) {
    timers.set(id, setInterval(() => scope.postMessage(id), message.ms));
  }
};

export {};
