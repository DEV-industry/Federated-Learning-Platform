import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        argon: {
          primary: "#5e72e4",
          "primary-dark": "#4454c3",
          success: "#2dce89",
          "success-dark": "#24a46d",
          danger: "#f5365c",
          "danger-dark": "#d6293e",
          warning: "#fb6340",
          "warning-dark": "#da4b2a",
          info: "#11cdef",
          "info-dark": "#0da5c0",
          default: "#172b4d",
          secondary: "#f7fafc",
          muted: "#8898aa",
          light: "#adb5bd",
          lighter: "#e9ecef",
          bg: "#f8f9fe",
          "card-bg": "#ffffff",
        },
      },
      boxShadow: {
        argon: "0 0 2rem 0 rgba(136, 152, 170, 0.15)",
        "argon-lg": "0 0 3rem 0 rgba(136, 152, 170, 0.2)",
        "argon-sm": "0 0 1rem 0 rgba(136, 152, 170, 0.1)",
        "argon-primary": "0 4px 6px rgba(94, 114, 228, 0.4)",
        "argon-success": "0 4px 6px rgba(45, 206, 137, 0.4)",
        "argon-danger": "0 4px 6px rgba(245, 54, 92, 0.4)",
        "argon-warning": "0 4px 6px rgba(251, 99, 64, 0.4)",
        "argon-info": "0 4px 6px rgba(17, 205, 239, 0.4)",
      },
      borderRadius: {
        argon: "0.375rem",
        "argon-lg": "0.5rem",
      },
      fontFamily: {
        sans: ['"Open Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
