// Decorates ESPN's draft room player list with Bucket List badges: an edge bar (take now, can wait,
// in your buckets, or not for your punts), "B7 · 50% · +0.43" after the position pills, and a hover
// card with the 9-category heat strip. Data comes from the side panel (useBadgeSync.ts) via storage;
// rows are matched by the ESPN player id in each headshot URL. Read-only: nothing on ESPN's page is clicked.
;(() => {
  if (!/\/basketball\/draft/.test(location.pathname)) return

  const STALE_MS = 90_000 // the panel saves every 30s while open
  const CATS = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
  const EDGE = { take: '#f43f5e', wait: '#10b981', tier: '#38bdf8', off: '#d4d4d8' }
  const HEADSHOT = /headshots\/nba\/players\/full\/(\d+)\.png/

  let feed = null

  const style = document.createElement('style')
  style.textContent = `
    /* Keep ESPN's team and position pills on one line; our badge is what shrinks. */
    .player-details .flex.items-center { flex-wrap: nowrap; min-width: 0; }
    .player-details .playerinfo__playerpos { flex-shrink: 0; display: flex; white-space: nowrap; }
    .bl-inline { flex: 1 1 auto; margin-left: 6px; font-size: 11px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .bl-inline b { color: #1d1d1f; font-weight: 700; }
    .bl-inline .bl-top { color: #b45309; }
    .bl-inline.bl-off { opacity: .45; }
    .bl-low { color: #be123c; } .bl-mid { color: #b45309; } .bl-high { color: #9ca3af; }
    .bl-card { position: fixed; z-index: 2147483647; background: #000; color: #d4d4d8; font: 12px ui-sans-serif, system-ui, -apple-system, sans-serif;
      padding: 8px 10px; border-radius: 4px; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,.25); }
    .bl-card .bl-row { display: flex; gap: 8px; align-items: baseline; white-space: nowrap; }
    .bl-card .bl-heat { display: grid; grid-template-columns: repeat(9, 30px); gap: 1px; margin-top: 6px; text-align: center; }
    .bl-card .bl-heat span { font-size: 10px; } .bl-card .bl-heat i { font-style: normal; display: block; padding: 1px 0; color: #f4f4f5; }
    .bl-take { color: #fb7185; } .bl-wait { color: #34d399; } .bl-amber { color: #fbbf24; } .bl-sky { color: #38bdf8; } .bl-dim { color: #71717a; }
  `
  document.documentElement.appendChild(style)

  const live = () => feed && Date.now() - feed.savedAt < STALE_MS
  const availClass = (p) => (p === null ? 'bl-high' : p < 0.3 ? 'bl-low' : p < 0.7 ? 'bl-mid' : 'bl-high')
  const pct = (p) => (p === null ? '' : `${Math.round(p * 100)}%`)
  const fitText = (f) => (f === null ? '' : `${f > 0 ? '+' : ''}${f.toFixed(2)}`)
  const heatColor = (z) => {
    if (z === null) return 'rgba(113,113,122,.25)'
    const a = Math.min(Math.abs(z) / 2, 1) * 0.9
    return z >= 0 ? `rgba(16,185,129,${a})` : `rgba(244,63,94,${a})`
  }

  // --- rows --------------------------------------------------------------------------------------
  const render = () => {
    for (const img of document.querySelectorAll('.player-column img')) {
      const id = img.src.match(HEADSHOT)?.[1]
      const row = img.closest('.fixedDataTableRowLayout_rowWrapper')
      const line = img.closest('.player-column')?.querySelector('.player-details > .flex.items-center')
      // ESPN's cells paint their own backgrounds, so the edge bar goes on the row's first cell.
      const edgeCell = row?.querySelector('.fixedDataTableCellLayout_main')
      if (!id || !row || !line || !edgeCell) continue
      const badge = live() ? feed.players[id] : undefined
      let inline = line.querySelector('.bl-inline')
      if (!badge) {
        inline?.remove()
        edgeCell.style.boxShadow = ''
        delete row.dataset.blId
        continue
      }
      row.dataset.blId = id
      edgeCell.style.boxShadow = `inset 4px 0 0 ${EDGE[badge.state]}`
      if (!inline) {
        inline = document.createElement('span')
        inline.className = 'bl-inline'
        line.appendChild(inline)
      }
      inline.classList.toggle('bl-off', badge.state === 'off')
      const html = `<b>${badge.bucket}</b>${badge.avail !== null ? ` <span class="${availClass(badge.avail)}">${pct(badge.avail)}</span>` : ''}${badge.fit !== null ? ` <b class="${badge.top ? 'bl-top' : ''}">${fitText(badge.fit)}</b>` : ''}`
      if (inline.innerHTML !== html) inline.innerHTML = html
    }
  }

  // ESPN's list is virtualized and re-renders constantly; batch our pass into the next frame.
  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      render()
    })
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true })

  // --- hover card --------------------------------------------------------------------------------
  const card = document.createElement('div')
  card.className = 'bl-card'
  card.hidden = true
  document.documentElement.appendChild(card)

  document.addEventListener('mouseover', (e) => {
    const row = e.target instanceof Element ? e.target.closest('.fixedDataTableRowLayout_rowWrapper[data-bl-id]') : null
    const badge = row && live() ? feed.players[row.dataset.blId] : undefined
    if (!badge) return void (card.hidden = true)
    const name = row.querySelector('.playerinfo__playername a')?.textContent ?? ''
    const call = { take: '<span class="bl-take">take now</span>', wait: '<span class="bl-wait">can wait</span>', off: '<span class="bl-dim">not for your punts</span>', tier: '' }[badge.state]
    card.innerHTML = `
      <div class="bl-row"><b style="color:#fff">${name}</b> <span>${badge.bucket}</span>${badge.tag ? ` <span class="bl-sky">${badge.tag}</span>` : ''} ${call}</div>
      <div class="bl-row bl-dim">Fit <span class="${badge.top ? 'bl-amber' : ''}" style="color:${badge.top ? '' : '#d4d4d8'}">${fitText(badge.fit) || '-'}</span>
        ${badge.avail !== null && feed.target ? `· ${pct(badge.avail)} left at #${feed.target}` : ''}</div>
      ${badge.z.length ? `<div class="bl-heat">${CATS.map((c, i) => `<span>${c}<i style="background:${heatColor(badge.z[i])}">${badge.z[i] === null ? '–' : badge.z[i].toFixed(1)}</i></span>`).join('')}</div>` : ''}`
    const r = row.getBoundingClientRect()
    card.hidden = false
    const top = Math.min(r.bottom + 4, innerHeight - card.offsetHeight - 8)
    card.style.top = `${top}px`
    card.style.left = `${Math.max(8, r.left + 56)}px`
  })
  document.addEventListener('scroll', () => (card.hidden = true), true)

  // --- data --------------------------------------------------------------------------------------
  chrome.storage.local.get('badges').then(({ badges }) => {
    feed = badges ?? null
    schedule()
  })
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.badges) return
    feed = changes.badges.newValue ?? null
    schedule()
  })
  // Drop badges once the panel stops saving (closed), without waiting for ESPN to re-render.
  setInterval(schedule, 15_000)
})()
