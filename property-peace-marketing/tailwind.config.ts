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
        brand: {
          forest: 'var(--brand-forest)',
          teal: 'var(--brand-teal)',
          mint: 'var(--brand-mint)',
          ivory: 'var(--brand-ivory)',
          slate: 'var(--brand-slate)',
          surface: 'var(--brand-surface)',
          'forest-raised': 'var(--brand-forest-raised)',
          'forest-hover': 'var(--brand-forest-hover)',
          'teal-hover': 'var(--brand-teal-hover)',
        },
        primary: {
          deep: 'var(--brand-forest)',
          main: 'var(--brand-forest)',
          light: 'var(--brand-ivory)',
          hover: 'var(--brand-teal)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
