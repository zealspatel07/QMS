/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      scrollBehavior: {
        auto: 'auto',
      },
      colors: {
        brand: {
          50: '#f7f8fa',
          100: '#eef2f6',
          200: '#dfeaf2',
          300: '#bcd3e6',
          400: '#8bb6d6',
          500: '#15486d', // deep navy style brand primary
          600: '#123a58',
          700: '#0f2f45',
          800: '#0b2536',
          900: '#071823',
        },
        accent: {
          50: '#fff2f2',
          100: '#ffe6e6',
          200: '#ffb8b8',
          300: '#ff8a8a',
          400: '#ff5c5c',
          500: '#ff3b3b', // coral-ish (will map to red tokens)
        },
        coral: {
          DEFAULT: '#f3645a', // taken from screenshot coral
          light: '#ffcfc9',
          dark: '#c94b42',
        },
        gray: {
          50: '#fbfbfc',
          100: '#f5f7f9',
          200: '#e9edf2',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      }
    },
  },
  plugins: [],
}
