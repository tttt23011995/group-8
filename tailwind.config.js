/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: 'var(--navy-900)',
          800: 'var(--navy-800)',
          700: 'var(--navy-700)',
          600: '#183878',
        },
        theme: {
          bg: 'var(--bg)',
          'bg-soft': 'var(--bg-soft)',
          glass: 'var(--glass)',
          'glass-strong': 'var(--glass-strong)',
          text: 'var(--text)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          accent: 'var(--accent)',
          cyan: 'var(--cyan)',
          success: 'var(--success)',
          warning: 'var(--warning)',
          danger: 'var(--danger)',
        },
      },
      borderRadius: {
        'card': '24px',
        'modal': '28px',
      },
      boxShadow: {
        'glass': '0 4px 24px -4px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'glass-hover': '0 8px 32px -4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'dropdown': '0 16px 48px -8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      transitionTimingFunction: {
        'glass': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        'glass': '200ms',
      },
    },
  },
  plugins: [],
};
