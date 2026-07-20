/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef3f9",
          100: "#d7e3f1",
          200: "#aec7e3",
          300: "#7fa6d2",
          400: "#4d80bc",
          500: "#2f639f",
          600: "#204b7d",
          700: "#193b62",
          800: "#132c4a",
          900: "#0b2c57",
          950: "#081d3a",
        },
        gold: {
          50: "#fffaeb",
          100: "#fef0c7",
          200: "#fde08a",
          300: "#fbca4d",
          400: "#f9b823",
          500: "#f5b400",
          600: "#d69300",
          700: "#b06f04",
          800: "#8f570b",
          900: "#75480e",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
