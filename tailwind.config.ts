import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: [
          "var(--font-fraunces)",
          "Fraunces",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#1F3864",
          foreground: "#FFFFFF",
          50: "#F3F6FA",
          100: "#E8EEF6",
          500: "#3A5F96",
          600: "#2A4A7A",
          700: "#1F3864",
          800: "#1A2F52",
          900: "#12233F",
          950: "#0B1628",
        },
        secondary: {
          DEFAULT: "#0E7C7B",
          foreground: "#FFFFFF",
          100: "#E4F3F2",
          500: "#0E7C7B",
          700: "#0B5F5E",
        },
        accent: {
          DEFAULT: "#C4A35A",
          foreground: "#1C2430",
          100: "#F5EEDC",
          500: "#C4A35A",
          700: "#8A6A2F",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          border: "hsl(var(--sidebar-border))",
        },
        brand: {
          50: "#F3F6FA",
          100: "#E8EEF6",
          500: "#3A5F96",
          600: "#2A4A7A",
          700: "#1F3864",
          800: "#1A2F52",
          900: "#12233F",
          950: "#0B1628",
        },
        brass: {
          100: "#F5EEDC",
          500: "#C4A35A",
          700: "#8A6A2F",
        },
        stonewarm: {
          page: "#F7F6F3",
          muted: "#F1F0EC",
          line: "#D4D1C8",
          subtle: "#E6E4DE",
        },
      },
      boxShadow: {
        soft: "0 4px 12px rgba(18, 35, 63, 0.08), 0 16px 40px rgba(18, 35, 63, 0.08)",
        card: "0 1px 2px rgba(18, 35, 63, 0.04), 0 6px 20px rgba(18, 35, 63, 0.05)",
        elevated: "0 12px 40px rgba(11, 22, 40, 0.18)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "dialog-overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "dialog-overlay-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "dialog-content-in": {
          from: {
            opacity: "0",
            transform: "translate(-50%, calc(-50% + 18px)) scale(0.94)",
          },
          to: {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1)",
          },
        },
        "dialog-content-out": {
          from: {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1)",
          },
          to: {
            opacity: "0",
            transform: "translate(-50%, calc(-50% + 10px)) scale(0.96)",
          },
        },
        "sheet-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "sheet-out-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "sheet-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "sheet-out-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        "sheet-in-top": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "sheet-out-top": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-100%)" },
        },
        "sheet-in-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "sheet-out-bottom": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        shimmer: "shimmer 2s infinite",
        "dialog-overlay-in":
          "dialog-overlay-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "dialog-overlay-out":
          "dialog-overlay-out 0.28s cubic-bezier(0.4, 0, 1, 1)",
        "dialog-content-in":
          "dialog-content-in 0.48s cubic-bezier(0.16, 1, 0.3, 1)",
        "dialog-content-out":
          "dialog-content-out 0.26s cubic-bezier(0.4, 0, 1, 1)",
        "sheet-in-right":
          "sheet-in-right 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        "sheet-out-right":
          "sheet-out-right 0.3s cubic-bezier(0.4, 0, 1, 1)",
        "sheet-in-left":
          "sheet-in-left 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        "sheet-out-left":
          "sheet-out-left 0.3s cubic-bezier(0.4, 0, 1, 1)",
        "sheet-in-top": "sheet-in-top 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "sheet-out-top": "sheet-out-top 0.28s cubic-bezier(0.4, 0, 1, 1)",
        "sheet-in-bottom":
          "sheet-in-bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "sheet-out-bottom":
          "sheet-out-bottom 0.28s cubic-bezier(0.4, 0, 1, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
