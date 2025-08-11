(async function(){
  // MAIN: your existing quran-json base for text/translations
  const BASE_QURAN = "https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist";
  // AUDIO: same source used in your earlier audio code (semarketir quranjson raw)
  const BASE_AUDIO = "https://raw.githubusercontent.com/semarketir/quranjson/master/source";

  // Elements
  const surahListEl = document.getElementById('surahList');
  const contentEl = document.getElementById('content');
  const listStatus = document.getElementById('listStatus');
  const searchInput = document.getElementById('searchInput');
  const refreshBtn = document.getElementById('refreshBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const translationSelect = document.getElementById('translationSelect');
  const themeSelect = document.getElementById('themeSelect');
  const showBookmarksBtn = document.getElementById('showBookmarksBtn');
  const bookmarksListEl = document.getElementById('bookmarksList');

  // State
  let surahIndex = [];
  let currentSurahId = null;
  let currentTranslation = localStorage.getItem('quran_translation') || 'en';
  let currentTheme = localStorage.getItem('quran_theme') || 'dark';
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '{}');

  // Audio state (global so only one audio plays at a time)
  // _q_audio: Audio object; _q_audio_btn: the button element currently showing playing state
  window._q_audio = null;
  window._q_audio_btn = null;
  // Cache audio index per surah to avoid refetching
  const audioIndexCache = {};

  // Apply saved theme
  function applyTheme(theme) {
    if(theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    themeSelect.value = theme;
  }

  applyTheme(currentTheme);
  translationSelect.value = currentTranslation;

  // Fetch helper
  async function fetchJson(url) {
    try {
      const res = await fetch(url);
      if(!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // Load Surah list
  async function loadSurahList() {
    listStatus.textContent = 'Loading surah list...';
    const data = await fetchJson(`${BASE_QURAN}/chapters/index.json`);
    if(!data) {
      listStatus.textContent = 'Failed to load surah list.'; return;
    }
    surahIndex = data;
    renderSurahList(surahIndex);
    listStatus.textContent = '';
  }

  function renderSurahList(list) {
    surahListEl.innerHTML = '';
    if(list.length === 0) {
      surahListEl.innerHTML = '<div class="muted">No surah found.</div>';
      return;
    }
    for (const surah of list) {
      const div = document.createElement('div');
      div.className = 'surah-item';
      div.tabIndex = 0;
      div.setAttribute('role', 'button');
      div.setAttribute('aria-pressed', 'false');
      div.dataset.id = surah.id;

      div.innerHTML = `<strong>${surah.id}. ${surah.name}</strong><br><span class="surah-meta">${surah.transliteration} - ${surah.type}</span>`;
      div.addEventListener('click', () => {
        showBookmarksList(false);
        loadSurah(surah.id);
      });
      div.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showBookmarksList(false);
          loadSurah(surah.id);
        }
      });
      surahListEl.appendChild(div);
    }
  }

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    if(!term) {
      renderSurahList(surahIndex);
      return;
    }
    const filtered = surahIndex.filter(s => 
      s.name.toLowerCase().includes(term) ||
      s.transliteration.toLowerCase().includes(term) ||
      s.id.toString() === term
    );
    renderSurahList(filtered);
  });

  // utility: convert to padded strings
  function toNumberParts(index){
    const n = parseInt(index,10);
    return { n, padded3: String(n).padStart(3,'0'), padded: String(n) };
  }

  // fetch audio index for a surah (cache)
  async function getAudioIndexForSurah(surahId){
    const { padded3 } = toNumberParts(surahId);
    if(audioIndexCache[padded3]) return audioIndexCache[padded3];
    const idx = await fetchJson(`${BASE_AUDIO}/audio/${padded3}/index.json`);
    audioIndexCache[padded3] = idx;
    return idx;
  }

  async function loadSurah(surahId) {
    currentSurahId = surahId;
    // stop any playing audio when switching surah
    stopCurrentAudio();

    contentEl.innerHTML = `<div class="muted">Loading Surah ${surahId}...</div>`;
    const urlWithTranslation = `${BASE_QURAN}/chapters/${currentTranslation}/${surahId}.json`;
    const urlArabicOnly = `${BASE_QURAN}/chapters/${surahId}.json`;

    let data = await fetchJson(urlWithTranslation);
    if(!data) {
      data = await fetchJson(urlArabicOnly);
    }
    if(!data) {
      contentEl.innerHTML = `<div class="muted">Failed to load Surah ${surahId}.</div>`;
      return;
    }

    // also load audio index for this surah (if available) in parallel
    const audioIndex = await getAudioIndexForSurah(surahId);

    renderSurah(data, audioIndex);
    saveLastBookmarkOrSurah(surahId);
  }

  function renderSurah(data, audioIndex){
    const { id, name, transliteration, total_verses, verses } = data;

    document.title = `Qur'an - Surah ${name} (${transliteration})`;

    const fragment = document.createDocumentFragment();

    const titlebar = document.createElement('div');
    titlebar.className = 'titlebar';
    const titleH2 = document.createElement('h2');
    titleH2.textContent = `${id}. ${name} (${transliteration}) — ${total_verses} verses`;
    titlebar.appendChild(titleH2);

    const navControls = document.createElement('div');
    navControls.className = 'controls';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn secondary';
    prevBtn.textContent = '← Prev';
    prevBtn.disabled = (id <= 1);
    prevBtn.title = 'Previous Surah';
    prevBtn.onclick = () => {
      if(id > 1) loadSurah(id - 1);
    };

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn secondary';
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = (id >= 114);
    nextBtn.title = 'Next Surah';
    nextBtn.onclick = () => {
      if(id < 114) loadSurah(id + 1);
    };

    navControls.appendChild(prevBtn);
    navControls.appendChild(nextBtn);
    titlebar.appendChild(navControls);
    fragment.appendChild(titlebar);

    // For audio URL building
    const { padded3 } = toNumberParts(id);

    for (const verse of verses) {
      const verseCard = document.createElement('article');
      verseCard.className = 'verse-card';

      const isBookmarked = !!bookmarks[`${id}-${verse.id}`];
      if(isBookmarked) {
        verseCard.classList.add('bookmarked');
      }

      const metaDiv = document.createElement('div');
      metaDiv.className = 'verse-meta';

      const verseNum = document.createElement('span');
      verseNum.className = 'verse-num';
      verseNum.textContent = `(${verse.id})`;

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'verse-actions';

      // Bookmark button
      const bookmarkBtn = document.createElement('button');
      bookmarkBtn.title = isBookmarked ? 'Remove bookmark' : 'Bookmark this ayah';
      bookmarkBtn.classList.add('bookmark-btn');
      bookmarkBtn.innerHTML = isBookmarked ? '🔖' : '📑';
      bookmarkBtn.addEventListener('click', () => {
        toggleBookmark(id, verse.id, verse.text);
        const nowBookmarked = !!bookmarks[`${id}-${verse.id}`];
        bookmarkBtn.innerHTML = nowBookmarked ? '🔖' : '📑';
        bookmarkBtn.title = nowBookmarked ? 'Remove bookmark' : 'Bookmark this ayah';
        if(nowBookmarked) {
          verseCard.classList.add('bookmarked');
        } else {
          verseCard.classList.remove('bookmarked');
        }
        renderBookmarksList(); // update bookmark list if visible
      });

      // Share button
      const shareBtn = document.createElement('button');
      shareBtn.title = 'Share this ayah';
      shareBtn.innerHTML = '📤';
      shareBtn.addEventListener('click', () => {
        shareAyah(id, verse.id, verse.text, data.name, data.transliteration);
      });

      actionsDiv.appendChild(bookmarkBtn);

      // AUDIO: If audioIndex exists and has this verse, add audio button
      let audioFile = null;
      try {
        // audioIndex structure matches earlier repo: index.verse['verse_1'] ...
        if(audioIndex && audioIndex.verse){
          // find by key name used in other code: verse_{n}
          const key = 'verse_' + verse.id;
          if(audioIndex.verse[key] && audioIndex.verse[key].file){
            audioFile = audioIndex.verse[key].file;
          }
        }
      } catch(e){
        audioFile = null;
      }

      if(audioFile){
        const audioBtn = document.createElement('button');
        audioBtn.className = 'audio-btn';
        // audio file name might be like 001001.mp3 ; store full path or relative index
        // store file (raw filename) to construct final url later.
        audioBtn.dataset.audio = audioFile;
        audioBtn.innerHTML = `▶ Play`;
        audioBtn.title = 'Play recitation for this ayah';

        // audio click handler - uses global window._q_audio to ensure single audio
        audioBtn.addEventListener('click', (ev) => {
          const file = audioBtn.dataset.audio;
          const audioUrl = `${BASE_AUDIO}/audio/${padded3}/${file}`;

          // if some other audio is playing and it's not this same url, stop it
          if(window._q_audio && !window._q_audio.paused){
            // if same audio object and same source toggle play/pause
            if(window._q_audio.src === audioUrl){
              // same source -> toggle
              if(window._q_audio.paused){
                window._q_audio.play().catch(()=>{});
                updateAudioBtnState(audioBtn, true);
              } else {
                window._q_audio.pause();
                updateAudioBtnState(audioBtn, false);
              }
              return;
            } else {
              // different audio -> stop previous and reset its button
              try {
                window._q_audio.pause();
              } catch(e){}
              if(window._q_audio_btn){
                updateAudioBtnState(window._q_audio_btn, false);
              }
              window._q_audio = null;
              window._q_audio_btn = null;
            }
          }

          // If no audio object or different, create new Audio and play
          const a = new Audio(audioUrl);
          window._q_audio = a;
          window._q_audio_btn = audioBtn;
          a.play().then(()=> {
            updateAudioBtnState(audioBtn, true);
          }).catch(err=>{
            console.warn('audio play failed', err);
            updateAudioBtnState(audioBtn, false);
            window._q_audio = null;
            window._q_audio_btn = null;
          });
          a.onended = ()=> {
            updateAudioBtnState(audioBtn, false);
            window._q_audio = null;
            window._q_audio_btn = null;
          };
          a.onpause = ()=> {
            // update button only if it's the same audio and not ended (onpause triggers for pause)
            if(window._q_audio === a){
              updateAudioBtnState(audioBtn, false);
            }
          };
        });

        actionsDiv.appendChild(audioBtn);
      }

      // append share button after audio/bookmark
      actionsDiv.appendChild(shareBtn);

      metaDiv.appendChild(verseNum);
      metaDiv.appendChild(actionsDiv);

      const arabicText = document.createElement('div');
      arabicText.className = 'verse-ar';
      arabicText.textContent = verse.text;

      const translitText = document.createElement('div');
      translitText.className = 'verse-translation';
      translitText.textContent = verse.transliteration || '';

      const translationText = document.createElement('div');
      translationText.className = 'verse-translation';

      // Add Urdu font class for Urdu translation
      let trText = '';
      if(verse.translation) trText = verse.translation;
      else if(verse.translations && verse.translations[currentTranslation]) trText = verse.translations[currentTranslation];
      translationText.textContent = trText;

      if(currentTranslation === 'ur') {
        translationText.classList.add('ur');
      } else {
        translationText.classList.remove('ur');
      }

      verseCard.appendChild(metaDiv);
      verseCard.appendChild(arabicText);
      if(translitText.textContent) verseCard.appendChild(translitText);
      if(translationText.textContent) verseCard.appendChild(translationText);

      fragment.appendChild(verseCard);
    }

    contentEl.innerHTML = '';
    contentEl.appendChild(fragment);

    scrollToLastBookmark(id);
  }

  // helper: update audio button UI text/icon
  function updateAudioBtnState(btn, playing){
    if(!btn) return;
    btn.textContent = playing ? '⏸ Pause' : '▶ Play';
  }

  // stop current audio and reset button UI
  function stopCurrentAudio(){
    if(window._q_audio){
      try { window._q_audio.pause(); } catch(e){}
      window._q_audio = null;
    }
    if(window._q_audio_btn){
      updateAudioBtnState(window._q_audio_btn, false);
      window._q_audio_btn = null;
    }
  }

  function toggleBookmark(surahId, verseId, text) {
    const key = `${surahId}-${verseId}`;
    if(bookmarks[key]) {
      delete bookmarks[key];
    } else {
      bookmarks[key] = { surahId, verseId, text, timestamp: Date.now() };
    }
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    saveLastBookmarkOrSurah(surahId, verseId);
  }

  function saveLastBookmarkOrSurah(surahId, verseId=null) {
    if(verseId) {
      localStorage.setItem('lastBookmark', JSON.stringify({surahId, verseId}));
    } else {
      localStorage.setItem('lastBookmark', JSON.stringify({surahId}));
    }
  }

  function scrollToLastBookmark(surahId) {
    try {
      const lastBookmarkRaw = localStorage.getItem('lastBookmark');
      if(!lastBookmarkRaw) return;
      const lastBookmark = JSON.parse(lastBookmarkRaw);
      if(lastBookmark.surahId !== surahId) return;
      if(!lastBookmark.verseId) return;
      const verses = contentEl.querySelectorAll('.verse-card');
      for (const verseCard of verses) {
        const verseNumSpan = verseCard.querySelector('.verse-num');
        if(verseNumSpan && verseNumSpan.textContent === `(${lastBookmark.verseId})`) {
          verseCard.scrollIntoView({behavior: 'smooth', block: 'center'});
          break;
        }
      }
    } catch(e) {
      console.warn('scrollToLastBookmark error', e);
    }
  }

  function shareAyah(surahId, verseId, text, surahName, surahTranslit) {
    const shareText = `Surah ${surahId} (${surahName} / ${surahTranslit}), Ayah ${verseId}:\n\n${text}\n\n— Qur'an Viewer`;
    if(navigator.share) {
      navigator.share({
        title: `Surah ${surahId} Ayah ${verseId}`,
        text: shareText,
      }).catch(() => alert('Sharing canceled or failed'));
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Ayah text copied to clipboard');
      }, () => {
        alert('Failed to copy ayah text');
      });
    }
  }

  function renderBookmarksList() {
    bookmarksListEl.innerHTML = '';
    if(Object.keys(bookmarks).length === 0) {
      bookmarksListEl.innerHTML = '<div class="muted">No saved bookmarks.</div>';
      return;
    }

    // Sort bookmarks by timestamp descending (recent first)
    const sortedKeys = Object.keys(bookmarks).sort((a,b) => bookmarks[b].timestamp - bookmarks[a].timestamp);

    const title = document.createElement('h3');
    title.textContent = 'Saved Bookmarks';
    bookmarksListEl.appendChild(title);

    for(const key of sortedKeys) {
      const bm = bookmarks[key];
      const surahName = surahIndex.find(s => s.id === bm.surahId)?.name || `Surah ${bm.surahId}`;

      const item = document.createElement('div');
      item.className = 'bookmark-item';

      const info = document.createElement('div');
      info.className = 'bookmark-info';
      info.innerHTML = `<span class="surah-name">${surahName}</span>Ayah ${bm.verseId}`;

      const goBtn = document.createElement('button');
      goBtn.className = 'bookmark-btn-go';
      goBtn.textContent = 'Go to Ayah';
      goBtn.title = `Go to Surah ${bm.surahId}, Ayah ${bm.verseId}`;
      goBtn.addEventListener('click', () => {
        showBookmarksList(false);
        loadSurah(bm.surahId).then(() => {
          setTimeout(() => {
            scrollToVerse(bm.verseId);
            saveLastBookmarkOrSurah(bm.surahId, bm.verseId);
          }, 200);
        });
      });

      item.appendChild(info);
      item.appendChild(goBtn);

      bookmarksListEl.appendChild(item);
    }
  }

  function scrollToVerse(verseId) {
    const verses = contentEl.querySelectorAll('.verse-card');
    for(const verseCard of verses) {
      const verseNumSpan = verseCard.querySelector('.verse-num');
      if(verseNumSpan && verseNumSpan.textContent === `(${verseId})`) {
        verseCard.scrollIntoView({behavior: 'smooth', block: 'center'});
        break;
      }
    }
  }

  function showBookmarksList(show=true) {
    if(show) {
      bookmarksListEl.style.display = 'block';
      surahListEl.style.display = 'none';
      showBookmarksBtn.textContent = 'Hide Bookmarks';
      renderBookmarksList();
    } else {
      bookmarksListEl.style.display = 'none';
      surahListEl.style.display = 'block';
      showBookmarksBtn.textContent = 'Saved Bookmarks';
    }
  }

  // Event handlers
  refreshBtn.onclick = () => loadSurahList();
  settingsBtn.onclick = () => settingsModal.classList.add('show');
  closeSettingsBtn.onclick = () => settingsModal.classList.remove('show');
  themeSelect.onchange = (e) => {
    currentTheme = e.target.value;
    localStorage.setItem('quran_theme', currentTheme);
    applyTheme(currentTheme);
  };
  translationSelect.onchange = (e) => {
    currentTranslation = e.target.value;
    localStorage.setItem('quran_translation', currentTranslation);
    if(currentSurahId) loadSurah(currentSurahId);
  };
  showBookmarksBtn.onclick = () => {
    if(bookmarksListEl.style.display === 'block') {
      showBookmarksList(false);
    } else {
      showBookmarksList(true);
    }
  };

  // Load initial data and last bookmark or default Surah Al-Fatihah
  await loadSurahList();

  let lastBookmarkRaw = localStorage.getItem('lastBookmark');
  if(lastBookmarkRaw) {
    try {
      const lastBookmark = JSON.parse(lastBookmarkRaw);
      if(lastBookmark.surahId) {
        await loadSurah(lastBookmark.surahId);
        if(lastBookmark.verseId) scrollToLastBookmark(lastBookmark.surahId);
      } else {
        await loadSurah(1);
      }
    } catch {
      await loadSurah(1);
    }
  } else {
    await loadSurah(1);
  }

})();
