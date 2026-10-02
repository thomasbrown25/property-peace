import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        'nav': '955px', // Custom breakpoint for navbar mobile mode
      },
      // Give marketing sections, grids, navigation, and footer the wider
      // editorial canvas; narrower prose/form max-width utilities stay intact.
      maxWidth: {
        '6xl': '96rem',
        '7xl': '96rem',
      },
      colors: {
        primary: {
          deep: '#061e35',    // Deepest navy
          main: '#1e3a5f',    // Primary navy - Buttons / backgrounds
          light: '#E8F1FF',   // Light blue - Background highlights
          hover: '#061e35',   // Hover state (darker navy)
        },
      },
    },
  },
  plugins: [],
};

export default config;
