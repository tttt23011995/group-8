/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a1628',
          800: '#0f2244',
          700: '#132d5e',
          600: '#183878',
        },
        // Theme-aware semantic colors (use with CSS vars)
        themed: {
          bg: 'var(--bg)',
          'bg-soft': 'var(--bg-soft)',
          surface: 'var(--surface)',
          'surface-strong': 'var(--surface-strong)',
          text: 'var(--text)',
          muted: 'var(--muted)',
          accent: 'var(--accent)',
          'accent-2': 'var(--accent-2)',
          success: 'var(--success)',
          warning: 'var(--warning)',
          danger: 'var(--danger)',
          'glass-bg': 'var(--glass-bg)',
          'glass-bg-strong': 'var(--glass-bg-strong)',
          'glass-border': 'var(--glass-border)',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
      transitionTimingFunction: {
        glass: 'var(--ease-glass)',
      },
    },
  },
  plugins: [],
};
