/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#df2531',
        background: '#0B0E14',
        card: '#151921',
        border: '#232838',
      },
    },
  },
  plugins: [],
}
