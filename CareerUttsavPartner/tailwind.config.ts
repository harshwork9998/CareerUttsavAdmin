import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#14121A",
          soft: "#3A3742",
          muted: "#6B6775",
        },
        paper: {
          DEFAULT: "#FBFAF3",
          dim: "#F2EFE4",
          surface: "#FFFFFF",
        },
        cu: {
          red: "#E5372B",
          "red-dark": "#B82A20",
          "red-soft": "#FDE5E2",
          blue: "#1E3FE0",
          "blue-dark": "#132CA0",
          "blue-soft": "#E3E8FD",
          yellow: "#FFC530",
          "yellow-soft": "#FFF3D6",
          green: "#1F9E63",
          "green-soft": "rgba(31, 158, 99, 0.14)",
        },
        line: {
          DEFAULT: "rgba(20, 18, 26, 0.12)",
          strong: "rgba(20, 18, 26, 0.18)",
        },
        // Back-compat aliases used across existing components
        brand: {
          50: "#E3E8FD",
          100: "#E3E8FD",
          500: "#1E3FE0",
          700: "#132CA0",
          800: "#132CA0",
          950: "#14121A",
        },
        brass: {
          100: "#FFF3D6",
          500: "#FFC530",
          700: "#B82A20",
        },
        success: {
          DEFAULT: "#1F9E63",
          soft: "rgba(31, 158, 99, 0.14)",
        },
        teal: {
          50: "#E3E8FD",
          600: "#1E3FE0",
          700: "#132CA0",
        },
      },
      boxShadow: {
        soft: "0 20px 60px -20px rgba(20, 18, 26, 0.25)",
        card: "0 12px 30px -12px rgba(20, 18, 26, 0.18)",
        red: "0 10px 24px -8px rgba(229, 55, 43, 0.55)",
      },
      borderRadius: {
        "4xl": "28px",
      },
      transitionTimingFunction: {
        cu: "cubic-bezier(0.16, 0.84, 0.44, 1)",
      },
      keyframes: {
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "none" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.55s cubic-bezier(0.16, 0.84, 0.44, 1)",
        marquee: "marquee 28s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
