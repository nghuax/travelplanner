import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          50:  '#f7f5f0',
          100: '#ede9df',
          200: '#ddd7c6',
          300: '#c5bca3',
          400: '#a39a7c',
          500: '#7d7858',
          600: '#59684B',
          700: '#4a5940',
          800: '#3d4935',
          900: '#2f3829',
          950: '#232b1f',
        },
        cream: {
          50:  '#FDFCF9',
          100: '#F8F5EE',
          200: '#F2EDE4',
          300: '#E8E1D3',
          400: '#D4CBB8',
          500: '#B5AD94',
          600: '#968E76',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
