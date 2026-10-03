// Joins a board slug and table id into one <select> option value; the slug alphabet
// never contains this character, so it can't appear by accident.
export const TABLE_SEPARATOR = '::'

// Where results land: a table id names it outright; a bare slug lets the server pick
// (correct when the board has only one table).
function statsTarget(statsBoard) {
  if (!statsBoard) return {}
  if (statsBoard.includes(TABLE_SEPARATOR)) {
    return { stats_table: Number(statsBoard.split(TABLE_SEPARATOR)[1]) }
  }
  return { stats_board: statsBoard }
}

// Who is entering, in the server's shape for the chosen mode.
function entrants({ mode, teams, names }) {
  // Captains mode sends plain labels; team_draft settings (below) tell the server
  // to open a lobby instead of building a bracket.
  if (mode !== 'teams') return { entrant_labels: names }

  // Unnamed teams fall back to their position number.
  return {
    entrant_teams: teams.map((team, index) => ({
      label: team.label.trim() || `Team ${index + 1}`,
      members: team.members,
    })),
  }
}

// Create-tournament request body for the new-tournament form. Used by useNewTournamentForm.js.
export function buildTournamentPayload(form) {
  const { title, game, format, mode, bestOf, thirdPlace, bracketReset, statsBoard, captains } = form

  return {
    title: title.trim(),
    ...(game?.trim() ? { game_name: game.trim() } : {}),
    format,
    ...entrants(form),
    third_place_match: thirdPlace,
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
