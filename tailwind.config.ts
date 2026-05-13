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
        background: "#0f0f1a",
        surface: "#1a1a2e",
        "surface-elevated": "#16213e",
        accent: "#3b82f6",
        "accent-hover": "#2563eb",
        danger: "#ef4444",
        success: "#22c55e",
        warning: "#f59e0b",
        "text-primary": "#f1f5f9",
        "text-muted": "#94a3b8",
        border: "#1e293b",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
