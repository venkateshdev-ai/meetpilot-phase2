import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#05070d",
          900: "#0a0f1e",
          800: "#101627",
          700: "#1a2138",
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
      },
    },
  },
  plugins: [],
};

export default config;
