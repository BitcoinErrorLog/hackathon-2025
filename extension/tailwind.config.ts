import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './popup.html',
    './sidepanel.html',
    './src/**/*.{ts,tsx,html}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        franky: {
          ink: '#0B1021',
          night: '#161B33',
          sky: '#00E0FF',
          blush: '#FF3A7C',
          lime: '#C1FF72',
          sand: '#F9F5EB',
        },
      },
      boxShadow: {
        glow: '0 0 16px rgba(0, 224, 255, 0.45)',
        card: '0 16px 32px rgba(11, 16, 33, 0.25)',
      },
      borderRadius: {
        franky: '18px',
      },
    },
  },
  plugins: [],
};

export default config;
