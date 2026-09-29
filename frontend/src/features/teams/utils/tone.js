// Colour for a team by its index, shared by the team generator and the
// bracket page so "Team 3" is always the same colour. 6 hues, then repeats.

const TEAM_HUES = [250, 150, 80, 25, 300, 195]

export function teamTone(index) {
  const hue = TEAM_HUES[index % TEAM_HUES.length]

  return {
    edge: `light-dark(oklch(48% 0.16 ${hue}), oklch(70% 0.13 ${hue}))`,
    wash: `light-dark(oklch(48% 0.16 ${hue} / 0.2), oklch(70% 0.13 ${hue} / 0.28))`,
  }
}
