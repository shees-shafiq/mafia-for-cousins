/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          primary: '#080810',
          card: '#10101c',
          hover: '#18182a',
          border: '#1e1e32',
        },
        accent: {
          violet: '#7c3aed',
          'violet-light': '#a855f7',
          red: '#ef4444',
          'red-light': '#f87171',
          green: '#10b981',
          'green-light': '#34d399',
          yellow: '#f59e0b',
          'yellow-light': '#fbbf24',
          blue: '#3b82f6',
        },
        text: {
          primary: '#e2e8f0',
          secondary: '#94a3b8',
          muted: '#475569',
        },
      },
      boxShadow: {
        'glow-violet': '0 0 20px rgba(124, 58, 237, 0.35)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.35)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.35)',
        'glow-yellow': '0 0 25px rgba(245, 158, 11, 0.5)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.35)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(245, 158, 11, 0.9), 0 0 70px rgba(245, 158, 11, 0.3)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
