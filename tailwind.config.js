/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a1628',
          800: '#0f2244',
          700: '#132d5e',
          600: '#183878',
        },
      },
    },
  },
  plugins: [],
};
