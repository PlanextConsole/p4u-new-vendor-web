import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./components/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        vendor: {
          teal: '#20a090',
          'teal-dark': '#188a7c',
          'teal-soft': '#4dc4b0',
          'teal-muted': '#e8f7f4',
          muted: '#f4f6f8',
        },
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
