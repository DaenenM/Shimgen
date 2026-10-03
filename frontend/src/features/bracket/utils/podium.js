// Podium colours for standings (used by RankBadge.jsx, StandingsTable.jsx): gold reuses --color-accent; silver/bronze invert with the theme via light-dark().
export const PODIUM = {
  1: {
    text: 'var(--color-accent)',
    wash: 'color-mix(in oklch, var(--color-accent) 12%, transparent)',
  },
  2: {
    text: 'light-dark(oklch(52% 0.02 260), oklch(84% 0.02 260))',
    wash: 'light-dark(oklch(52% 0.02 260 / 0.1), oklch(84% 0.02 260 / 0.1))',
  },
  3: {
    text: 'light-dark(oklch(50% 0.09 50), oklch(74% 0.10 50))',
    wash: 'light-dark(oklch(50% 0.09 50 / 0.1), oklch(74% 0.10 50 / 0.12))',
  },
}
