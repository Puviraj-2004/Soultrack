const TOKEN_KEY = 'soultrack_admin_token'

const METADATA_PRESETS = {
  genre: ['Melody', 'Mass', 'Lofi', 'Remix', 'Instrumental', 'Acoustic', 'Hip-Hop', 'Devotional', 'Classical', 'Pop'],
  mood: ['Romantic', 'Chill', 'Emotional', 'Energetic', 'Party', 'Focus', 'Feel Good', 'Devotional'],
  language: ['Tamil', 'Hindi', 'Telugu', 'Malayalam', 'English', 'Instrumental'],
}

const QUICK_TAGS = ['90s', '2000s', '2010s', '2020s', 'evergreen', 'duet', 'bgm', 'rain', 'night', 'workout', 'vijay', 'ajith']

const SONGS_PAGE_SIZE = 10

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || '',
  songs: [],
  playlists: [],
  pollTimer: null,
  activeView: 'songs',
  statusFilter: 'ALL',
  songsPage: 1,
  previewSongId: null,
}

const el = id => document.getElementById(id)

function initMetadataControls() {
  document.querySelectorAll('select[data-preset]').forEach(select => {
    const key = select.dataset.preset
    const list = METADATA_PRESETS[key] || []
    select.replaceChildren()
    const autoOpt = document.createElement('option')
    autoOpt.value = ''
    autoOpt.textContent = 'Auto-detect'
    select.append(autoOpt)
    list.forEach(item => {
      const opt = document.createElement('option')
      opt.value = item
      opt.textContent = item
      select.append(opt)
    })
  })

  document.querySelectorAll('.tag-chips[data-tag-target]').forEach(container => {
    const input = el(container.dataset.tagTarget)
    if (!input) return
    container.replaceChildren()
    QUICK_TAGS.forEach(tag => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tag-chip'
      btn.dataset.tag = tag
      btn.textContent = `+ ${tag}`
      btn.addEventListener('click', () => {
        const current = parseTagList(input.value)
        const idx = current.indexOf(tag)
        if (idx >= 0) current.splice(idx, 1)
        else current.push(tag)
        input.value = current.join(', ')
        syncTagChipsForInput(input)
      })
      container.append(btn)
    })
    input.addEventListener('input', () => syncTagChipsForInput(input))
  })
}

