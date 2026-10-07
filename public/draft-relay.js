// Saves the live draft (picks in order, who's on the clock) to extension storage for the side panel.
;(() => {
  let state = null
  let writing = Promise.resolve()
  const save = () => (writing = writing.then(() => chrome.storage.local.set({ liveDraft: state })))

  window.addEventListener('message', async (e) => {
    const msg = e.data
    if (e.source !== window || !msg?.__hoopsDraft) return
    if (!state) state = (await chrome.storage.local.get('liveDraft')).liveDraft ?? null
    if (!state || state.leagueId !== msg.leagueId) state = { leagueId: msg.leagueId, picks: [], clock: null, done: false, seen: 0 }

    const [kind, a, b] = msg.line.split(' ')
    const now = Date.now()
    if (kind === 'SELECTED') {
      const pick = { teamId: Number(a), playerId: Number(b) }
      if (!state.picks.some((p) => p.playerId === pick.playerId)) state.picks = [...state.picks, pick]
      state.clock = null
    }
    if (kind === 'SELECTING' || kind === 'CLOCK') state.clock = { teamId: Number(a), endsAt: now + Number(b) }
    if (kind === 'STATE') state.done = a === '2'
    state.seen = now
    save()
  })
})()
