// Saves the draft room's live feed for the side panel: the latest INIT snapshot (whole board, sent on
// every join or reload), pick lines since then, and who's on the clock. The panel does the parsing.
;(() => {
  let state // undefined until loaded from storage
  let queue = Promise.resolve()

  // One message at a time: INIT and a pick can land together on reload, and must not overwrite each other.
  const handle = async ({ leagueId, line }) => {
    if (state === undefined) state = (await chrome.storage.local.get('liveDraft')).liveDraft ?? null
    if (!state || state.leagueId !== leagueId || !Array.isArray(state.lines)) {
      state = { leagueId, init: null, lines: [], clock: null, done: false, seen: 0 }
    }
    const [kind, a, b] = line.split(' ')
    const now = Date.now()
    if (kind === 'INIT') {
      state.init = a
      state.lines = []
    }
    if (kind === 'SELECTED') {
      if (!state.lines.includes(line)) state.lines = [...state.lines, line]
      state.clock = null
    }
    if (kind === 'SELECTING' || kind === 'CLOCK') state.clock = { teamId: Number(a), endsAt: now + Number(b) }
    if (kind === 'STATE') state.done = a === '2'
    state.seen = now
    await chrome.storage.local.set({ liveDraft: state })
  }

  window.addEventListener('message', (e) => {
    if (e.source === window && e.data?.__bucketList) queue = queue.then(() => handle(e.data)).catch(console.error)
  })
})()
