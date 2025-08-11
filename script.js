(async function(){
  const BASE_QURAN = "https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist";
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
  const drawer = document.getElementById('drawer');
  const openDrawerBtn = document.getElementById('openDrawerBtn');
  const mobileTitle = document.getElementById('mobileTitle');
  const openSettingsMobile = document.getElementById('openSettingsMobile');

  // State
  let surahIndex = [];
  let currentSurahId = null;
  let currentTranslation = localStorage.getItem('quran_translation') || 'en';
  let currentTheme = localStorage.getItem('quran_theme') || 'dark';
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '{}');

  // Audio state (global)
  window._q_audio = null;
  window._q_audio_btn = null;
  const audioIndexCache = {};

  // MOBILE detection: combine matchMedia (screen size) and UA soft-check
  function detectMobileDevice(){
    const small = window.matchMedia('(max-width:700px)').matches;
    const ua = navigator.userAgent || navigator.vendor || '';
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    return small || uaMobile;
  }

  // Apply initial theme
  function applyTheme(theme){
    if(theme === 'light') document.body.classList.add('light');
    else document.body.classList.remove('light');
    themeSelect.value = theme;
  }
  applyTheme(currentTheme);
  translationSelect.value = currentTranslation;

  // Apply mobile class and adjust UI components
  function applyResponsiveUI(){
    const mobile = detectMobileDevice();
    if(mobile){
      document.body.classList.add('mobile');
      // move surah list into drawer for mobile (cloned)
      buildDrawer();
      mobileTitle.textContent = currentSurahId ? `Surah ${currentSurahId}` : 'Qur\'an';
      // hide desktop sidebar if present
      document.getElementById('sidebar').style.display = 'none';
      // show mobile control buttons
      document.querySelector('.mobile-top').style.display = 'flex';
    } else {
      document.body.classList.remove('mobile');
      drawer.classList.remove('show');
      document.getElementById('sidebar').style.display = 'block';
      document.querySelector('.mobile-top').style.display = 'none';
    }
  }

  // Build drawer (clone surah list & bookmarks) for mobile
  function buildDrawer(){
    drawer.innerHTML = '';
    const h = document.createElement('div');
    h.style.display='flex'; h.style.justifyContent='space-between'; h.style.alignItems='center'; h.style.marginBottom='8px';
    const t = document.createElement('div'); t.textContent = 'Surahs'; t.style.fontWeight='700';
    const close = document.createElement('button'); close.className='btn secondary'; close.textContent='Close'; close.onclick = ()=>drawer.classList.remove('show');
    h.appendChild(t); h.appendChild(close);
    drawer.appendChild(h);

    // search in drawer
    const sdiv = document.createElement('div'); sdiv.className='search';
    const input = document.createElement('input'); input.placeholder='Search surah...';
    input.addEventListener('input', ()=> {
      const q = input.value.trim().toLowerCase();
      renderSurahList(q ? surahIndex.filter(s => s.name.toLowerCase().includes(q) || s.transliteration.toLowerCase().includes(q) || String(s.id)===q) : surahIndex, drawer);
    });
    sdiv.appendChild(input);
    drawer.appendChild(sdiv);

    // surah container
    const list = document.createElement('div'); list.id='drawerSurahList'; list.style.marginTop='8px';
    drawer.appendChild(list);

    // bookmarks
    const bmBtn = document.createElement('button'); bmBtn.className='btn secondary'; bmBtn.style.marginTop='8px'; bmBtn.textContent='Show Bookmarks';
    bmBtn.onclick = ()=> {
      const bmArea = drawer.querySelector('#drawerBookmarks');
      if(bmArea){
        bmArea.style.display = bmArea.style.display === 'block' ? 'none' : 'block';
      } else {
        const area = document.createElement('div'); area.id='drawerBookmarks'; area.style.marginTop='8px';
        area.innerHTML = '<h3>Bookmarks</h3>'; drawer.appendChild(area);
        // render bookmarks into drawer
        const keys = Object.keys(bookmarks).sort((a,b)=>bookmarks[b].timestamp - bookmarks[a].timestamp);
        if(keys.length===0) area.innerHTML += '<div class="muted">No saved bookmarks.</div>';
        else {
          for(const k of keys){
            const bm = bookmarks[k];
            const item = document.createElement('div'); item.className='bookmark-item';
            const info = document.createElement('div'); info.className='bookmark-info'; info.innerHTML = `<strong>Surah ${bm.surahId}</strong> Ayah ${bm.verseId}`;
            const go = document.createElement('button'); go.className='btn'; go.textContent='Go';
            go.onclick = ()=> { drawer.classList.remove('show'); loadSurah(bm.surahId).then(()=> setTimeout(()=>scrollToVerse(bm.verseId),200)); };
            item.appendChild(info); item.appendChild(go);
            area.appendChild(item);
          }
        }
      }
    };
    drawer.appendChild(bmBtn);

    // initial render of surah list
    renderSurahList(surahIndex, drawer);
  }

  // safe fetch JSON
  async function fetchJson(url){
    try{
      const r = await fetch(url);
      if(!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    }catch(e){
      return null;
    }
  }

  // load surah index
  async function loadSurahList(){
    listStatus.textContent = 'Loading surah list...';
    surahListEl.innerHTML = '';
    const data = await fetchJson(`${BASE_QURAN}/chapters/index.json`);
    if(!data){ listStatus.textContent='Failed to load surah list.'; return; }
    surahIndex = data;
    renderSurahList(surahIndex);
    listStatus.textContent='';
    // rebuild drawer if mobile
    if(document.body.classList.contains('mobile')) buildDrawer();
  }

  // render surah list into container (default sidebar)
  function renderSurahList(list, container = surahListEl){
    container.innerHTML = '';
    if(!list || list.length===0){ container.innerHTML = '<div class="muted">No surah found.</div>'; return; }
    for(const surah of list){
      const div = document.createElement('div'); div.className='surah-item'; div.tabIndex=0;
      div.innerHTML = `<strong>${surah.id}. ${surah.name}</strong><div class="surah-meta">${surah.transliteration} · ${surah.type}</div>`;
      div.onclick = ()=> { if(document.body.classList.contains('mobile')) drawer.classList.remove('show'); loadSurah(surah.id); };
      div.onkeydown = (e)=> { if(e.key==='Enter' || e.key===' ') loadSurah(surah.id); };
      container.appendChild(div);
    }
  }

  // search filter
  searchInput.addEventListener('input', ()=> {
    const q = searchInput.value.trim().toLowerCase();
    if(!q) renderSurahList(surahIndex);
    else renderSurahList(surahIndex.filter(s => s.name.toLowerCase().includes(q) || s.transliteration.toLowerCase().includes(q) || String(s.id)===q));
  });

  refreshBtn.onclick = ()=> loadSurahList();

  // helper: padded id
  function toNumberParts(index){ const n = parseInt(index,10); return { n, padded3: String(n).padStart(3,'0'), padded: String(n) }; }

  // audio index fetch (cache)
  async function getAudioIndexForSurah(surahId){
    const { padded3 } = toNumberParts(surahId);
    if(audioIndexCache[padded3]) return audioIndexCache[padded3];
    const idx = await fetchJson(`${BASE_AUDIO}/audio/${padded3}/index.json`);
    audioIndexCache[padded3] = idx;
    return idx;
  }

  // load surah data and audio index
  async function loadSurah(surahId){
    currentSurahId = surahId;
    applyResponsiveUI(); // update mobile header title
    stopCurrentAudio();
    contentEl.innerHTML = `<div class="muted">Loading Surah ${surahId}...</div>`;
    const urlWithTranslation = `${BASE_QURAN}/chapters/${currentTranslation}/${surahId}.json`;
    const urlArabicOnly = `${BASE_QURAN}/chapters/${surahId}.json`;

    let data = await fetchJson(urlWithTranslation);
    if(!data) data = await fetchJson(urlArabicOnly);
    if(!data){ contentEl.innerHTML = `<div class="muted">Failed to load Surah ${surahId}.</div>`; return; }

    const audioIndex = await getAudioIndexForSurah(surahId);
    renderSurah(data, audioIndex);
    saveLastBookmarkOrSurah(surahId);
    if(document.body.classList.contains('mobile')) mobileTitle.textContent = `${data.name}`;
  }

  // render surah with audio buttons (keeps other features)
  function renderSurah(data, audioIndex){
    const { id, name, transliteration, total_verses, verses } = data;
    document.title = `Qur'an - Surah ${name} (${transliteration})`;

    const frag = document.createDocumentFragment();

    const titlebar = document.createElement('div'); titlebar.className='titlebar';
    const h2 = document.createElement('h2'); h2.textContent = `${id}. ${name} (${transliteration}) — ${total_verses} verses`;
    titlebar.appendChild(h2);

    const nav = document.createElement('div'); nav.className='controls';
    const prevBtn = document.createElement('button'); prevBtn.className='btn secondary'; prevBtn.textContent='← Prev';
    prevBtn.disabled = (id<=1); prevBtn.onclick = ()=> { if(id>1) loadSurah(id-1); };
    const nextBtn = document.createElement('button'); nextBtn.className='btn secondary'; nextBtn.textContent='Next →';
    nextBtn.disabled = (id>=114); nextBtn.onclick = ()=> { if(id<114) loadSurah(id+1); };
    nav.appendChild(prevBtn); nav.appendChild(nextBtn);
    titlebar.appendChild(nav);

    frag.appendChild(titlebar);

    const { padded3 } = toNumberParts(id);

    for(const verse of verses){
      const verseCard = document.createElement('article'); verseCard.className='verse-card';
      const isBookmarked = !!bookmarks[`${id}-${verse.id}`];
      if(isBookmarked) verseCard.classList.add('bookmarked');

      const meta = document.createElement('div'); meta.className='verse-meta';
      const vnum = document.createElement('div'); vnum.className='verse-num'; vnum.textContent = `(${verse.id})`;
      const actions = document.createElement('div'); actions.className='verse-actions';

      // bookmark
      const bmBtn = document.createElement('button'); bmBtn.className='bookmark-btn'; bmBtn.title = isBookmarked ? 'Remove bookmark' : 'Bookmark this ayah';
      bmBtn.innerHTML = isBookmarked ? '🔖' : '📑';
      bmBtn.onclick = ()=> {
        toggleBookmark(id, verse.id, verse.text);
        const now = !!bookmarks[`${id}-${verse.id}`];
        bmBtn.innerHTML = now ? '🔖' : '📑';
        bmBtn.title = now ? 'Remove bookmark' : 'Bookmark this ayah';
        if(now) verseCard.classList.add('bookmarked'); else verseCard.classList.remove('bookmarked');
        renderBookmarksList();
      };

      // share
      const shareBtn = document.createElement('button'); shareBtn.title='Share this ayah'; shareBtn.innerHTML='📤';
      shareBtn.onclick = ()=> shareAyah(id, verse.id, verse.text, data.name, data.transliteration);

      actions.appendChild(bmBtn);

      // audio: check audioIndex structure for verse file
      let audioFile = null;
      try{
        if(audioIndex && audioIndex.verse){
          const key = 'verse_' + verse.id;
          if(audioIndex.verse[key] && audioIndex.verse[key].file) audioFile = audioIndex.verse[key].file;
        }
      }catch(e){ audioFile = null; }

      if(audioFile){
        const audioBtn = document.createElement('button'); audioBtn.className='audio-btn';
        audioBtn.dataset.audio = audioFile;
        audioBtn.textContent = '▶ Play';
        audioBtn.title = 'Play recitation for this ayah';

        audioBtn.addEventListener('click', ()=>{
          const file = audioBtn.dataset.audio;
          const audioUrl = `${BASE_AUDIO}/audio/${padded3}/${file}`;

          // If another audio playing
          if(window._q_audio && !window._q_audio.paused){
            if(window._q_audio.src === audioUrl){
              if(window._q_audio.paused){ window._q_audio.play().catch(()=>{}); updateAudioBtnState(audioBtn,true); }
              else { window._q_audio.pause(); updateAudioBtnState(audioBtn,false); }
              return;
            } else {
              try{ window._q_audio.pause(); }catch(e){}
              if(window._q_audio_btn) updateAudioBtnState(window._q_audio_btn,false);
              window._q_audio = null; window._q_audio_btn = null;
            }
          }

          // create new
          const a = new Audio(audioUrl);
          window._q_audio = a;
          window._q_audio_btn = audioBtn;
          a.play().then(()=> updateAudioBtnState(audioBtn,true)).catch(err=>{ console.warn('audio play failed',err); updateAudioBtnState(audioBtn,false); window._q_audio=null; window._q_audio_btn=null; });
          a.onended = ()=> { updateAudioBtnState(audioBtn,false); window._q_audio=null; window._q_audio_btn=null; };
          a.onpause = ()=> { if(window._q_audio === a) updateAudioBtnState(audioBtn,false); };
        });

        actions.appendChild(audioBtn);
      }

      actions.appendChild(shareBtn);

      meta.appendChild(vnum); meta.appendChild(actions);

      const arabic = document.createElement('div'); arabic.className='verse-ar'; arabic.textContent = verse.text;
      const translit = document.createElement('div'); translit.className='verse-translation'; translit.textContent = verse.transliteration || '';
      const translation = document.createElement('div'); translation.className='verse-translation';
      let trText = '';
      if(verse.translation) trText = verse.translation;
      else if(verse.translations && verse.translations[currentTranslation]) trText = verse.translations[currentTranslation];
      translation.textContent = trText;
      if(currentTranslation === 'ur') translation.classList.add('ur'); else translation.classList.remove('ur');

      verseCard.appendChild(meta);
      verseCard.appendChild(arabic);
      if(translit.textContent) verseCard.appendChild(translit);
      if(translation.textContent) verseCard.appendChild(translation);
      frag.appendChild(verseCard);
    }

    contentEl.innerHTML = '';
    contentEl.appendChild(frag);
    scrollToLastBookmark(id);
  }

  // helpers for audio UI
  function updateAudioBtnState(btn, playing){ if(!btn) return; btn.textContent = playing ? '⏸ Pause' : '▶ Play'; }
  function stopCurrentAudio(){ if(window._q_audio){ try{ window._q_audio.pause(); }catch(e){} window._q_audio=null; } if(window._q_audio_btn){ updateAudioBtnState(window._q_audio_btn,false); window._q_audio_btn=null; } }

  // bookmark functions
  function toggleBookmark(surahId, verseId, text){
    const key = `${surahId}-${verseId}`;
    if(bookmarks[key]) delete bookmarks[key]; else bookmarks[key] = { surahId, verseId, text, timestamp: Date.now() };
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    saveLastBookmarkOrSurah(surahId, verseId);
  }
  function saveLastBookmarkOrSurah(surahId, verseId=null){ if(verseId) localStorage.setItem('lastBookmark', JSON.stringify({surahId,verseId})); else localStorage.setItem('lastBookmark', JSON.stringify({surahId})); }

  function scrollToLastBookmark(surahId){
    try{
      const lastBookmarkRaw = localStorage.getItem('lastBookmark'); if(!lastBookmarkRaw) return;
      const lastBookmark = JSON.parse(lastBookmarkRaw); if(lastBookmark.surahId !== surahId) return; if(!lastBookmark.verseId) return;
      const verses = contentEl.querySelectorAll('.verse-card');
      for(const verseCard of verses){
        const verseNumSpan = verseCard.querySelector('.verse-num');
        if(verseNumSpan && verseNumSpan.textContent === `(${lastBookmark.verseId})`){ verseCard.scrollIntoView({behavior:'smooth',block:'center'}); break; }
      }
    }catch(e){ console.warn('scroll error', e); }
  }

  function scrollToVerse(verseId){
    const verses = contentEl.querySelectorAll('.verse-card');
    for(const verseCard of verses){
      const verseNumSpan = verseCard.querySelector('.verse-num');
      if(verseNumSpan && verseNumSpan.textContent === `(${verseId})`){ verseCard.scrollIntoView({behavior:'smooth',block:'center'}); break; }
    }
  }

  function shareAyah(surahId, verseId, text, surahName, surahTranslit){
    const shareText = `Surah ${surahId} (${surahName} / ${surahTranslit}), Ayah ${verseId}:\n\n${text}\n\n— Qur'an Viewer`;
    if(navigator.share){ navigator.share({title:`Surah ${surahId} Ayah ${verseId}`, text:shareText}).catch(()=>alert('Sharing canceled or failed')); }
    else { navigator.clipboard.writeText(shareText).then(()=>alert('Ayah text copied to clipboard'), ()=>alert('Failed to copy ayah text')); }
  }

  function renderBookmarksList(){
    bookmarksListEl.innerHTML = '';
    const keys = Object.keys(bookmarks).sort((a,b)=>bookmarks[b].timestamp - bookmarks[a].timestamp);
    if(keys.length === 0){ bookmarksListEl.innerHTML = '<div class="muted">No saved bookmarks.</div>'; return; }
    const title = document.createElement('h3'); title.textContent = 'Saved Bookmarks'; bookmarksListEl.appendChild(title);
    for(const k of keys){
      const bm = bookmarks[k]; const surahName = surahIndex.find(s => s.id === bm.surahId)?.name || `Surah ${bm.surahId}`;
      const item = document.createElement('div'); item.className='bookmark-item';
      const info = document.createElement('div'); info.className='bookmark-info'; info.innerHTML=`<span class="surah-name">${surahName}</span>Ayah ${bm.verseId}`;
      const goBtn = document.createElement('button'); goBtn.className='bookmark-btn-go btn'; goBtn.textContent='Go to Ayah';
      goBtn.onclick = ()=> { showBookmarksList(false); loadSurah(bm.surahId).then(()=> setTimeout(()=>{ scrollToVerse(bm.verseId); saveLastBookmarkOrSurah(bm.surahId, bm.verseId); },200)); };
      item.appendChild(info); item.appendChild(goBtn);
      bookmarksListEl.appendChild(item);
    }
  }

  function showBookmarksList(show=true){ if(show){ bookmarksListEl.style.display='block'; surahListEl.style.display='none'; showBookmarksBtn.textContent='Hide Bookmarks'; renderBookmarksList(); } else { bookmarksListEl.style.display='none'; surahListEl.style.display='block'; showBookmarksBtn.textContent='Saved Bookmarks'; } }

  // event handlers
  settingsBtn.onclick = ()=> settingsModal.classList.add('show');
  openSettingsMobile.onclick = ()=> settingsModal.classList.add('show');
  closeSettingsBtn.onclick = ()=> settingsModal.classList.remove('show');
  themeSelect.onchange = (e)=> { currentTheme = e.target.value; localStorage.setItem('quran_theme', currentTheme); applyTheme(currentTheme); }
  translationSelect.onchange = (e)=> { currentTranslation = e.target.value; localStorage.setItem('quran_translation', currentTranslation); if(currentSurahId) loadSurah(currentSurahId); }
  showBookmarksBtn.onclick = ()=> { if(bookmarksListEl.style.display === 'block') showBookmarksList(false); else showBookmarksList(true); }

  openDrawerBtn.onclick = ()=> { drawer.classList.add('show'); drawer.setAttribute('aria-hidden','false'); }
  // close drawer when clicking outside on mobile
  document.addEventListener('click', (e)=> {
    if(document.body.classList.contains('mobile')){
      const inside = drawer.contains(e.target) || openDrawerBtn.contains(e.target);
      if(!inside) drawer.classList.remove('show');
    }
  });

  // UI adapt on resize/orientation change
  window.addEventListener('resize', ()=> { applyResponsiveUI(); });
  window.addEventListener('orientationchange', ()=> { setTimeout(()=>applyResponsiveUI(),200); });

  // initial load
  await loadSurahList();
  applyResponsiveUI();

  let lastBookmarkRaw = localStorage.getItem('lastBookmark');
  if(lastBookmarkRaw){
    try{
      const lastBookmark = JSON.parse(lastBookmarkRaw);
      if(lastBookmark.surahId){ await loadSurah(lastBookmark.surahId); if(lastBookmark.verseId) scrollToLastBookmark(lastBookmark.surahId); }
      else await loadSurah(1);
    }catch(e){ await loadSurah(1); }
  } else await loadSurah(1);

})();
