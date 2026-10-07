/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Amazon Ember"', 'AmazonEmber', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"Amazon Ember Mono"', 'AmazonEmberMono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        display: ['"Amazon Ember Display"', '"Amazon Ember"', 'sans-serif'],
      },

      // Standard professional radii. (A previous configuration forced every radius to 0px,
      // which made rounded-* utilities render square and left the interface visually
      // inconsistent: cards were rounded by CSS while their contents were not.)
      borderRadius: {
        none: '0px',
        sm: '0.25rem',    // 4px
        DEFAULT: '0.375rem', // 6px
        md: '0.375rem',   // 6px
        lg: '0.5rem',     // 8px
        xl: '0.75rem',    // 12px
        '2xl': '1rem',    // 16px
        '3xl': '1.5rem',  // 24px
        full: '9999px',
      },

      // Official AWS Console & Website theme colors
      colors: {
        aws: {
          squid: '#232F3E',
          'squid-dark': '#161E2E',
          orange: '#EC7211',
          'orange-hover': '#EB5F07',
          'orange-light': '#FFF3E8',
          blue: '#0972D3',
          'blue-hover': '#033160',
          'blue-light': '#F2F8FD',
          border: '#EAEDED',
          'border-strong': '#D5DBDB',
          bg: '#F2F3F3',
          text: '#16191F',
          muted: '#545B64',
        },
        surface: {
          app: '#F2F3F3',
          card: '#FFFFFF',
          subtle: '#F8F9FA',
          border: '#EAEDED',
          'border-strong': '#D5DBDB',
        },
        ink: {
          DEFAULT: '#16191F',
          muted: '#545B64',
          subtle: '#687078',
          faint: '#879596',
        },
        // AWS primary action blue
        primary: {
          50: '#F2F8FD',
          100: '#E1EFFF',
          200: '#B9E1FB',
          300: '#7EC2F6',
          400: '#38A1F0',
          500: '#0972D3',
          600: '#0972D3',
          700: '#0352A0',
          800: '#033160',
          900: '#011E3D',
        },
      },

      boxShadow: {
        card: '0 1px 1px 0 rgba(0, 28, 36, 0.1), 0 1px 2px 0 rgba(0, 28, 36, 0.05)',
        'card-hover': '0 4px 12px -2px rgba(0, 28, 36, 0.12), 0 2px 4px -2px rgba(0, 28, 36, 0.06)',
        header: '0 1px 2px 0 rgba(0, 28, 36, 0.08)',
      },

      maxWidth: {
        // Wide enough for the data tables (search comparison, evaluation) without
        // forcing horizontal scrolling on a normal desktop.
        content: '1600px',
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }], // 11px
      },
    },
  },
  plugins: [],
}
