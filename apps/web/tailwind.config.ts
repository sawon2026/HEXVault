import type { Config } from "tailwindcss";
const config: Config = {
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
        },
      },
      boxShadow: { glow: "0 0 40px rgba(34, 211, 238, 0.12)" },
    },
  },
  plugins: [],
};
export default config;
