import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        node: {
          bg: "#0a0d1a",
          "bg-secondary": "#0f1225",
          card: "#141832",
          "card-hover": "#1a1f42",
          border: "#1e2345",
          "border-light": "#2a2f55",
          "text-primary": "#e2e8f0",
          "text-secondary": "#94a3b8",
          "text-muted": "#64748b",
        },
        argon: {
          primary: "#5e72e4",
          "primary-dark": "#4454c3",
          "primary-light": "#7c8ef2",
          success: "#2dce89",
          "success-dark": "#24a46d",
          danger: "#f5365c",
          "danger-dark": "#d6293e",
          warning: "#fb6340",
          "warning-dark": "#da4b2a",
          info: "#11cdef",
          "info-dark": "#0da5c0",
        },
      },
      boxShadow: {
        "node-card": "0 0 30px 0 rgba(0, 0, 0, 0.3)",
        "node-glow": "0 0 20px rgba(94, 114, 228, 0.15)",
        "node-glow-success": "0 0 20px rgba(45, 206, 137, 0.15)",
        "node-glow-danger": "0 0 20px rgba(245, 54, 92, 0.15)",
      },
      borderRadius: {
        node: "0.75rem",
        "node-lg": "1rem",
      },
      fontFamily: {
        sans: ['"Inter"', '"Open Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "shield-glow": "shield-glow 3s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(94, 114, 228, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(94, 114, 228, 0)" },
        },
        "shield-glow": {
          "0%, 100%": { filter: "drop-shadow(0 0 6px rgba(45, 206, 137, 0.4))" },
          "50%": { filter: "drop-shadow(0 0 16px rgba(45, 206, 137, 0.7))" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
