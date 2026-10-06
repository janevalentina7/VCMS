/** @type {import('tailwindcss').Config} */
const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens - driven by CSS variables so light/dark mode is a
        // single class swap on <html> (see src/index.css).
        canvas: withOpacity('--vcms-canvas'),
        surface: withOpacity('--vcms-surface'),
        elevated: withOpacity('--vcms-elevated'),
        line: withOpacity('--vcms-border'),
        ink: withOpacity('--vcms-text'),
        muted: withOpacity('--vcms-muted'),
        primary: {
          DEFAULT: withOpacity('--vcms-primary'),
          soft: withOpacity('--vcms-primary-soft'),
          dark: withOpacity('--vcms-primary-dark'),
          fg: withOpacity('--vcms-primary-fg'),
        },
        accent: withOpacity('--vcms-accent'),
        success: { DEFAULT: withOpacity('--vcms-success'), soft: withOpacity('--vcms-success-soft') },
        warning: { DEFAULT: withOpacity('--vcms-warning'), soft: withOpacity('--vcms-warning-soft') },
        danger: { DEFAULT: withOpacity('--vcms-danger'), soft: withOpacity('--vcms-danger-soft') },
        info: { DEFAULT: withOpacity('--vcms-info'), soft: withOpacity('--vcms-info-soft') },
        // Static brand ramp for charts and accents that must not shift with theme.
        gov: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd0ff',
          300: '#8eb0ff',
          400: '#5a86fc',
          500: '#3563f6',
          600: '#2044eb',
          700: '#1b34d8',
          800: '#1d2fae',
          900: '#1d2f89',
          950: '#151f52',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Tamil', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        tamil: ['Noto Sans Tamil', 'Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        raised: '0 10px 30px -12px rgb(15 23 42 / 0.25)',
        focus: '0 0 0 3px rgb(var(--vcms-primary) / 0.28)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-in-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } },
      },
      animation: {
        'fade-in': 'fade-in .28s ease-out both',
        'fade-in-up': 'fade-in-up .32s cubic-bezier(.22,.61,.36,1) both',
        'slide-in-right': 'slide-in-right .26s ease-out both',
        'scale-in': 'scale-in .18s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(.22,.61,.36,1)',
      },
    },
  },
  plugins: [],
};
