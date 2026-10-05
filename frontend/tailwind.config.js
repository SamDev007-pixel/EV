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
        sans: ['Outfit', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Outfit', 'Plus Jakarta Sans', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        none: '0px',
        sm: '0px',
        DEFAULT: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
      colors: {
        black: '#000000',
        // Electric Neon Cyan from Speedometer Outer Rings, 'D' box, and Turn Arrows
        cyan: {
          50: '#F0FDFF',
          100: '#E0FAFE',
          200: '#BAF3FD',
          300: '#7CE6FA',
          400: '#38BDF8',
          500: '#00D2FF', // exact cockpit gauge ring & turn arrow
          600: '#00A3FF',
          700: '#0077CC',
          800: '#0055AA',
          900: '#003366',
          950: '#001A38',
        },
        // Cyber Violet & Royal Indigo from Gauge Fills and Ambient Lighting
        violet: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#A855F7',
          600: '#9D4EDD', // exact cockpit car platform aura ring
          700: '#7928CA', // exact cockpit horizontal laser & sweep
          800: '#5A3EB5', // exact cockpit gauge meter fill
          900: '#3B1360', // exact cockpit ambient atmospheric haze
          950: '#1E0A38',
        },
        // Automotive Amber Warning Lights (Oil, Battery, Engine, Seatbelt, Tire)
        amber: {
          400: '#FFB800',
          500: '#FF7A00', // exact cockpit warning lights
          600: '#FF5500',
        },
        // Tachometer Redline & Critical Markers
        redline: {
          500: '#FF2A4D', // exact cockpit redline marker
          600: '#DC2626',
        },
        // Electric Blue scale aligned with Cyan/Blue
        blue: {
          50: '#F0FDFF',
          100: '#E0FAFE',
          200: '#BAF3FD',
          300: '#7CE6FA',
          400: '#38BDF8',
          500: '#00D2FF',
          600: '#00A3FF',
          700: '#0077CC',
          800: '#0055AA',
          900: '#003366',
          950: '#001A38',
        },
        cyber: {
          primary: '#00D2FF',
          glow: '#00D2FF',
          bright: '#38BDF8',
          deep: '#0077CC',
          violet: '#7928CA',
          purple: '#5A3EB5',
          haze: '#3B1360',
          amber: '#FF7A00',
          redline: '#FF2A4D',
          dark: '#000000',
          surface: '#030611',
          card: '#060A1C',
          border: '#141C38',
        },
        dark: {
          950: '#000000',
          900: '#020409',
          850: '#050814',
          800: '#070B1E',
          700: '#141C38',
          600: '#1C274E',
          500: '#8E9DB8',
        },
      }
    },
  },
  plugins: [],
}
