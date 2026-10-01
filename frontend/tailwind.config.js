/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        card: {
          DEFAULT: "var(--surface-primary, #10121C)",
          foreground: "var(--text-primary, #FFFFFF)",
        },
        muted: {
          DEFAULT: "var(--surface-hover, rgba(255, 255, 255, 0.06))",
          foreground: "var(--text-muted, #94A3B8)",
        },
      },
    },
  },
  plugins: [],
}
