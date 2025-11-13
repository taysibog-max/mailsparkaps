/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#a855f7',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce'
        },
        accent: '#ec4899'
      },
      boxShadow: {
        soft: '0 8px 40px rgba(168,85,247,0.25)',
        glow: '0 0 60px rgba(168,85,247,0.6)',
        'glow-sm': '0 0 30px rgba(168,85,247,0.4)',
        'glow-lg': '0 0 80px rgba(168,85,247,0.8)',
      },
      borderRadius: {
        xl: '14px'
      },
      animation: {
        'gradient-slow': 'gradient 6s ease infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-position': '0% 50%',
          },
          '50%': {
            'background-position': '100% 50%',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-20px)',
          },
        },
        glow: {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0.5',
          },
        },
        shimmer: {
          '0%': {
            transform: 'translateX(-100%)',
          },
          '100%': {
            transform: 'translateX(100%)',
          },
        },
      },
      backgroundSize: {
        '200%': '200%',
        '300%': '300%',
      },
    }
  },
  plugins: []
};


