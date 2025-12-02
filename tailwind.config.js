export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          default: "var(--vibrant-yellow)",
          dark: "var(--dark-yellow)",
          mid: "var(--mid-yellow)",
          vibrate: "var(--vibrate-yellow)",
          light: "var(--light-yellow)",
          lighter: "var(--lighter-yellow)",
          lightest: "var(--lightest-yellow)"
        },
        secondary: {
          default: "var(--vibrant-blue)",
          dark: "var(--dark-blue)",
          mid: "var(--mid-blue)",
          vibrate: "var(--vibrate-blue)",
          light: "var(--light-blue)",
          lighter: "var(--lighter-blue)",
          lightest: "var(--lightest-blue)"
        },
        customGray: "var(--disabled-text-color)",
        success: {
          800: "var(--grn800)",
          700: "var(--grn700)",
          600: "var(--grn600)",
          200: "var(--grn200)",
          150: "var(--grn150)",
          100: "var(--grn100)"
        },
        error: {
          default: "var(--red800)",
          800: "var(--red800)",
          700: "var(--red700)",
          600: "var(--red600)",
          200: "var(--red200)",
          150: "var(--red150)",
          100: "var(--red100)"
        },
        /* Theme-aware button backgrounds */
        btn: {
          "secondary-light": "var(--btn-secondary-light-bg)",
          "error-light": "var(--btn-error-light-bg)",
          "primary-light": "var(--btn-primary-light-bg)"
        },
        /* Theme-aware validation/status colors */
        validation: {
          "error-bg": "var(--validation-error-bg)",
          "error-text": "var(--validation-error-text)",
          "success-bg": "var(--validation-success-bg)",
          "success-text": "var(--validation-success-text)",
          "warning-bg": "var(--validation-warning-bg)",
          "warning-text": "var(--validation-warning-text)"
        },
        /* Theme-aware surface colors - auto-adjust for light/dark */
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          4: "var(--surface-4)",
          5: "var(--surface-5)",
          hover: "var(--hover-bg)",
          active: "var(--active-bg)"
        },
        border: {
          DEFAULT: "var(--border-color)",
          strong: "var(--border-color-strong)"
        },
        text: {
          default: "var(--primary-text-color)",
          primary: "var(--primary-text-color)",
          secondary: "var(--secondary-text-color)",
          disabled: "var(--disabled-text-color)"
        }
      },
      borderColor: {
        DEFAULT: "var(--border-color)",
        strong: "var(--border-color-strong)",
        /* Override gray borders to use theme-aware colors */
        gray: {
          200: "var(--border-color)",
          300: "var(--border-color)",
          400: "var(--border-color-strong)",
          500: "var(--border-color-strong)",
          600: "var(--border-color-strong)",
          700: "var(--border-color-strong)"
        }
      },
      borderRadius: {
        default: "var(--border-radius)"
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'scan': 'scan 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scan: {
          '0%, 100%': { transform: 'translateY(-100%)' },
          '50%': { transform: 'translateY(calc(100% * 50))' },
        },
      },
    },
  },
  plugins: [],
}