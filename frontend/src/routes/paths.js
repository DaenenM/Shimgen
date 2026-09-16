/**
 * Every route path in one place.
 *
 * Links are built from these helpers rather than written as string literals, so
 * renaming a route is one edit and a typo is a missing export rather than a
 * silent 404.
 */

/**
 * The readable tail of a shareable link.
 *
 * Links carry the thing's name after its id — /tournaments/84/friday-night —
 * so a URL pasted into a group chat says what it points at. The id or slug in
 * front is what actually resolves it, so this part is free to be missing,
 * stale, or renamed without breaking the link.
 */
function nameSegment(name) {
  const slug = String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    // Strip accents, then anything that is not a word character or a space.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
    // A name that was entirely punctuation leaves a trailing dash behind.
    .replace(/-+$/, '')

  return slug ? `/${slug}` : ''
}

export const paths = {
  home: '/',

  // The no-account quick start (plan §4, NEW 6): build a bracket in ten seconds,
  // get prompted to save it afterwards.
  quickStart: '/new',

  login: '/login',
  register: '/register',

  dashboard: '/dashboard',

  tournaments: '/tournaments',
  tournament: (id, name) => `/tournaments/${id}${nameSegment(name)}`,

  // The captain-draft lobby. A separate route rather than a mode of the
  // bracket page: a drafting tournament has no bracket to show yet, and the
  // link is the thing a host sends round the room.
  draft: (id, name) => `/tournaments/${id}/draft${nameSegment(name)}`,

  // Read-only public view. No account required — this is the acquisition
  // channel (plan §4, NEW 2), so it must stay reachable while signed out.
  spectate: (publicSlug, name) => `/t/${publicSlug}${nameSegment(name)}`,

  teamGenerator: '/teams',
  stats: '/stats',
  board: (slug, name) => `/stats/${slug}${nameSegment(name)}`,
  roster: '/roster',
  // Deliberately not under `/teams`, which belongs to the team generator.
  // NavLink marks a link active when the path merely *starts with* its `to`, so
  // `/teams/saved` lit the Team Generator tab on a page that has nothing to do
  // with it. Marking that link `end` would have fixed the symptom while
  // breaking prefix matching for any real sub-route it gains later — and a
  // saved team is a sibling of the roster, not a mode of the generator.
  savedTeams: '/saved-teams',
  friends: '/friends',
  profile: '/profile',
}
