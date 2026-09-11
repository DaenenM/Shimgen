/**
 * The colour a team is drawn in, by its position in the list.
 *
 * Shared between the generator that produces the teams and the bracket page
 * that shows them again later, so "Team 3" is the same colour in both places —
 * which is the whole point of colouring them. Duplicating the scale would let
 * the two drift the first time either is tweaked.
 *
 * Six hues, spaced far enough apart to be told apart at a glance. Past six the
 * list wraps: seven teams is already more than anyone tracks by colour, and
 * inventing near-identical hues to avoid a repeat helps nobody.
 */
const TEAM_HUES = [250, 150, 80, 25, 300, 195]

export function teamTone(index) {
  const hue = TEAM_HUES[index % TEAM_HUES.length]

  return {
    edge: `light-dark(oklch(48% 0.16 ${hue}), oklch(70% 0.13 ${hue}))`,
    // Strong enough to read as coloured light falling through the panel. At
    // 0.14 it was there in the CSS and invisible on screen.
    wash: `light-dark(oklch(48% 0.16 ${hue} / 0.2), oklch(70% 0.13 ${hue} / 0.28))`,
  }
}
