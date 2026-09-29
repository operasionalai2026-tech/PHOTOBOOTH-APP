import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0a10',
          900: '#13111c',
          800: '#1c1928',
          700: '#2a2638',
          600: '#3b3650',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--accent) / 0.4), 0 10px 40px -10px rgb(var(--accent) / 0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
