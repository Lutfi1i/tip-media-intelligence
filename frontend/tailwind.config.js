/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          500: "#27272A",
          600: "#18181B",
          700: "#09090B",
          900: "#000000",
        },
        zinc: {
          950: "#09090B",
        },
      },
    },
  },
  plugins: [],
};
