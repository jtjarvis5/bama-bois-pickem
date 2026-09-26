export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crimson: { DEFAULT: '#9E1B32', deep: '#5C0E1A', bright: '#C4293F' },
        ink: '#16181A',
        paper: '#F8F7F5',
        line: '#E7E5E2',
        muted: '#6B6F76',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
