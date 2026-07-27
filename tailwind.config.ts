import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        base: {
          950: "#05070d",
          900: "#0a0f1e",
          800: "#101627",
          700: "#1a2138",
          600: "#252d4a",
        },
        accent: {
          500: "#6d5bf8",
          600: "#5a47e6",
          400: "#8b7dfb",
        },
        brand: {
          blue: "#2e5aac",
          navy: "#1f2a44",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #6d5bf8 0%, #2e5aac 100%)",
        "hero-glow":
          "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(109,91,248,0.22), transparent), radial-gradient(ellipse 40% 30% at 85% 0%, rgba(46,90,172,0.18), transparent)",
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(109,91,248,0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
