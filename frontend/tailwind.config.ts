import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wash: "#F1EDFB",
        washAlt: "#EDE9FB",
        primary: "#8B7CF6",
        primarySoft: "#A78BFA",
        lav: "#DCD3FA",
        mint: "#D6E8DE",
        blue: "#4F8EF7",
        ink: "#14142B",
        ink2: "#1B1B2F",
        muted: "#6B7280",
      },
      borderRadius: {
        card: "22px",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 24px rgba(20,20,43,0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
