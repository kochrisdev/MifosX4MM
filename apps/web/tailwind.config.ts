import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: 'var(--teal)',
          700: 'var(--teal-700)',
          100: 'var(--teal-100)',
          50: 'var(--teal-50)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        ds: {
          bg: 'var(--bg)',
          border: 'var(--border)',
          'border-2': 'var(--border-2)',
          'border-strong': 'var(--border-strong)',
          amber: 'var(--amber)',
          'amber-50': 'var(--amber-50)',
          green: 'var(--green)',
          'green-50': 'var(--green-50)',
          red: 'var(--red)',
          'red-50': 'var(--red-50)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
