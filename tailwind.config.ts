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
        background: "#111318",
        surface: "#1b1f27",
        "surface-elevated": "#222733",
        accent: "#90caf9",
        "accent-hover": "#b3e0ff",
        danger: "#ff8a80",
        success: "#81c784",
        warning: "#ffcc80",
        "text-primary": "#eef2f8",
        "text-muted": "#b3bbc9",
        border: "#303747",
      },
      borderRadius: {
        DEFAULT: "0.75rem",
      },
      fontFamily: {
        sans: ["Roboto", "Noto Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
