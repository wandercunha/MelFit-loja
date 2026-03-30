import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf8f0",
          100: "#f5ead4",
          200: "#e8d5a8",
          300: "#daa520",
          400: "#b8860b",
          500: "#8b6914",
          600: "#6b5010",
          700: "#4a380b",
        },
        surface: {
          DEFAULT: "#faf8f5",
          card: "#ffffff",
          dark: "#1a1a1a",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