function parseTagList(raw) {
  return String(raw || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter((s, i, arr) => s && arr.indexOf(s) === i)
}

function syncTagChipsForInput(input) {
  const container = document.querySelector(`.tag-chips[data-tag-target="${input.id}"]`)
  if (!container) return
  const active = new Set(parseTagList(input.value))
  container.querySelectorAll('.tag-chip').forEach(btn => {
    const on = active.has(btn.dataset.tag)
    btn.classList.toggle('active', on)
    btn.textContent = on ? `✓ ${btn.dataset.tag}` : `+ ${btn.dataset.tag}`
  })
}

function setSelectPresetValue(select, value) {
  if (!select) return
  const clean = String(value || '').trim()
  if (!clean) {
    select.value = ''
    return
  }
  const existing = [...select.options].find(o => o.value.toLowerCase() === clean.toLowerCase())
  if (existing) {
    select.value = existing.value
    return
  }
  const opt = document.createElement('option')
  opt.value = clean
  opt.textContent = clean
  select.append(opt)
  select.value = clean
}

// Polite live region announcer for accessible form validation feedback
const announcer = document.createElement('div')
announcer.setAttribute('aria-live', 'polite')
announcer.classList.add('visually-hidden')
document.body.append(announcer)

function setupFieldValidationSync() {
  const linkError = (input, shown) => {
    const errorId = input.dataset.error
    if (!errorId) return
    const ids = (input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(id => id && id !== errorId)
    if (shown) ids.push(errorId)
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '))
    else input.removeAttribute('aria-describedby')
  }

  const sync = (input, announce = false) => {
    if (!input.matches?.('input, select, textarea')) return
    const supportsUserInvalid = CSS.supports('selector(:user-invalid)')
    const invalid = supportsUserInvalid
      ? input.matches(':user-invalid')
      : input.classList.contains('user-invalid-fallback')

    input.setAttribute('aria-invalid', invalid ? 'true' : 'false')
    linkError(input, invalid)
    if (announce && invalid && input.dataset.error) {
      const msg = el(input.dataset.error)?.textContent?.trim()
      if (msg) announcer.textContent = msg
    }
  }

  document.addEventListener('blur', e => {
    if (!CSS.supports('selector(:user-invalid)') && e.target.checkValidity) {
      const valid = e.target.validity.valid
      e.target.classList.toggle('user-invalid-fallback', !valid)
    }
    sync(e.target, true)
  }, true)

  document.addEventListener('input', e => {
    if (!CSS.supports('selector(:user-invalid)') && e.target.classList?.contains('user-invalid-fallback')) {
      e.target.classList.toggle('user-invalid-fallback', !e.target.validity.valid)
    }
    if (e.target.hasAttribute('aria-invalid')) sync(e.target, false)
  })

  document.addEventListener('invalid', e => {
    if (!CSS.supports('selector(:user-invalid)')) e.target.classList.add('user-invalid-fallback')
    sync(e.target, false)
  }, true)
}

function resetFormSafely(form) {
  form.reset()
  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.classList.remove('user-invalid-fallback')
    if (input.hasAttribute('aria-invalid')) {
      input.setAttribute('aria-invalid', 'false')
    }
    const errorId = input.dataset?.error
    if (errorId) {
      const ids = (input.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(id => id && id !== errorId)
      if (ids.length) input.setAttribute('aria-describedby', ids.join(' '))
      else input.removeAttribute('aria-describedby')
    }
  })
}

// Fallback light-dismiss for browsers lacking dialog[closedby] (e.g. Safari)
function setupDialogLightDismiss() {
  document.querySelectorAll('dialog').forEach(dialog => {
    if (!('closedBy' in HTMLDialogElement.prototype) && dialog.getAttribute('closedby') === 'any') {
      let pressedOutside = false
      const isOutside = (e) => {
        const r = dialog.getBoundingClientRect()
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
      }
      dialog.addEventListener('pointerdown', e => { pressedOutside = isOutside(e) })
      dialog.addEventListener('pointerup', e => { if (pressedOutside && isOutside(e)) dialog.close() })
    }
  })

  document.querySelectorAll('[data-close-dialog]').forEach(btn => {
    btn.addEventListener('click', () => el(btn.dataset.closeDialog)?.close())
  })
}

function awaitDialogResult(dialog) {
  dialog.returnValue = ''
  dialog.showModal()
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true })
  })
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (state.token) headers.Authorization = `Bearer ${state.token}`
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    signOut()
    throw new Error(data.error || 'Session expired. Please sign in again.')
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

function setStatus(node, text, isError = false) {
  node.textContent = text
  node.style.color = isError ? 'var(--danger)' : 'var(--success)'
  node.hidden = !text
}

