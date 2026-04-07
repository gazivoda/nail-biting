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
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Inter"', '"Segoe UI"', 'sans-serif'],
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
          50:  'oklch(99%   0.004 80)',
          100: 'oklch(97%   0.012 80)',
          200: 'oklch(93%   0.016 80)',
          300: 'oklch(88%   0.018 80)',
        },
        // ── Light mode: Warm stone neutrals (green-tinted) ────────────────
        stone: {
          100: 'oklch(94%   0.010 120)',
          200: 'oklch(88%   0.014 120)',
          300: 'oklch(78%   0.016 120)',
          400: 'oklch(62%   0.018 120)',
          500: 'oklch(50%   0.018 120)',
          600: 'oklch(40%   0.016 120)',
          700: 'oklch(30%   0.014 120)',
          800: 'oklch(22%   0.012 120)',
          900: 'oklch(15%   0.010 120)',
        },
        // ── Dark mode surfaces ────────────────────────────────────────────
        // ink-* mirrors cream-* but deep — used as bg in dark mode
        ink: {
          50:  'oklch(18%   0.010 200)',   // lightest surface (cards)
          100: 'oklch(15%   0.010 200)',   // default page bg
          200: 'oklch(13%   0.008 200)',   // sidebar / deeper
          300: 'oklch(11%   0.006 200)',   // deepest surfaces
          400: 'oklch(9%    0.005 200)',   // borders (subtle)
        },
        // ── Forest green accent ───────────────────────────────────────────
        forest: {
          50:  'oklch(96%   0.030 148)',
          100: 'oklch(92%   0.055 148)',
          200: 'oklch(84%   0.080 148)',
          300: 'oklch(70%   0.110 148)',
          400: 'oklch(58%   0.130 148)',
          500: 'oklch(46%   0.130 148)',
          600: 'oklch(38%   0.120 148)',
          700: 'oklch(30%   0.100 148)',
          800: 'oklch(22%   0.075 148)',
          900: 'oklch(15%   0.050 148)',
        },
        // ── Warm amber for streak/trophy ──────────────────────────────────
        amber: {
          400: 'oklch(76%   0.155  75)',
          500: 'oklch(68%   0.160  75)',
        },
        // ── Alert red (softer, warmer) ────────────────────────────────────
        alert: {
          100: 'oklch(94%   0.045  25)',
          400: 'oklch(62%   0.180  25)',
          600: 'oklch(46%   0.170  25)',
          800: 'oklch(28%   0.100  25)',
          900: 'oklch(20%   0.070  25)',
        },
      },
    },
  },
  plugins: [],
}
