/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px oklch(0% 0 0 / 0.06), 0 1px 2px oklch(0% 0 0 / 0.04)',
        'card-md': '0 4px 12px oklch(0% 0 0 / 0.08), 0 1px 3px oklch(0% 0 0 / 0.04)',
        'card-dark': '0 1px 3px oklch(0% 0 0 / 0.30), 0 1px 2px oklch(0% 0 0 / 0.20)',
        'card-md-dark': '0 4px 12px oklch(0% 0 0 / 0.40), 0 1px 3px oklch(0% 0 0 / 0.25)',
      },
      colors: {
        // ── Light mode: Warm cream base ───────────────────────────────────
        cream: {
          50:  'oklch(99%   0.004 80 / <alpha-value>)',
          100: 'oklch(97%   0.012 80 / <alpha-value>)',
          200: 'oklch(93%   0.016 80 / <alpha-value>)',
          300: 'oklch(88%   0.018 80 / <alpha-value>)',
        },
        paper: 'oklch(99% 0.005 80 / <alpha-value>)',
        cream2: 'oklch(95% 0.013 80 / <alpha-value>)',
        // ── Light mode: Warm stone neutrals (green-tinted) ────────────────
        stone: {
          100: 'oklch(94%   0.010 120 / <alpha-value>)',
          200: 'oklch(88%   0.014 120 / <alpha-value>)',
          300: 'oklch(78%   0.016 120 / <alpha-value>)',
          400: 'oklch(62%   0.018 120 / <alpha-value>)',
          500: 'oklch(50%   0.018 120 / <alpha-value>)',
          600: 'oklch(40%   0.016 120 / <alpha-value>)',
          700: 'oklch(30%   0.014 120 / <alpha-value>)',
          800: 'oklch(22%   0.012 120 / <alpha-value>)',
          900: 'oklch(15%   0.010 120 / <alpha-value>)',
        },
        // ── Dark mode surfaces ────────────────────────────────────────────
        // ink-* mirrors cream-* but deep — used as bg in dark mode
        ink: {
          50:  'oklch(18%   0.010 200 / <alpha-value>)',   // lightest surface (cards)
          100: 'oklch(15%   0.010 200 / <alpha-value>)',   // default page bg
          200: 'oklch(13%   0.008 200 / <alpha-value>)',   // sidebar / deeper
          300: 'oklch(11%   0.006 200 / <alpha-value>)',   // deepest surfaces
          400: 'oklch(9%    0.005 200 / <alpha-value>)',   // borders (subtle)
        },
        // ── Scoped editorial hairline (src/index.css `--ed-hairline`) ─────
        // Generates border-hairline / bg-hairline / divide-hairline. No
        // <alpha-value> here — a var() can't carry the placeholder, so this
        // token has no opacity modifier (no `border-hairline/50`). The
        // light/dark flip lives entirely in the CSS variable, so call sites
        // need no `dark:` variant.
        hairline: 'var(--ed-hairline)',
        // ── Forest green accent ───────────────────────────────────────────
        forest: {
          50:  'oklch(96%   0.030 148 / <alpha-value>)',
          100: 'oklch(92%   0.055 148 / <alpha-value>)',
          200: 'oklch(84%   0.080 148 / <alpha-value>)',
          300: 'oklch(70%   0.110 148 / <alpha-value>)',
          400: 'oklch(58%   0.130 148 / <alpha-value>)',
          500: 'oklch(46%   0.130 148 / <alpha-value>)',
          600: 'oklch(38%   0.120 148 / <alpha-value>)',
          700: 'oklch(30%   0.100 148 / <alpha-value>)',
          800: 'oklch(22%   0.075 148 / <alpha-value>)',
          900: 'oklch(15%   0.050 148 / <alpha-value>)',
        },
        // ── Warm amber for streak/trophy ──────────────────────────────────
        amber: {
          400: 'oklch(76%   0.155  75 / <alpha-value>)',
          500: 'oklch(68%   0.160  75 / <alpha-value>)',
        },
        // ── Alert red (softer, warmer) ────────────────────────────────────
        alert: {
          100: 'oklch(94%   0.045  25 / <alpha-value>)',
          400: 'oklch(62%   0.180  25 / <alpha-value>)',
          600: 'oklch(46%   0.170  25 / <alpha-value>)',
          800: 'oklch(28%   0.100  25 / <alpha-value>)',
          900: 'oklch(20%   0.070  25 / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
