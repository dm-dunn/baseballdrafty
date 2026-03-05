/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      // Add portrait/landscape variants without replacing the default sm/md/lg breakpoints
      screens: {
        portrait:  { raw: '(orientation: portrait)' },
        landscape: { raw: '(orientation: landscape)' },
      },
    },
  },
  plugins: [],
};
