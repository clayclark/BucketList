// Runs inside the ESPN draft room page. ESPN pushes picks over a WebSocket to fantasydraft.espn.com
// ("SELECTED <teamId> <playerId> ..."), plus an INIT snapshot of the whole board on (re)join. Forward only pick and clock lines to draft-relay.js; nothing else is read.
;(() => {
  const KEEP = /^(INIT|SELECTED|SELECTING|CLOCK|STATE|PONG) /
  const NativeWS = window.WebSocket
  window.WebSocket = class extends NativeWS {
    constructor(url, protocols) {
      super(url, protocols)
      const leagueId = String(url).match(/fantasydraft\.espn\.com\/.*league-(\d+)/)?.[1]
      if (!leagueId) return
      this.addEventListener('message', (e) => {
        if (typeof e.data === 'string' && KEEP.test(e.data)) window.postMessage({ __bucketList: true, leagueId, line: e.data.trim() }, '*')
      })
    }
  }
})()
