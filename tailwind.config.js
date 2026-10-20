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
        sans: ['"Geist"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Geist"', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', '"SF Mono"', 'ui-monospace', 'monospace'],
      },
      // Bolder, rounder surfaces across the whole app: one lever instead of
      // touching every card.
      borderRadius: {
        lg: '0.875rem',
        xl: '1.25rem',
        '2xl': '1.75rem',
        '3xl': '2.25rem',
      },
      boxShadow: {
        // Flat system: cards are separated by ground and a hairline, not shadow.
        'card': 'none',
        'card-md': '0 1px 0 oklch(0% 0 0 / 0.04)',
        'card-dark': 'none',
        'card-md-dark': 'none',
      },
      colors: {
        // ── Light mode: Warm cream base ───────────────────────────────────
        cream: {
          50:  'oklch(99%   0.004 105 / <alpha-value>)',
          100: 'oklch(97.6% 0.008 105 / <alpha-value>)',
          200: 'oklch(95.5% 0.012 110 / <alpha-value>)',
          300: 'oklch(90%   0.014 115 / <alpha-value>)',
        },
        paper: 'oklch(97.6% 0.008 105 / <alpha-value>)',
        cream2: 'oklch(95.5% 0.012 110 / <alpha-value>)',
        // ── Light mode: Warm stone neutrals (green-tinted) ────────────────
        stone: {
          100: 'oklch(94%   0.010 150 / <alpha-value>)',
          200: 'oklch(90%   0.012 140 / <alpha-value>)',
          300: 'oklch(78%   0.016 150 / <alpha-value>)',
          400: 'oklch(62%   0.018 155 / <alpha-value>)',
          500: 'oklch(50%   0.02  158 / <alpha-value>)',
          600: 'oklch(42%   0.025 160 / <alpha-value>)',
          700: 'oklch(32%   0.028 160 / <alpha-value>)',
          800: 'oklch(23%   0.03  160 / <alpha-value>)',
          900: 'oklch(17%   0.03  160 / <alpha-value>)',
        },
        // ── Dark mode surfaces ────────────────────────────────────────────
        // ink-* mirrors cream-* but deep — used as bg in dark mode
        ink: {
          50:  'oklch(18%   0.02 165 / <alpha-value>)',   // lightest surface (cards)
          100: 'oklch(15%   0.02 165 / <alpha-value>)',   // default page bg
          200: 'oklch(13%   0.018 165 / <alpha-value>)',   // sidebar / deeper
          300: 'oklch(11%   0.016 165 / <alpha-value>)',   // deepest surfaces
          // Borders, tracks and hover fills in dark mode. Was 9% L: darker than
          // every surface it separates (ink-100 15%, ink-50 18%), so all 73
          // dark:border-ink-400 card edges and dividers were invisible. 30% L
          // sits above the surfaces, like the --ed-hairline fix (32%).
          400: 'oklch(30%   0.018 165 / <alpha-value>)',
          // Controls and tracks that sit on a card (segmented controls, chips,
          // secondary buttons). They used ink-300 (11% L), darker than the 18%
          // card, so in dark mode every button read as a hole cut in it.
          fill: 'oklch(24%   0.02 165 / <alpha-value>)',
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
        // ── Signal lime: the one highlight (deep surfaces, streak, CTAs) ──
        lime: {
          200: 'oklch(96%   0.12  124 / <alpha-value>)',
          300: 'oklch(90%   0.20  124 / <alpha-value>)',
          400: 'oklch(84%   0.19  124 / <alpha-value>)',
        },
        ember: 'oklch(75% 0.16 50 / <alpha-value>)',
        deep: {
          DEFAULT: 'oklch(25% 0.05 162 / <alpha-value>)',
          2: 'oklch(31% 0.06 160 / <alpha-value>)',
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
