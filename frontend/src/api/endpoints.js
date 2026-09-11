/**
 * Every API call in one place.
 *
 * Components import these rather than calling `api` directly, so a change to a
 * URL or payload shape touches one file and nothing renders a request inline.
 */

import { api } from './client'

export const auth = {
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
  create: (payload) => api.post('/players/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/players/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/players/${id}/`).then((r) => r.data),
  bulk: (names, group) => api.post('/players/bulk/', { names, group }).then((r) => r.data),
  archive: (id) => api.post(`/players/${id}/archive/`).then((r) => r.data),
  restore: (id) => api.post(`/players/${id}/restore/`).then((r) => r.data),
  // Called when a roster entry is used in an event, so the picker can order
  // by "most recently played" next time.
  touch: (id) => api.post(`/players/${id}/touch/`).then((r) => r.data),
  mergeLocal: (names) => api.post('/players/merge_local/', { names }).then((r) => r.data),
}

export const games = {
  list: () => api.get('/games/').then((r) => r.data),
  modes: (game) => api.get('/modes/', { params: { game } }).then((r) => r.data),
}

export const tournaments = {
  list: (params) => api.get('/tournaments/', { params }).then((r) => r.data),
  get: (id) => api.get(`/tournaments/${id}/`).then((r) => r.data),
  create: (payload) => api.post('/tournaments/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/tournaments/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/tournaments/${id}/`).then((r) => r.data),

  generate: (id, payload) => api.post(`/tournaments/${id}/generate/`, payload).then((r) => r.data),
  start: (id) => api.post(`/tournaments/${id}/start/`).then((r) => r.data),
  standings: (id) => api.get(`/tournaments/${id}/standings/`).then((r) => r.data),
  addEntrant: (id, payload) =>
    api.post(`/tournaments/${id}/entrants/`, payload).then((r) => r.data),
  substitute: (id, entrantId, payload) =>
    api.post(`/tournaments/${id}/entrants/${entrantId}/substitute/`, payload).then((r) => r.data),
  nextRound: (id) => api.post(`/tournaments/${id}/next-round/`).then((r) => r.data),
  // A run of results in one request. Returns the whole bracket, so the flush
  // doubles as the reconcile — no separate refetch needed after it.
  batchReport: (id, operations) =>
    api.post(`/tournaments/${id}/batch-report/`, { operations }).then((r) => r.data),
  // Point a tournament at a stats board after the fact, or move it to another.
  // An empty slug unlinks. A table id names one table on a board directly,
  // which is what a board with several tables needs — the server cannot know
  // which of "Solo wins" and "Team wins" tonight belongs to. Returns the whole
  // tournament, like the other mutations here, so the caller can write it
  // straight into the cache.
  linkStatsBoard: (id, slug, tableId) =>
    api
      .post(`/tournaments/${id}/stats-board/`, {
        stats_board: slug ?? '',
        ...(tableId ? { stats_table: tableId } : {}),
      })
      .then((r) => r.data),
  // Run it back: a fresh draft with the same entrants, feeding the same table,
  // named as the next in the series.
  //
  // `reshuffle` pairs round one afresh. The default mirrors the server's, which
  // keeps the original seeding — the tournaments list always asks for `true`,
  // since running a night back means playing it again rather than replaying the
  // same fixtures, but the flag stays because the endpoint still honours both.
  restage: (id, { reshuffle = false } = {}) =>
    api.post(`/tournaments/${id}/restage/`, { reshuffle }).then((r) => r.data),
  addCohost: (id, userId) =>
    api.post(`/tournaments/${id}/cohosts/`, { user: userId }).then((r) => r.data),
  removeCohost: (id, userId) =>
    api.delete(`/tournaments/${id}/cohosts/${userId}/`).then((r) => r.data),
  favourite: (id) => api.post(`/tournaments/${id}/favourite/`).then((r) => r.data),
  archive: (id) => api.post(`/tournaments/${id}/archive/`).then((r) => r.data),
  restore: (id) => api.post(`/tournaments/${id}/restore/`).then((r) => r.data),
  claim: (id, token) => api.post(`/tournaments/${id}/claim/`, { token }).then((r) => r.data),
}

export const matches = {
  report: (id, scoreA, scoreB) =>
    api.post(`/matches/${id}/report/`, { score_a: scoreA, score_b: scoreB }).then((r) => r.data),
  reportFFA: (id, placements) =>
    api.post(`/matches/${id}/report-ffa/`, { placements }).then((r) => r.data),
  clear: (id) => api.post(`/matches/${id}/clear/`).then((r) => r.data),
}

export const spectate = {
  get: (publicSlug) => api.get(`/spectate/${publicSlug}/`).then((r) => r.data),
  standings: (publicSlug) => api.get(`/spectate/${publicSlug}/standings/`).then((r) => r.data),
}

export const teams = {
  generate: (payload) => api.post('/teams/generate/', payload).then((r) => r.data),
}

export const boards = {
  list: () => api.get('/boards/').then((r) => r.data),
  get: (slug) => api.get(`/boards/${slug}/`).then((r) => r.data),
  create: (payload) => api.post('/boards/', payload).then((r) => r.data),
  update: (slug, payload) => api.patch(`/boards/${slug}/`, payload).then((r) => r.data),
  remove: (slug) => api.delete(`/boards/${slug}/`).then((r) => r.data),

  // A signed delta rather than a total: two people tallying at once should add
  // two marks, not race to write the same number.
  award: (slug, row, column, delta = 1) =>
    api.post(`/boards/${slug}/award/`, { row, column, delta }).then((r) => r.data),

  favourite: (slug) => api.post(`/boards/${slug}/favourite/`).then((r) => r.data),

  addTable: (slug, payload) => api.post(`/boards/${slug}/tables/`, payload).then((r) => r.data),
  addPerson: (slug, user) => api.post(`/boards/${slug}/people/`, { user }).then((r) => r.data),
  removePerson: (slug, userId) =>
    api.delete(`/boards/${slug}/people/${userId}/`).then((r) => r.data),

  trackTournaments: (tableId) =>
    api.post(`/stats-tables/${tableId}/track-tournaments/`).then((r) => r.data),

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
