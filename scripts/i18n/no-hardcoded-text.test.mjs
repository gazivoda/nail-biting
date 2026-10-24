// Tests for the two ESLint rules in ./no-hardcoded-text.mjs: what they catch, and what they must leave alone.

import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import plugin, { hasEnglishWord, looksLikeEnglishCopy } from './no-hardcoded-text.mjs';
import { expect } from 'vitest';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

const file = 'src/pages/Example.tsx';

tester.run('no-hardcoded-text', plugin.rules['no-hardcoded-text'], {
  valid: [
    { filename: file, code: 'const A = () => <p>{t("title")}</p>;' },
    { filename: file, code: 'const A = () => <p>{t("count", { n: 3 })} · {n}</p>;' },
    { filename: file, code: 'const A = () => <p>12 / 30 · — ×</p>;' },
    { filename: file, code: 'const A = () => <span>Stop Biting</span>;' },
    { filename: file, code: 'const A = () => <a href="https://example.com" className="flex items-center gap-2" id="the-id" type="button" />;' },
    { filename: file, code: 'const A = () => <button aria-label={t("close")} title={t("close")} />;' },
    { filename: file, code: 'const A = () => <img alt="" src="/x.png" />;' },
    { filename: file, code: 'const A = () => <p>{cond ? t("a") : t("b")}</p>;' },
    { filename: file, code: 'const A = () => <p>{name}</p>;' },
    // a deliberate exception, with the reason on the same line
    { filename: file, code: 'const A = () => <code>npm install</code>; // i18n-ignore: a shell command' },
    // files the scope list exempts are not checked at all
    { filename: 'src/pages/Landing.tsx', code: 'const A = () => <h1>Stop biting your nails</h1>;' },
    { filename: 'src/components/site/BlogMidCta.tsx', code: 'const A = () => <p>All rights reserved</p>;' },
    { filename: 'src/data/example.tsx', code: 'export const x = <p>Anything at all</p>;' },
    { filename: 'src/pages/Log.test.tsx', code: 'const A = () => <p>Expected text</p>;' },
  ],
  invalid: [
    { filename: file, code: 'const A = () => <p>Save your changes</p>;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <p>Hello <b>there</b></p>;', errors: [{ messageId: 'hardcoded' }, { messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <button aria-label="Close dialog" />;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <input placeholder="Type a name" />;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <img alt="A chart of your week" />;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <div title="More info" />;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <Tip tooltip="Hands away" />;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <Row label={"Sensitivity"} />;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <Row description={`Runs ${n} times`} />;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <p>{"Literal child"}</p>;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <p>{n === 1 ? "alarm" : "alarms"}</p>;', errors: [{ messageId: 'hardcoded' }, { messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <p>{ok && "All good"}</p>;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <p>{`${n} days left`}</p>;', errors: [{ messageId: 'hardcoded' }] },
    { filename: file, code: 'const A = () => <p>{"Saved" + (n ? "!" : "")}</p>;', errors: [{ messageId: 'hardcoded' }] },
    // a file that is not on the exemption list is checked, wherever it lives
    { filename: 'src/somewhere/New.tsx', code: 'const A = () => <h2>A brand new screen</h2>;', errors: [{ messageId: 'hardcoded' }] },
    // the product name does not excuse the words around it
    { filename: file, code: 'const A = () => <p>Stop Biting is watching</p>;', errors: [{ messageId: 'hardcoded' }] },
  ],
});

tester.run('no-english-literals', plugin.rules['no-english-literals'], {
  valid: [
    { filename: file, code: 'const x = t("title");' },
    { filename: file, code: 'import x from "./some thing words/path";' },
    { filename: file, code: 'const cls = "flex items-center justify-between rounded-full";' },
    { filename: file, code: 'const q = "(pointer: coarse) and (max-width: 767px)";' },
    { filename: file, code: 'throw new Error("Could not read the file");' },
    { filename: file, code: 'console.warn("Storage is unavailable; using memory");' },
    { filename: file, code: 'if (kind === "Some Value") {}' },
    { filename: file, code: 'type A = "Some Literal Type";' },
    { filename: file, code: 'const o = { "Some Key": 1 };' },
    { filename: file, code: 'const s = "stress"; const id = "pause-15m"; const url = "/api/user/me";' },
    { filename: file, code: 'const x = "Hello there"; // i18n-ignore: a test fixture' },
    { filename: file, code: 'const A = () => <p className="Capital words in a class">{t("a")}</p>;' }, // attributes are the other rule's business
    { filename: 'src/pages/Landing.tsx', code: 'const x = "Stop biting your nails today";' },
    { filename: 'src/data/blogPosts.ts', code: 'const x = "Nail biting is common.";' },
    { filename: 'src/i18n/scopes/watch.ts', code: 'export const messages = { title: "Watch", note: "Your hands are near your mouth." };' },
  ],
  invalid: [
    { filename: file, code: 'const x = "Nail biting detected.";', errors: [{ messageId: 'english' }] },
    { filename: file, code: 'const x = "Could not save your changes";', errors: [{ messageId: 'english' }] },
    { filename: file, code: 'showToast("Saved to this device");', errors: [{ messageId: 'english' }] },
    { filename: file, code: 'new Notification("Stop biting!", { body: "Nail biting detected — take your hands away." });', errors: [{ messageId: 'english' }, { messageId: 'english' }] },
    { filename: file, code: 'const x = `Last synced ${when} on this device.`;', errors: [{ messageId: 'english' }] },
    { filename: file, code: 'const o = { label: "Stress", value: "stress" };', errors: [{ messageId: 'english' }] },
    { filename: file, code: 'const o = { title: "Hands check" };', errors: [{ messageId: 'english' }] },
    { filename: file, code: 'document.title = "Alert! Hands away";', errors: [{ messageId: 'english' }] },
    { filename: file, code: 'const f = () => (ok ? "You are online." : "You are offline.");', errors: [{ messageId: 'english' }, { messageId: 'english' }] },
    { filename: file, code: 'const A = () => <button onClick={() => setError("Something went wrong")}>x</button>;', errors: [{ messageId: 'english' }] },
    { filename: file, code: 'const x = "Try the free plan or sign in to continue";', errors: [{ messageId: 'english' }] },
    // a lowercase phrase with function words is still copy
    { filename: file, code: 'const x = "just now and again";', errors: [{ messageId: 'english' }] },
  ],
});

describe('heuristics', () => {
  it('hasEnglishWord ignores product names, symbols and numbers', () => {
    expect(hasEnglishWord('Stop Biting')).toBe(false);
    expect(hasEnglishWord('Google')).toBe(false);
    expect(hasEnglishWord('12 · 30 — ×')).toBe(false);
    expect(hasEnglishWord('x')).toBe(false);
    expect(hasEnglishWord('Hi')).toBe(true);
  });

  it('looksLikeEnglishCopy tells prose from code-ish strings', () => {
    for (const prose of ['Nail biting detected.', 'Could not read the file', 'a day or two', 'Hands check']) expect(looksLikeEnglishCopy(prose), prose).toBe(true);
    for (const code of ['flex items-center', 'rounded-full px-3', 'hidden sm:block', 'pause-15m', '/api/user/me', 'sb:i18n:locale', '(pointer: coarse)', 'MMM d, yyyy', 'h:mm a']) {
      expect(looksLikeEnglishCopy(code), code).toBe(false);
    }
  });
});
