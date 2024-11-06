/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'indigo': '#4B0082', // or your preferred shade of indigo
        'royal-blue': '#4169E1', // This is a common hex code for royal blue
      },
    },
  },
  plugins: [],
}

