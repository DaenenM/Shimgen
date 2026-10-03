// Every API call in one place, grouped by resource. Components call these
// rather than `api` directly, so a URL or payload change touches one file.

import { api } from './client'

export const auth = {
  config: () => api.get('/auth/config/').then((r) => r.data),
  token: (email, password) => api.post('/auth/token/', { email, password }).then((r) => r.data),
  google: (credential) => api.post('/auth/google/', { credential }).then((r) => r.data),
  logout: () => api.post('/auth/logout/').then((r) => r.data),
  register: (payload) => api.post('/auth/register/', payload).then((r) => r.data),
  me: () => api.get('/auth/me/').then((r) => r.data),
  updateMe: (payload) => api.patch('/auth/me/', payload).then((r) => r.data),
  searchUsers: (q) => api.get('/auth/users/', { params: { q } }).then((r) => r.data),
}

export const friends = {
  list: () => api.get('/auth/friends/accepted/').then((r) => r.data),
  pending: () => api.get('/auth/friends/pending/').then((r) => r.data),
  sent: () => api.get('/auth/friends/sent/').then((r) => r.data),
  request: (identifier) => api.post('/auth/friends/', { identifier }).then((r) => r.data),
  accept: (id) => api.post(`/auth/friends/${id}/accept/`).then((r) => r.data),
  remove: (id) => api.delete(`/auth/friends/${id}/`).then((r) => r.data),
}

export const roster = {
  list: (params) => api.get('/players/', { params }).then((r) => r.data),
  remove: (id) => api.delete(`/players/${id}/`).then((r) => r.data),
  bulk: (names, group) => api.post('/players/bulk/', { names, group }).then((r) => r.data),
  archive: (id) => api.post(`/players/${id}/archive/`).then((r) => r.data),
  restore: (id) => api.post(`/players/${id}/restore/`).then((r) => r.data),
  mergeLocal: (names) => api.post('/players/merge_local/', { names }).then((r) => r.data),
}

export const savedTeams = {
  list: () => api.get('/saved-teams/').then((r) => r.data),
  create: (payload) => api.post('/saved-teams/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/saved-teams/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/saved-teams/${id}/`).then((r) => r.data),
}

export const games = {
  list: () => api.get('/games/').then((r) => r.data),
}

export const tournaments = {
  list: (params) => api.get('/tournaments/', { params }).then((r) => r.data),
  get: (id) => api.get(`/tournaments/${id}/`).then((r) => r.data),
  create: (payload) => api.post('/tournaments/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/tournaments/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/tournaments/${id}/`).then((r) => r.data),

  start: (id) => api.post(`/tournaments/${id}/start/`).then((r) => r.data),
  standings: (id) => api.get(`/tournaments/${id}/standings/`).then((r) => r.data),
  nextRound: (id) => api.post(`/tournaments/${id}/next-round/`).then((r) => r.data),
  // A run of results in one request. Returns the whole bracket.
  batchReport: (id, operations) =>
    api.post(`/tournaments/${id}/batch-report/`, { operations }).then((r) => r.data),
  // Points a tournament at a stats board, or a specific table on one; empty
  // slug unlinks. Returns the whole tournament.
  linkStatsBoard: (id, slug, tableId) =>
    api
      .post(`/tournaments/${id}/stats-board/`, {
        stats_board: slug ?? '',
        ...(tableId ? { stats_table: tableId } : {}),
      })
      .then((r) => r.data),
  // Fresh draft with the same entrants, as the next tournament in the series.
  // `reshuffle` repairs round one; default keeps original seeding.
  restage: (id, { reshuffle = false } = {}) =>
    api.post(`/tournaments/${id}/restage/`, { reshuffle }).then((r) => r.data),
  addCohost: (id, userId) =>
    api.post(`/tournaments/${id}/cohosts/`, { user: userId }).then((r) => r.data),
  removeCohost: (id, userId) =>
    api.delete(`/tournaments/${id}/cohosts/${userId}/`).then((r) => r.data),
  favourite: (id) => api.post(`/tournaments/${id}/favourite/`).then((r) => r.data),
  archive: (id) => api.post(`/tournaments/${id}/archive/`).then((r) => r.data),
  restore: (id) => api.post(`/tournaments/${id}/restore/`).then((r) => r.data),

  // ── Captain drafts ─────────────────────────────────────────────────────
  // A draft sits between "created" and "has a bracket". Each call below
  // returns the draft state so the caller can cache it directly.
  draft: (id) => api.get(`/tournaments/${id}/draft/`).then((r) => r.data),
  draftPick: (id, label) =>
    api.post(`/tournaments/${id}/draft/pick/`, { label }).then((r) => r.data),
  draftUndo: (id) => api.post(`/tournaments/${id}/draft/undo/`).then((r) => r.data),
  // Creates the entrants, builds the bracket, and returns the finished tournament.
  draftComplete: (id) => api.post(`/tournaments/${id}/draft/complete/`).then((r) => r.data),
}

export const spectate = {
  get: (publicSlug) => api.get(`/spectate/${publicSlug}/`).then((r) => r.data),
  standings: (publicSlug) => api.get(`/spectate/${publicSlug}/standings/`).then((r) => r.data),
}

export const boards = {
  list: () => api.get('/boards/').then((r) => r.data),
  get: (slug) => api.get(`/boards/${slug}/`).then((r) => r.data),
  create: (payload) => api.post('/boards/', payload).then((r) => r.data),
  update: (slug, payload) => api.patch(`/boards/${slug}/`, payload).then((r) => r.data),
  remove: (slug) => api.delete(`/boards/${slug}/`).then((r) => r.data),

  // A signed delta, not a total, so concurrent tallies add rather than race.
  award: (slug, row, column, delta = 1) =>
    api.post(`/boards/${slug}/award/`, { row, column, delta }).then((r) => r.data),

  favourite: (slug) => api.post(`/boards/${slug}/favourite/`).then((r) => r.data),

  addTable: (slug, payload) => api.post(`/boards/${slug}/tables/`, payload).then((r) => r.data),
  addPerson: (slug, user) => api.post(`/boards/${slug}/people/`, { user }).then((r) => r.data),
  removePerson: (slug, userId) =>
    api.delete(`/boards/${slug}/people/${userId}/`).then((r) => r.data),

  updateTable: (id, payload) => api.patch(`/stats-tables/${id}/`, payload).then((r) => r.data),
  removeTable: (id) => api.delete(`/stats-tables/${id}/`).then((r) => r.data),

  addColumn: (tableId, payload) =>
    api.post(`/stats-tables/${tableId}/columns/`, payload).then((r) => r.data),
  addRows: (tableId, payload) =>
    api.post(`/stats-tables/${tableId}/rows/`, payload).then((r) => r.data),
  updateColumn: (id, payload) => api.patch(`/stats-columns/${id}/`, payload).then((r) => r.data),
  removeColumn: (id) => api.delete(`/stats-columns/${id}/`).then((r) => r.data),
  updateRow: (id, payload) => api.patch(`/stats-rows/${id}/`, payload).then((r) => r.data),
  removeRow: (id) => api.delete(`/stats-rows/${id}/`).then((r) => r.data),
}
