/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Fallback theme only — the real, live theme is fetched from
        // GET /config at bootstrap (Phase 1) since the backend is
        // white-label. These two values are just the pre-fetch default.
        navy: '#1F3A5F',
        red: '#FF2147',
      },
    },
  },
  plugins: [],
}