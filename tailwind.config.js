import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.tsx', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0D1B2A',
        ink2: '#3B4656',
        muted: '#5B6675',
        line: '#E3E7ED',
        line2: '#D5DAE1',
        ground: '#F2F4F7',
        signal: { DEFAULT: '#FF5B1F', hover: '#FF7A45', soft: '#FFF1EA', dark: '#C2410C', text: '#9A3412' },
        cast: '#6C4CF1',
        crew: '#0B7A6B',
        live: '#17A34A',
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        float: '0 8px 24px rgba(13, 27, 42, 0.18)',
        sheet: '0 -10px 30px rgba(13, 27, 42, 0.16)',
      },
    },
  },
  plugins: [animate],
};
