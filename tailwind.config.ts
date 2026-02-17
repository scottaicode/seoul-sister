import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#A8D8EA',
          600: '#7cc0d8',
          700: '#5ba8c0',
        },
        gold: {
          DEFAULT: '#C9A55C',
          light: '#D4B87A',
          dark: '#A8863A',
          muted: '#8B7340',
        },
        rose: {
          gold: '#D4A574',
          light: '#E8C5A8',
          dark: '#B8845A',
        },
        seoul: {
          pink: '#F5E6E0',
          blush: '#FADADD',
          cream: '#FFF8F0',
          pearl: '#F8F4F0',
          white: '#FEFEFE',
          charcoal: '#2D2D2D',
          soft: '#6B7280',
          // Dark theme additions
          dark: '#0D0D0F',
          darker: '#111114',
          card: '#1A1A1E',
          'card-border': '#2A2A2E',
          muted: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '375px',
        mobile: '390px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'glass-shimmer': 'glassShimmer 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glassShimmer: {
          '0%, 100%': { backgroundPosition: '200% center' },
          '50%': { backgroundPosition: '-200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(168,216,234,0.1) 0%, rgba(212,165,116,0.1) 100%)',
        'glass-gradient-strong': 'linear-gradient(135deg, rgba(168,216,234,0.2) 0%, rgba(212,165,116,0.2) 100%)',
        'seoul-gradient': 'linear-gradient(135deg, #0D0D0F 0%, #111114 50%, #0D0D0F 100%)',
        'hero-gradient': 'radial-gradient(ellipse at top, #1A1A1E 0%, #111114 40%, #0D0D0F 100%)',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.2)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.3)',
        'glass-xl': '0 16px 60px rgba(0, 0, 0, 0.4)',
        'glow-pink': '0 0 20px rgba(250, 218, 221, 0.4)',
        'glow-blue': '0 0 20px rgba(168, 216, 234, 0.4)',
        'glow-gold': '0 0 30px rgba(201, 165, 92, 0.3)',
        'glow-gold-lg': '0 0 60px rgba(201, 165, 92, 0.2), 0 0 120px rgba(201, 165, 92, 0.1)',
      },
    },
  },
  plugins: [],
}

export default config