function formatDuration(secs) {
  if (!secs || Number.isNaN(secs)) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function signOut() {
  state.token = ''
  state.songs = []
  state.playlists = []
  state.previewSongId = null
  sessionStorage.removeItem(TOKEN_KEY)
  clearInterval(state.pollTimer)
  state.pollTimer = null
  document.querySelectorAll('dialog[open]').forEach(d => d.close())
  const errBox = el('login-server-error')
  errBox.textContent = ''
  errBox.hidden = true
  resetFormSafely(el('login-form'))
  el('admin-topbar').hidden = true
  el('dashboard-main').hidden = true
  el('dashboard-view').hidden = true
  el('login-view').hidden = false
  el('admin-secret').focus()
}

async function confirmSignOut() {
  const result = await awaitDialogResult(el('confirm-logout-dialog'))
  if (result === 'confirm') {
    signOut()
  }
}

function populatePlaylistSelects() {
  const selectors = [el('yt-playlist'), el('upload-playlist'), el('edit-song-playlist')]
  selectors.forEach((select, idx) => {
    const prev = select.value
    select.replaceChildren()
    const first = document.createElement('option')
    first.value = ''
    first.textContent = idx === 2 ? 'Keep current playlists' : 'Library only'
    select.append(first)
    state.playlists.forEach(pl => {
      const opt = document.createElement('option')
      opt.value = pl.id
      opt.textContent = pl.name
      select.append(opt)
    })
    if (prev) select.value = prev
  })
}

function setActiveView(view) {
  state.activeView = view === 'playlists' ? 'playlists' : 'songs'
  const showSongs = state.activeView === 'songs'
  el('songs-panel').hidden = !showSongs
  el('playlists-panel').hidden = showSongs
  el('tab-songs').classList.toggle('active', showSongs)
  el('tab-playlists').classList.toggle('active', !showSongs)
  el('tab-songs').setAttribute('aria-selected', String(showSongs))
  el('tab-playlists').setAttribute('aria-selected', String(!showSongs))
}

function renderSongs() {
  const needle = el('song-search').value.trim().toLowerCase()
  const filtered = state.songs.filter(s => {
    const matchesStatus = state.statusFilter === 'ALL' || s.status === state.statusFilter
    if (!matchesStatus) return false
    if (!needle) return true
    return `${s.title} ${s.artist} ${s.album || ''} ${s.genre || ''} ${s.mood || ''} ${s.language || ''} ${(s.tags || []).join(' ')}`.toLowerCase().includes(needle)
  })

  el('songs-tab-count').textContent = String(state.songs.length)
  el('songs-count').textContent = String(filtered.length)
  const container = el('songs-list')
  container.replaceChildren()

  const pagination = el('songs-pagination')
  if (!filtered.length) {
    pagination.hidden = true
    const empty = document.createElement('p')
    empty.className = 'hint'
    empty.textContent = state.songs.length ? 'No matching songs.' : 'No songs yet. Tap "Import YouTube" or "Upload Audio" above.'
    container.append(empty)
    return
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / SONGS_PAGE_SIZE))
  if (state.songsPage > totalPages) state.songsPage = totalPages
  if (state.songsPage < 1) state.songsPage = 1

  const startIdx = (state.songsPage - 1) * SONGS_PAGE_SIZE
  const pageItems = filtered.slice(startIdx, startIdx + SONGS_PAGE_SIZE)

  pagination.hidden = filtered.length <= SONGS_PAGE_SIZE
  el('songs-page-info').textContent = `Page ${state.songsPage} of ${totalPages} · ${startIdx + 1}–${startIdx + pageItems.length} of ${filtered.length}`
  el('songs-prev-btn').disabled = state.songsPage <= 1
  el('songs-next-btn').disabled = state.songsPage >= totalPages

  pageItems.forEach(song => {
    const row = document.createElement('div')
    row.className = 'song-row'

    const top = document.createElement('div')
    top.className = 'song-top'

    const main = document.createElement('div')
    main.className = 'song-main'

    if (song.thumbnailUrl) {
      const img = document.createElement('img')
      img.className = 'song-thumb'
      img.src = song.thumbnailUrl
      img.loading = 'lazy'
      img.alt = ''
      main.append(img)
    } else {
      const placeholder = document.createElement('div')
      placeholder.className = 'song-thumb'
      placeholder.textContent = '♪'
      main.append(placeholder)
    }

    const meta = document.createElement('div')
    meta.className = 'song-meta'
    const title = document.createElement('h3')
    title.textContent = song.title
    const sub = document.createElement('p')
    const metaLabel = [song.genre, song.mood, song.language].filter(Boolean).join(' · ')
    sub.textContent = `${song.artist} · ${formatDuration(song.durationSeconds)}${metaLabel ? ` · ${metaLabel}` : ''}`
    meta.append(title, sub)
    if (song.status === 'FAILED' && song.errorMessage) {
      const errP = document.createElement('p')
      errP.style.color = 'var(--danger)'
      errP.textContent = song.errorMessage
      meta.append(errP)
    }
    main.append(meta)

    const badge = document.createElement('span')
    badge.className = `badge badge-${song.status.toLowerCase()}`
    badge.textContent = song.status

    top.append(main, badge)

    const actions = document.createElement('div')
    actions.className = 'song-actions'

    const isPreviewing = state.previewSongId === song.id && song.status === 'READY' && Boolean(song.audioUrl)
    if (song.status === 'READY' && song.audioUrl) {
      const playBtn = document.createElement('button')
      playBtn.type = 'button'
      playBtn.className = 'btn btn-ghost btn-sm'
      playBtn.textContent = isPreviewing ? '■ Stop' : '▶ Play'
      playBtn.addEventListener('click', () => {
        state.previewSongId = isPreviewing ? null : song.id
        renderSongs()
      })
      actions.append(playBtn)
    }

    if (song.status === 'FAILED' && song.sourceType === 'youtube' && song.youtubeId) {
      const retryBtn = document.createElement('button')
      retryBtn.type = 'button'
      retryBtn.className = 'btn btn-ghost btn-sm'
      retryBtn.textContent = 'Retry'
      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true
        try {
          await api('/api/admin/ingest', {
            method: 'POST',
            body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${song.youtubeId}` }),
          })
          await refreshAll()
        } catch (err) {
          announcer.textContent = err.message
          retryBtn.disabled = false
        }
      })
      actions.append(retryBtn)
    }

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'btn btn-ghost btn-sm'
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => openEditSongDialog(song))

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'btn btn-danger btn-sm'
    delBtn.textContent = 'Delete'
    delBtn.addEventListener('click', () => confirmDeleteSong(song))

    actions.append(editBtn, delBtn)
    row.append(top, actions)

    if (isPreviewing) {
      const audio = document.createElement('audio')
      audio.className = 'song-audio'
      audio.controls = true
      audio.autoplay = true
      audio.src = song.audioUrl
      row.append(audio)
    }

    container.append(row)
  })
}

function renderPlaylists() {
  el('playlists-tab-count').textContent = String(state.playlists.length)
  el('playlists-count').textContent = String(state.playlists.length)
  const container = el('playlists-list')
  container.replaceChildren()
  if (!state.playlists.length) {
    const empty = document.createElement('p')
    empty.className = 'hint'
    empty.textContent = 'No playlists yet. Tap "New Playlist" above to create one.'
    container.append(empty)
    return
  }

  state.playlists.forEach(pl => {
    const row = document.createElement('div')
    row.className = 'playlist-row'

    const top = document.createElement('div')
    top.className = 'playlist-top'

    const main = document.createElement('div')
    main.className = 'playlist-main'
    const swatch = document.createElement('span')
    swatch.className = 'playlist-swatch'
    swatch.style.backgroundColor = pl.coverColor || '#0096FF'
    const meta = document.createElement('div')
    meta.className = 'playlist-meta'
    const h3 = document.createElement('h3')
    h3.textContent = pl.name
    const p = document.createElement('p')
    p.textContent = `${pl.songCount ?? 0} songs${pl.description ? ` · ${pl.description}` : ''}`
    meta.append(h3, p)
    main.append(swatch, meta)
    top.append(main)

    const actions = document.createElement('div')
    actions.className = 'playlist-actions'
    const songsBtn = document.createElement('button')
    songsBtn.type = 'button'
    songsBtn.className = 'btn btn-ghost btn-sm'
    songsBtn.textContent = 'Songs'
    songsBtn.addEventListener('click', () => openPlaylistSongsDialog(pl))
    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'btn btn-ghost btn-sm'
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => openPlaylistDialog(pl))
    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'btn btn-danger btn-sm'
    delBtn.textContent = 'Delete'
    delBtn.addEventListener('click', async () => {
      try {
        await api(`/api/admin/playlists/${pl.id}`, { method: 'DELETE' })
        await refreshAll()
      } catch (err) {
        announcer.textContent = err.message
      }
    })
    actions.append(songsBtn, editBtn, delBtn)
    row.append(top, actions)
    container.append(row)
  })
}

async function openPlaylistSongsDialog(pl) {
  el('playlist-songs-title').textContent = `${pl.name} — Songs`
  const list = el('playlist-songs-list')
  list.replaceChildren()
  const loading = document.createElement('p')
  loading.className = 'hint'
  loading.textContent = 'Loading songs...'
  list.append(loading)
  el('playlist-songs-dialog').showModal()

  try {
    const data = await api(`/api/playlists/${pl.id}`)
    const songs = data.songs || []
    list.replaceChildren()
    if (!songs.length) {
      const empty = document.createElement('p')
      empty.className = 'hint'
      empty.textContent = 'No songs in this playlist yet.'
      list.append(empty)
      return
    }

    songs.forEach(song => {
      const row = document.createElement('div')
      row.className = 'playlist-row'

      const meta = document.createElement('div')
      meta.className = 'playlist-meta'
      const title = document.createElement('h3')
      title.textContent = song.title
      const artist = document.createElement('p')
      artist.textContent = song.artist || 'Unknown Artist'
      meta.append(title, artist)

      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.className = 'btn btn-danger'
      removeBtn.textContent = 'Remove'
      removeBtn.addEventListener('click', async () => {
        removeBtn.disabled = true
        try {
          await api(`/api/admin/playlists/${pl.id}/songs/${song.id}`, { method: 'DELETE' })
          row.remove()
          if (!list.children.length) {
            const empty = document.createElement('p')
            empty.className = 'hint'
            empty.textContent = 'No songs in this playlist yet.'
            list.append(empty)
          }
          await refreshAll()
        } catch (err) {
          announcer.textContent = err.message
          removeBtn.disabled = false
        }
      })

      row.append(meta, removeBtn)
      list.append(row)
    })
  } catch (err) {
    list.replaceChildren()
    const errEl = document.createElement('p')
    errEl.className = 'server-error'
    errEl.textContent = err.message
    list.append(errEl)
    announcer.textContent = err.message
  }
}

function openEditSongDialog(song) {
  el('edit-song-id').value = song.id
  el('edit-song-title').value = song.title
  el('edit-song-artist').value = song.artist || ''
  setSelectPresetValue(el('edit-song-genre'), song.genre)
  setSelectPresetValue(el('edit-song-mood'), song.mood)
  setSelectPresetValue(el('edit-song-language'), song.language)
  el('edit-song-album').value = song.album || ''
  el('edit-song-tags').value = Array.isArray(song.tags) ? song.tags.join(', ') : ''
  syncTagChipsForInput(el('edit-song-tags'))
  el('edit-song-thumb').value = song.thumbnailUrl || ''
  el('edit-song-playlist').value = ''
  const errEl = el('edit-song-error')
  if (errEl) {
    errEl.textContent = ''
    errEl.hidden = true
  }
  el('edit-song-dialog').showModal()
}

async function confirmDeleteSong(song) {
  const dialog = el('confirm-delete-dialog')
  el('confirm-delete-desc').textContent = `Delete "${song.title}" from the catalog and Cloudflare R2?`
  const result = await awaitDialogResult(dialog)
  if (result !== 'confirm') return

  await api(`/api/admin/songs/${song.id}`, { method: 'DELETE' })
  await refreshAll()
}

function openPlaylistDialog(pl = null) {
  el('playlist-dialog-title').textContent = pl ? 'Edit Playlist' : 'New Playlist'
  el('playlist-id').value = pl ? pl.id : ''
  el('playlist-name').value = pl ? pl.name : ''
  el('playlist-desc').value = pl ? (pl.description || '') : ''
  el('playlist-color').value = pl ? (pl.coverColor || '#0096FF') : '#0096FF'
  el('playlist-dialog').showModal()
}

async function refreshAll() {
  const [songsData, playlistsData, versionData] = await Promise.all([
    api('/api/admin/songs'),
    api('/api/playlists'),
    api('/api/version'),
  ])

  state.songs = songsData.songs || []
  state.playlists = playlistsData.playlists || []

  const w = songsData.worker || { active: 0, queued: 0 }
  el('worker-badge').textContent = w.active || w.queued
    ? `Worker: ${w.active} active, ${w.queued} queued`
    : 'Worker idle'

  if (!el('release-form').contains(document.activeElement)) {
    el('rel-code').value = versionData.versionCode ?? 1
    el('rel-name').value = versionData.versionName ?? '1.0.0'
    el('rel-url').value = versionData.downloadUrl ?? ''
    el('rel-notes').value = versionData.releaseNotes ?? ''
    el('rel-force').checked = Boolean(versionData.forceUpdate)
  }

  populatePlaylistSelects()
  renderSongs()
  renderPlaylists()

  const hasProcessing = state.songs.some(s => s.status === 'PROCESSING')
  if (hasProcessing && !state.pollTimer) {
    state.pollTimer = setInterval(() => refreshAll().catch(console.error), 2500)
  } else if (!hasProcessing && state.pollTimer) {
    clearInterval(state.pollTimer)
    state.pollTimer = null
  }
}

async function enterDashboard() {
  el('login-view').hidden = true
  el('admin-topbar').hidden = false
  el('dashboard-main').hidden = false
  el('dashboard-view').hidden = false
  await refreshAll()
}

function bindEvents() {
  el('toggle-secret-btn').addEventListener('click', () => {
    const input = el('admin-secret')
    const show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    el('toggle-secret-btn').textContent = show ? 'Hide' : 'Show'
    el('toggle-secret-btn').setAttribute('aria-pressed', String(show))
  })

  el('sign-out-btn').addEventListener('click', confirmSignOut)
  el('song-search').addEventListener('input', () => {
    state.songsPage = 1
    renderSongs()
  })

  document.querySelectorAll('.filter-pill[data-status-filter]').forEach(pill => {
    pill.addEventListener('click', () => {
      state.statusFilter = pill.dataset.statusFilter || 'ALL'
      state.songsPage = 1
      document.querySelectorAll('.filter-pill[data-status-filter]').forEach(p => {
        p.classList.toggle('active', p === pill)
      })
      renderSongs()
    })
  })

  el('songs-prev-btn').addEventListener('click', () => {
    if (state.songsPage > 1) {
      state.songsPage -= 1
      renderSongs()
      el('songs-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })

  el('songs-next-btn').addEventListener('click', () => {
    state.songsPage += 1
    renderSongs()
    el('songs-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  el('tab-songs').addEventListener('click', () => setActiveView('songs'))
  el('tab-playlists').addEventListener('click', () => setActiveView('playlists'))

  el('open-yt-btn').addEventListener('click', () => {
    el('yt-url').value = ''
    clearYtPreview()
    setStatus(el('ingest-status'), '')
    el('yt-dialog').showModal()
    el('yt-url').focus()
  })

  el('yt-dialog').addEventListener('close', () => {
    clearYtPreview()
    setStatus(el('ingest-status'), '')
  })

  el('open-upload-btn').addEventListener('click', () => {
    setStatus(el('upload-status'), '')
    el('upload-dialog').showModal()
  })

  el('open-release-btn').addEventListener('click', () => {
    setStatus(el('release-status'), '')
    el('release-dialog').showModal()
  })

  el('new-playlist-btn').addEventListener('click', () => openPlaylistDialog(null))

  el('login-form').addEventListener('submit', async e => {
    e.preventDefault()
    if (!e.target.reportValidity()) {
      e.target.querySelector(':invalid')?.focus()
      return
    }
    const btn = el('login-submit-btn')
    const errBox = el('login-server-error')
    errBox.hidden = true
    btn.disabled = true
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ secret: el('admin-secret').value }),
      })
      state.token = data.token
      sessionStorage.setItem(TOKEN_KEY, state.token)
      resetFormSafely(e.target)
      await enterDashboard()
    } catch (err) {
      errBox.textContent = err.message
      errBox.hidden = false
    } finally {
      btn.disabled = false
    }
  })

  let ytPreviewSeq = 0

  const clearYtPreview = () => {
    ytPreviewSeq += 1
    const btn = el('yt-preview-btn')
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Fetch Info'
    }
    el('yt-preview-panel').hidden = true
    el('yt-preview-thumb').hidden = true
    el('yt-preview-thumb').src = ''
    el('yt-preview-duration').textContent = 'Review before importing'
    el('yt-title').value = ''
    el('yt-artist').value = ''
    setSelectPresetValue(el('yt-genre'), '')
    setSelectPresetValue(el('yt-mood'), '')
    setSelectPresetValue(el('yt-language'), '')
    el('yt-album').value = ''
    el('yt-tags').value = ''
    syncTagChipsForInput(el('yt-tags'))
    el('ingest-submit-btn').textContent = 'Queue Import'
  }

  const fetchYtPreview = async () => {
    const urlVal = el('yt-url').value.trim()
    if (!urlVal) {
      clearYtPreview()
      el('yt-url').focus()
      return
    }
    const currentSeq = ++ytPreviewSeq
    const btn = el('yt-preview-btn')
    const status = el('ingest-status')
    setStatus(status, '')
    btn.disabled = true
    btn.textContent = 'Fetching...'

    try {
      const res = await api('/api/admin/ingest/preview', {
        method: 'POST',
        body: JSON.stringify({ url: urlVal }),
      })
      if (currentSeq !== ytPreviewSeq) return

      if (res.duplicate) {
        clearYtPreview()
        setStatus(status, `Already in catalog: "${res.song?.title || 'Track'}".`, true)
        return
      }
      const m = res.metadata || {}
      el('yt-title').value = m.title || ''
      el('yt-artist').value = m.artist || ''
      setSelectPresetValue(el('yt-genre'), m.genre)
      setSelectPresetValue(el('yt-mood'), m.mood)
      setSelectPresetValue(el('yt-language'), m.language)
      el('yt-album').value = m.album || ''
      el('yt-tags').value = Array.isArray(m.tags) ? m.tags.join(', ') : ''
      syncTagChipsForInput(el('yt-tags'))

      const thumb = el('yt-preview-thumb')
      if (res.thumbnailUrl) {
        thumb.src = res.thumbnailUrl
        thumb.hidden = false
      } else {
        thumb.hidden = true
      }
      el('yt-preview-duration').textContent = res.durationSeconds
        ? `Duration: ${formatDuration(res.durationSeconds)} · Review & edit before importing`
        : 'Review & edit before importing'
      el('yt-preview-panel').hidden = false
      el('ingest-submit-btn').textContent = 'Confirm & Import'
    } catch (err) {
      if (currentSeq !== ytPreviewSeq) return
      setStatus(status, err.message, true)
    } finally {
      if (currentSeq === ytPreviewSeq) {
        btn.disabled = false
        btn.textContent = 'Fetch Info'
      }
    }
  }

  el('yt-preview-btn').addEventListener('click', fetchYtPreview)
  el('yt-url').addEventListener('paste', () => {
    setTimeout(() => {
      const val = el('yt-url').value.trim()
      if (/youtu\.?be/.test(val)) fetchYtPreview()
    }, 40)
  })
  el('yt-url').addEventListener('input', () => {
    if (!el('yt-url').value.trim()) clearYtPreview()
  })

  el('ingest-form').addEventListener('submit', async e => {
    e.preventDefault()
    if (!e.target.reportValidity()) {
      e.target.querySelector(':invalid')?.focus()
      return
    }
    const status = el('ingest-status')
    const btn = el('ingest-submit-btn')
    setStatus(status, '')
    btn.disabled = true
    try {
      const previewOpen = !el('yt-preview-panel').hidden
      const payload = {
        url: el('yt-url').value,
        playlistId: el('yt-playlist').value || null,
      }
      if (previewOpen) {
        payload.title = el('yt-title').value
        payload.artist = el('yt-artist').value
        payload.genre = el('yt-genre').value
        payload.mood = el('yt-mood').value
        payload.language = el('yt-language').value
        payload.album = el('yt-album').value
        payload.tags = el('yt-tags').value
      }
      const res = await api('/api/admin/ingest', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const songTitle = res.song?.title || payload.title || 'Track'
      resetFormSafely(e.target)
      clearYtPreview()
      setStatus(
        status,
        res.duplicate
          ? `Already in catalog: "${songTitle}". Paste next link.`
          : `✓ Queued "${songTitle}"! Downloading in background. Ready for next song:`,
        Boolean(res.duplicate)
      )
      await refreshAll()
      el('yt-url').focus()
    } catch (err) {
      setStatus(status, err.message, true)
    } finally {
      btn.disabled = false
    }
  })

  el('upload-form').addEventListener('submit', async e => {
    e.preventDefault()
    if (!e.target.reportValidity()) {
      e.target.querySelector(':invalid')?.focus()
      return
    }
    const formData = new FormData(e.target)
    const status = el('upload-status')
    const btn = el('upload-submit-btn')
    const wrap = el('upload-progress-wrap')
    const bar = el('upload-progress')
    const label = el('upload-progress-label')

    setStatus(status, '')
    btn.disabled = true
    wrap.hidden = false
    bar.value = 0
    label.textContent = '0%'

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/admin/songs/upload')
        xhr.setRequestHeader('Authorization', `Bearer ${state.token}`)
        xhr.upload.addEventListener('progress', evt => {
          if (!evt.lengthComputable) return
          const pct = Math.round((evt.loaded / evt.total) * 100)
          bar.value = pct
          label.textContent = `${pct}%`
        })
        xhr.addEventListener('load', () => {
          const json = (() => { try { return JSON.parse(xhr.responseText) } catch { return {} } })()
          if (xhr.status >= 200 && xhr.status < 300) resolve(json)
          else reject(new Error(json.error || `Upload failed (${xhr.status})`))
        })
        xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
        xhr.send(formData)
      })
      resetFormSafely(e.target)
      syncTagChipsForInput(el('upload-tags'))
      setStatus(status, 'Song uploaded and ready!')
      await refreshAll()
      el('upload-dialog').close()
    } catch (err) {
      setStatus(status, err.message, true)
    } finally {
      btn.disabled = false
      wrap.hidden = true
    }
  })

  el('edit-song-form').addEventListener('submit', async e => {
    e.preventDefault()
    if (!e.target.reportValidity()) {
      e.target.querySelector(':invalid')?.focus()
      return
    }
    const id = el('edit-song-id').value
    const playlistId = el('edit-song-playlist').value
    const errEl = el('edit-song-error')
    if (errEl) {
      errEl.textContent = ''
      errEl.hidden = true
    }
    try {
      await api(`/api/admin/songs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: el('edit-song-title').value,
          artist: el('edit-song-artist').value,
          genre: el('edit-song-genre').value,
          mood: el('edit-song-mood').value,
          language: el('edit-song-language').value,
          album: el('edit-song-album').value,
          tags: el('edit-song-tags').value,
          thumbnailUrl: el('edit-song-thumb').value || null,
        }),
      })
      if (playlistId) {
        await api(`/api/admin/playlists/${playlistId}/songs`, {
          method: 'POST',
          body: JSON.stringify({ songId: id }),
        })
      }
      el('edit-song-dialog').close()
      await refreshAll()
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message
        errEl.hidden = false
      }
      announcer.textContent = err.message
    }
  })

  el('edit-song-detect-btn').addEventListener('click', async () => {
    const id = el('edit-song-id').value
    const btn = el('edit-song-detect-btn')
    if (!id) return
    btn.disabled = true
    btn.textContent = 'Detecting...'
    try {
      const res = await api('/api/admin/songs/enrich', {
        method: 'POST',
        body: JSON.stringify({
          songId: id,
          title: el('edit-song-title').value,
          artist: el('edit-song-artist').value,
          album: el('edit-song-album').value,
          genre: el('edit-song-genre').value,
          mood: el('edit-song-mood').value,
          language: el('edit-song-language').value,
          tags: el('edit-song-tags').value,
          previewOnly: true,
        }),
      })
      const m = res.metadata || {}
      if (m.title) el('edit-song-title').value = m.title
      if (m.artist) el('edit-song-artist').value = m.artist
      setSelectPresetValue(el('edit-song-genre'), m.genre)
      setSelectPresetValue(el('edit-song-mood'), m.mood)
      setSelectPresetValue(el('edit-song-language'), m.language)
      if (m.album) el('edit-song-album').value = m.album
      if (Array.isArray(m.tags) && m.tags.length) {
        el('edit-song-tags').value = m.tags.join(', ')
        syncTagChipsForInput(el('edit-song-tags'))
      }
      announcer.textContent = 'Metadata auto-detected. Click Save to apply.'
    } catch (err) {
      announcer.textContent = err.message
    } finally {
      btn.disabled = false
      btn.textContent = 'Auto-Detect'
    }
  })

  el('enrich-all-btn').addEventListener('click', async () => {
    const btn = el('enrich-all-btn')
    btn.disabled = true
    btn.textContent = 'Filling...'
    try {
      const res = await api('/api/admin/songs/enrich', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      announcer.textContent = `Updated metadata for ${res.updatedCount || 0} songs.`
      await refreshAll()
    } catch (err) {
      announcer.textContent = err.message
    } finally {
      btn.disabled = false
      btn.textContent = 'Auto-Fill All Metadata'
    }
  })

  el('playlist-form').addEventListener('submit', async e => {
    e.preventDefault()
    if (!e.target.reportValidity()) {
      e.target.querySelector(':invalid')?.focus()
      return
    }
    const id = el('playlist-id').value
    const payload = {
      name: el('playlist-name').value,
      description: el('playlist-desc').value,
      coverColor: el('playlist-color').value,
    }
    try {
      if (id) {
        await api(`/api/admin/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await api('/api/admin/playlists', { method: 'POST', body: JSON.stringify(payload) })
      }
      el('playlist-dialog').close()
      await refreshAll()
    } catch (err) {
      announcer.textContent = err.message
    }
  })

  el('release-form').addEventListener('submit', async e => {
    e.preventDefault()
    if (!e.target.reportValidity()) {
      e.target.querySelector(':invalid')?.focus()
      return
    }
    const status = el('release-status')
    setStatus(status, '')
    try {
      await api('/api/admin/version', {
        method: 'PUT',
        body: JSON.stringify({
          versionCode: Number(el('rel-code').value),
          versionName: el('rel-name').value,
          downloadUrl: el('rel-url').value,
          releaseNotes: el('rel-notes').value,
          forceUpdate: el('rel-force').checked,
        }),
      })
      setStatus(status, 'Release metadata saved!')
      setTimeout(() => {
        if (el('release-dialog').open) el('release-dialog').close()
      }, 650)
    } catch (err) {
      setStatus(status, err.message, true)
    }
  })
}

setupFieldValidationSync()
setupDialogLightDismiss()
initMetadataControls()
bindEvents()

if (state.token) {
  enterDashboard().catch(err => {
    console.warn(err)
    signOut()
  })
}
