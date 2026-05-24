import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          50: "#f4f7fb",
          100: "#e6eef7",
          200: "#c8d6e6",
          300: "#9eb5ce",
          400: "#6a87a8",
          500: "#476485",
          600: "#324c69",
          700: "#1f3450",
          800: "#0e1f33",
          900: "#06121f",
          950: "#03080f",
        },
        gulf: {
          50: "#ecfdfa",
          100: "#cffaf2",
          200: "#9ef3e5",
          300: "#65e6d3",
          400: "#2dd1bd",
          500: "#11b6a4",
          600: "#089285",
          700: "#0a746b",
          800: "#0c5c56",
          900: "#0c4c48",
          950: "#022b2a",
        },
        sand: {
          50: "#fff8ec",
          100: "#feedc8",
          200: "#fdd98c",
          300: "#fbbd50",
          400: "#f9a228",
          500: "#f3820f",
          600: "#d76208",
          700: "#b34509",
          800: "#92370e",
          900: "#782e0f",
        },
        coral: {
          400: "#ff6f6f",
          500: "#ef4f4f",
        },
      },
      fontSize: {
        "display-2xl": ["clamp(3rem, 7vw + 1rem, 6.25rem)", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
        "display-xl": ["clamp(2.5rem, 5vw + 1rem, 4.5rem)", { lineHeight: "1", letterSpacing: "-0.035em" }],
        "display-lg": ["clamp(2rem, 3vw + 1rem, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },
      boxShadow: {
        glow: "0 30px 80px -30px rgba(17, 182, 164, 0.55)",
        "glow-sand": "0 30px 80px -30px rgba(249, 162, 40, 0.45)",
        soft: "0 1px 2px rgba(15,32,51,0.05), 0 8px 24px -8px rgba(15,32,51,0.08)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.6)", opacity: "0.8" },
          "80%": { transform: "scale(2.2)", opacity: "0" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "drift": {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-14px,0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        "drift": "drift 14s ease-in-out infinite",
        "shimmer": "shimmer 6s linear infinite",
      },
    },
  },
  plugins: [typography],
};

export default config;
