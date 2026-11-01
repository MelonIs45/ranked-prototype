/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0f0b17', 900: '#16111f', 850: '#1c1628', 800: '#241c33', 700: '#2f2542', 600: '#3d3155', 500: '#5a4c78' },
        lab: { pink: '#ff66aa', rose: '#ff8fc2', violet: '#a37cff', sky: '#66ccff', mint: '#6fe0b0', amber: '#ffc56b', red: '#ff6b6b' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
