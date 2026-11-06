const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), surface: c("surface"), raised: c("raised"), line: c("line"), ink: c("ink"), muted: c("muted"),
        brand: c("brand"), memory: c("memory"), good: c("good"), bad: c("bad"), warn: c("warn"),
      },
      fontFamily: { sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
      boxShadow: { card: "0 1px 0 rgb(var(--line) / .6), 0 8px 24px -16px rgb(0 0 0 / .35)" },
    },
  },
  plugins: [],
};
