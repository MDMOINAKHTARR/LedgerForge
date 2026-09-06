/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAF8',
        ink: {
          DEFAULT: '#18181B',
          secondary: '#52525B',
          muted: '#71717A',
          faint: '#A1A1AA'
        },
        pastel: {
          yellow: '#FEF9C3',
          'yellow-light': '#FFFBEB',
          'yellow-border': '#FEF08A',
          'yellow-text': '#854D0E',
          mint: '#DCFCE7',
          'mint-light': '#F0FDF4',
          'mint-border': '#BBF7D0',
          'mint-text': '#166534',
          pink: '#FFE4E6',
          'pink-light': '#FFF1F2',
          'pink-border': '#FECDD3',
          'pink-text': '#9F1239',
          blue: '#E0F2FE',
          'blue-light': '#F0F9FF',
          'blue-border': '#BAE6FD',
          'blue-text': '#075985',
          lavender: '#F3E8FF',
          'lavender-light': '#FAF5FF',
          'lavender-border': '#E9D5FF',
          'lavender-text': '#6B21A8'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', '"Times New Roman"', 'serif'],
        script: ['Caveat', 'cursive'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03)',
        'float': '0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
}
