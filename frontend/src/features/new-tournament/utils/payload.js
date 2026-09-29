// Joins a board slug to a table id in one option value, since a <select> can
// only carry a string. A slug is generated from an alphabet without this
// character, so it cannot appear in the first half by accident.
export const TABLE_SEPARATOR = '::'

/**
 * Where results land: a table id names that table outright; a bare slug lets
 * the server pick, which is right when the board has only one.
 */
function statsTarget(statsBoard) {
  if (!statsBoard) return {}
  if (statsBoard.includes(TABLE_SEPARATOR)) {
    return { stats_table: Number(statsBoard.split(TABLE_SEPARATOR)[1]) }
  }
  return { stats_board: statsBoard }
}

/** Who is entering, in the shape the server wants for the chosen mode. */
function entrants({ mode, teams, names }) {
  // Captains mode sends the pool as plain labels; the draft settings below tell
  // the server to open a lobby instead of building a bracket from them.
  if (mode !== 'teams') return { entrant_labels: names }

  // Teams carry their members so the bracket can show who is on each side. An
  // unnamed team falls back to its position, so a host can fill in players and
  // leave the naming alone.
  return {
    entrant_teams: teams.map((team, index) => ({
      label: team.label.trim() || `Team ${index + 1}`,
      members: team.members,
    })),
  }
}

/** The create-tournament request body for the new-tournament form. */
export function buildTournamentPayload(form) {
  const { title, format, mode, bestOf, thirdPlace, bracketReset, statsBoard, captains } = form

  return {
    title: title.trim(),
    format,
    ...entrants(form),
    third_place_match: thirdPlace,
    // Everyone on the winning entrant is credited individually — a 3v3 win is
    // three people's win — which the server handles.
    ...statsTarget(statsBoard),
    settings: {
      best_of: { default: bestOf },
      ...(format === 'double' ? { bracket_reset: bracketReset } : {}),
      ...(mode === 'captains'
        ? {
            team_draft: {
              team_count: captains.count,
              captain_mode: captains.mode,
              ...(captains.mode === 'manual' ? { captains: captains.chosen } : {}),
            },
          }
        : {}),
    },
  }
}
