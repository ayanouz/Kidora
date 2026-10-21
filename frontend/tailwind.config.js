/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6C5CE7",
          dark: "#5546C8",
          light: "#8B7FF0",
          soft: "#EEEBFF",
        },
        secondary: {
          DEFAULT: "#00B8A9",
          dark: "#009E91",
          soft: "#E0F7F5",
        },
        accent: {
          DEFAULT: "#FFB020",
          soft: "#FFF3DC",
        },
        success: { DEFAULT: "#22B573", soft: "#E3F7EC" },
        danger: { DEFAULT: "#FF5A5F", soft: "#FFE9EA" },
        warning: { DEFAULT: "#FF8A3D", soft: "#FFEFE3" },
        ink: { DEFAULT: "#2D2A45", soft: "#6B6880", faint: "#9C99AD" },
        surface: "#FFFFFF",
        page: "#F7F6FF",
      },
      fontFamily: {
        fun: ["Fredoka", "ui-rounded", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        card: "1.25rem",
        btn: "1rem",
        blob: "2rem",
      },
      boxShadow: {
        soft: "0 6px 24px rgba(108, 92, 231, 0.12)",
        pop: "0 10px 32px rgba(108, 92, 231, 0.20)",
        inset: "inset 0 -3px 0 rgba(0,0,0,0.12)",
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.06)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        "fade-up": {
          "0%": { transform: "translateY(14px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "fade-up": "fade-up 0.35s ease-out both",
        float: "float 3.5s ease-in-out infinite",
        shake: "shake 0.4s ease-in-out",
        wiggle: "wiggle 1.2s ease-in-out infinite",
        "bounce-soft": "bounce-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
