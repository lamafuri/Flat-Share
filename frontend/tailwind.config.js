/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Custom screens for finer control
    screens: {
      'xs': '375px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Fluid typography
        'fluid-sm': 'clamp(0.75rem, 2vw, 0.875rem)',
        'fluid-base': 'clamp(0.875rem, 2.5vw, 1rem)',
        'fluid-lg': 'clamp(1rem, 3vw, 1.125rem)',
        'fluid-xl': 'clamp(1.125rem, 3.5vw, 1.25rem)',
        'fluid-2xl': 'clamp(1.25rem, 4vw, 1.5rem)',
        'fluid-3xl': 'clamp(1.5rem, 5vw, 1.875rem)',
      },
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#111118',
          800: '#1c1c26',
          700: '#2a2a38',
          600: '#3d3d52',
          500: '#5c5c78',
          400: '#8080a0',
          300: '#a0a0be',
          200: '#c8c8dc',
          100: '#e8e8f0',
          50:  '#f4f4f8',
        },
        accent: {
          DEFAULT: '#6c63ff',
          light: '#8b85ff',
          dark: '#4e46d6',
        },
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
      },
      spacing: {
        // Safe area spacing
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
        // Bottom nav height
        'nav-h': '64px',
      },
      height: {
        'dvh': '100dvh',
        'screen-safe': 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
      minHeight: {
        'dvh': '100dvh',
      },
      maxWidth: {
        'content': '80rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      animation: {
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'nav': '0 -1px 0 0 rgba(255,255,255,0.05), 0 -8px 32px rgba(0,0,0,0.4)',
        'modal': '0 25px 50px rgba(0,0,0,0.6)',
        'card': '0 4px 16px rgba(0,0,0,0.3)',
      },
      backdropBlur: {
        'nav': '16px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
