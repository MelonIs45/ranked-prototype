/** @type {import('tailwindcss').Config} */

// Tokens map onto osu-web's HSL variables (src/osu-theme.css), so every surface and text
// colour follows the current section hue. Radii and shadows follow osu-web's
// @border-radius-base (4px), @border-radius--large (10px) and .default-box-shadow().
const v = (name) => `hsla(var(--hsl-${name}), <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    borderRadius: { none: '0', sm: '2px', DEFAULT: '4px', md: '4px', lg: '4px', xl: '10px', '2xl': '10px', '3xl': '20px', full: '9999px' },
    boxShadow: {
      none: 'none',
      sm: '0 1px 3px rgba(0, 0, 0, 0.25)',
      DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.25)',
      md: '0 1px 3px rgba(0, 0, 0, 0.25)',
      lg: '0 2px 10px rgba(0, 0, 0, 0.5)',
      xl: '0 2px 10px rgba(0, 0, 0, 0.5)',
      '2xl': '0 2px 20px rgba(0, 0, 0, 0.5)',
    },
    extend: {
      colors: {
        // Surfaces: osu-web b6 (page) to b1, plus f1 for faint rules.
        ink: { 950: v('b6'), 900: v('b5'), 850: v('b4'), 800: v('b3'), 700: v('b2'), 600: v('b1'), 500: v('f1') },
        // Text: c1 (primary) through f1 (faint).
        slate: { 100: v('c1'), 200: v('c1'), 300: v('c2'), 400: v('f1'), 500: v('b1'), 600: v('d1') },
        white: v('c1'),
        lab: {
          pink: v('h1'), // section highlight: links, active nav, chips
          rose: v('l1'), // highlight hover
          blue: v('h2'), // btn-osu-big background
          violet: v('purple-1'),
          sky: v('blue-1'),
          mint: v('lime-1'),
          amber: v('orange-1'),
          red: v('red-2'),
        },
      },
      fontFamily: {
        // Torus is licensed to ppy and can't be redistributed; Nunito is the free stand-in.
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        mono: ['Nunito', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
