// Game suggestion matching for GameField. Mirrors normalize() in backend groups/services/games.py.

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Best matches for what's typed: nickname hits first, then name/nickname prefixes, then contains.
// Empty once the text already is a game's exact name, so the chips get out of the way.
export function suggestGames(games, text, limit = 4) {
  const q = normalize(text)
  if (!q) return []

  const ranked = []
  for (const game of games) {
    const name = normalize(game.name)
    if (name === q) return []

    const aliases = (game.aliases ?? []).map(normalize)
    const score = aliases.includes(q)
      ? 0
      : name.startsWith(q)
        ? 1
        : aliases.some((a) => a.startsWith(q))
          ? 2
          : q.length >= 3 && name.includes(q)
            ? 3
            : null
    if (score !== null) ranked.push({ game, score })
  }

  return ranked
    .sort((a, b) => a.score - b.score || a.game.name.localeCompare(b.game.name))
    .slice(0, limit)
    .map(({ game }) => game.name)
}
