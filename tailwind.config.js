/** @type {import('tailwindcss').Config} */

// Plum-grey surfaces with pink links and blue primary buttons. Corners are near-square and
// nothing casts a shadow: hierarchy comes from borders, spacing and type weight.
const square = { none: '0', sm: '2px', DEFAULT: '2px', md: '2px', lg: '2px', xl: '3px', '2xl': '3px', '3xl': '3px', full: '3px' };
const flat = { sm: 'none', DEFAULT: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none', inner: 'none' };

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    borderRadius: square,
    boxShadow: flat,
    extend: {
      colors: {
        // Surfaces: dusky plum-grey, darkest to lightest.
        ink: { 950: '#211a1e', 900: '#2a2226', 850: '#30272c', 800: '#382e33', 700: '#463a40', 600: '#584a51', 500: '#75656d' },
        // Text greys with the same plum undertone.
        slate: { 100: '#f3eaee', 200: '#e6dbe0', 300: '#d1c3ca', 400: '#ab9aa2', 500: '#86757d', 600: '#64555c' },
        white: '#f7f0f3',
        lab: {
          pink: '#ff66ab', // links, highlights, active nav
          rose: '#ff8fc4', // link hover
          blue: '#3a8fd0', // primary buttons
          violet: '#a58bd6', // BN role, Level Design
          sky: '#6cb5e6', // Qualified, Mechanics
          mint: '#94c76a', // Ranked
          amber: '#e8b84f', // Pending, stars
          red: '#e5626b', // NAT, errors
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
