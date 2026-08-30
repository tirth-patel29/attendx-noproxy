/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring))",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        canvas: "oklch(var(--canvas))",
        primary: {
          DEFAULT: "oklch(var(--primary))",
          foreground: "oklch(var(--primary-foreground))",
          soft: "oklch(var(--primary-soft))",
          deep: "oklch(var(--primary-deep))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary))",
          foreground: "oklch(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive))",
          foreground: "oklch(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "oklch(var(--success))",
          foreground: "oklch(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "oklch(var(--warning))",
          foreground: "oklch(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted))",
          foreground: "oklch(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "oklch(var(--accent))",
          foreground: "oklch(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar))",
          foreground: "oklch(var(--sidebar-foreground))",
          primary: "oklch(var(--sidebar-primary))",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground))",
          accent: "oklch(var(--sidebar-accent))",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground))",
          border: "oklch(var(--sidebar-border))",
          ring: "oklch(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 6px)",
        "2xl": "calc(var(--radius) + 12px)",
        "3xl": "calc(var(--radius) + 20px)",
      },
      boxShadow: {
        soft: "0 1px 2px oklch(0.6 0.05 235 / 0.05), 0 8px 24px -12px oklch(0.5 0.06 235 / 0.12)",
        lift: "0 1px 2px oklch(0.6 0.05 235 / 0.06), 0 18px 40px -18px oklch(0.5 0.07 235 / 0.22)",
        glow: "0 0 0 1px oklch(0.78 0.13 208 / 0.28), 0 12px 40px -12px oklch(0.72 0.15 205 / 0.4)",
        "inset-hair": "inset 0 1px 0 oklch(1 0 0 / 0.7)",
      },
      backgroundImage: {
        "gradient-cyan": "linear-gradient(135deg, oklch(0.78 0.13 200), oklch(0.6 0.13 235))",
        "gradient-canvas": "radial-gradient(1200px 600px at 12% -10%, oklch(0.86 0.08 202 / 0.35), transparent 60%), radial-gradient(900px 500px at 92% 0%, oklch(0.85 0.06 262 / 0.28), transparent 62%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
