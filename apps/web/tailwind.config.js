/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fg: 'var(--color-fg)',
        'fg-muted': 'var(--color-fg-muted)',
        surface: 'var(--color-bg)',
        subtle: 'var(--color-bg-subtle)',
        line: 'var(--color-border)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          fg: 'var(--color-primary-fg)',
        },
        success: { DEFAULT: 'var(--color-success)', bg: 'var(--color-success-bg)' },
        danger: { DEFAULT: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
        warning: { DEFAULT: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: { sm: '12px', md: '14px', lg: '18px' },
      borderRadius: { sm: '4px', md: '6px', lg: '10px' },
      spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px' },
      boxShadow: { card: '0px 1px 3px 0px rgb(11.76% 16.08% 23.14% / 0.08)' },
    },
  },
  plugins: [],
}
