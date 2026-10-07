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
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
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

      // Neutral surface scale for the light theme, so page chrome can be written
      // consistently instead of mixing slate/white/gray ad hoc.
      colors: {
        surface: {
          app: '#F6F8FB',
          card: '#FFFFFF',
          subtle: '#F1F5F9',
          border: '#E2E8F0',
          'border-strong': '#CBD5E1',
        },
        ink: {
          DEFAULT: '#0F172A',
          muted: '#475569',
          subtle: '#64748B',
          faint: '#94A3B8',
        },
        // Primary action colour, aligned with Tailwind's blue-600.
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
      },

      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
        'card-hover': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        header: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
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
