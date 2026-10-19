/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Brand signature colors
        brand: {
          pink:   '#ec4899',
          red:    '#ef4444',
          amber:  '#f59e0b',
        },
        // Primary indigo kept for compatibility
        primary: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fd',
          300: '#a5bafc',
          400: '#8193f8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Canvas dark colors per spec
        void: {
          dark:  '#09090e',
          card1: '#111118',
          card2: '#0d0d14',
        },
      },
      backgroundImage: {
        // Signature brand gradient
        'brand-gradient':   'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)',
        // Hero banner gradient
        'hero-gradient':    'linear-gradient(135deg, rgba(88,28,135,0.4) 0%, #0f172a 50%, rgba(131,24,67,0.4) 100%)',
        // Subtle card gradient
        'card-gradient':    'linear-gradient(135deg, rgba(17,17,24,0.9), rgba(13,13,20,0.95))',
      },
      animation: {
        'fade-in':      'fadeIn 0.5s ease-in-out',
        'fade-in-up':   'fadeInUp 0.5s ease-out',
        'slide-up':     'slideUp 0.4s ease-out',
        'slide-down':   'slideDown 0.4s ease-out',
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'float':        'float 6s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'spin-slow':    'spin 8s linear infinite',
        'bounce-slow':  'bounce 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(236,72,153,0.3)' },
          '50%':       { boxShadow: '0 0 40px rgba(236,72,153,0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      backdropBlur: {
        xs: '2px',
        '4xl': '72px',
      },
      boxShadow: {
        'brand':         '0 4px 32px rgba(236,72,153,0.25)',
        'brand-lg':      '0 8px 48px rgba(236,72,153,0.35)',
        'brand-sm':      '0 2px 12px rgba(236,72,153,0.2)',
        'glow-pink':     '0 0 40px rgba(236,72,153,0.3)',
        'glow-red':      '0 0 40px rgba(239,68,68,0.3)',
        'card-dark':     '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        'card-glow':     '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(236,72,153,0.15)',
        'glass':         '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
      },
    },
  },
  plugins: [],
};
