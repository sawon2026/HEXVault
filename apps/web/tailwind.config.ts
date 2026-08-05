import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hex: {
          bg: "#0B1220",
          card: "#111827",
          border: "#1F2937",
          accent: "#22D3EE",
          muted: "#94A3B8",
          text: "#F8FAFC",
          "bg-light": "#F6F8FB",
          "card-light": "#FFFFFF",
          "border-light": "#E2E8F0",
          "muted-light": "#64748B",
          "text-light": "#0F172A",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(34, 211, 238, 0.12)",
        "glow-light": "0 8px 30px rgba(15, 23, 42, 0.08)",
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        shimmer: "shimmer 1.4s linear infinite",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
