import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { rally: { base: '#0A0A0B', surface: '#141416', elevated: '#1C1C20', border: '#27272A', primary: '#FAFAFA', secondary: '#A1A1AA', tertiary: '#71717A' } }, borderRadius: { card: '12px', control: '8px' } } },
  plugins: [require('tailwindcss-animate')],
};

export default config;
