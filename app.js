// ===== 상표법 암기카드 앱 =====

const APP = {
  data: null,
  cards: [],        // current filtered card list
  allCards: [],     // all merged cards
  idx: 0,
  hintShown: false,
  answerShown: false,
  mode: 'all',      // all | 간략 | 두문자 | 문장
  filter: 'all',    // all | wrong
  known: {},        // { cardKey: true/false }
  shuffled: false,
};

// ===== Data Loading =====
async function loadData() {
  const resp = await fetch('data/상표법_암기자료.json');
  APP.data = await resp.json();
  buildCards();
  loadProgress();
  render();
}

// ===== Build unified card list =====
function buildCards() {
  const d = APP.data;
  const merged = new Map(); // key -> card object

  // 1) 간략 (base entries)
  for (const item of d.간략) {
    const key = item.id;
    merged.set(key, {
      key,
      조문번호: item.id,
      요약: item.요약,
      취지: item.취지,
      두문자: '',
      상세: '',
      문장: '',
      sources: ['간략'],
    });
  }

  // 2) 두문자 - match to existing or create new
  for (const item of d.두문자) {
    const key = item.id;
    // Try to find matching base entry
    const baseKey = findMatchingKey(merged, key);
    if (baseKey) {
      const card = merged.get(baseKey);
      if (!card.두문자) {
        card.두문자 = item.두문자;
        card.상세 = item.상세;
        card.sources.push('두문자');
      } else {
        // Already has 두문자 (sub-topic), create separate card
        merged.set(key, {
          key,
          조문번호: item.id,
          요약: '',
          취지: '',
          두문자: item.두문자,
          상세: item.상세,
          문장: '',
          sources: ['두문자'],
        });
      }
    } else {
      merged.set(key, {
        key,
        조문번호: item.id,
        요약: '',
        취지: '',
        두문자: item.두문자,
        상세: item.상세,
        문장: '',
        sources: ['두문자'],
      });
    }
  }

  // 3) 문장 - match to existing or create new
  for (const item of d.문장) {
    const key = item.id;
    const baseKey = findMatchingKey(merged, key);
    if (baseKey) {
      merged.get(baseKey).문장 = item.문장;
      merged.get(baseKey).sources.push('문장');
    } else {
      merged.set(key, {
        key,
        조문번호: item.id,
        요약: '',
        취지: '',
        두문자: '',
        상세: '',
        문장: item.문장,
        sources: ['문장'],
      });
    }
  }

  APP.allCards = Array.from(merged.values());
  applyFilters();
}

// ===== Match article numbers across different formats =====
function findMatchingKey(map, searchId) {
  // Direct match
  if (map.has(searchId)) return searchId;

  // Normalize: 法33조1항3호 -> extract numbers + suffix
  const normalize = (s) => {
    const nums = s.match(/\d+/g) || [];
    const hasFront = /전/.test(s);
    const hasBack = /후/.test(s);
    return nums.join('-') + (hasFront ? '-전' : '') + (hasBack ? '-후' : '');
  };

  const searchNorm = normalize(searchId);
  if (!searchNorm || searchNorm === '') return null;

  // Only match if the search has enough specificity (at least 2 numbers)
  const searchNums = searchId.match(/\d+/g) || [];
  if (searchNums.length < 2) return null;

  for (const [key] of map) {
    const keyNums = key.match(/\d+/g) || [];
    if (keyNums.length < 2) continue;
    if (normalize(key) === searchNorm) return key;
  }

  return null;
}

// ===== Filters =====
function applyFilters() {
  let cards = [...APP.allCards];

  // Mode filter
  if (APP.mode !== 'all') {
    cards = cards.filter(c => c.sources.includes(APP.mode));
  }

  // Wrong-only filter
  if (APP.filter === 'wrong') {
    cards = cards.filter(c => APP.known[c.key] === false);
  }

  APP.cards = cards;
  APP.idx = Math.min(APP.idx, Math.max(0, cards.length - 1));
}

// ===== Shuffle =====
function shuffle() {
  for (let i = APP.cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [APP.cards[i], APP.cards[j]] = [APP.cards[j], APP.cards[i]];
  }
  APP.shuffled = true;
  APP.idx = 0;
  resetReveal();
  render();
}

function resetReveal() {
  APP.hintShown = false;
  APP.answerShown = false;
}

// ===== Progress =====
function saveProgress() {
  try {
    localStorage.setItem('trademark-quiz-known', JSON.stringify(APP.known));
  } catch (e) {}
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('trademark-quiz-known');
    if (saved) APP.known = JSON.parse(saved);
  } catch (e) {}
}

function resetProgress() {
  APP.known = {};
  saveProgress();
  render();
}

// ===== Navigation =====
function goNext() {
  if (APP.idx < APP.cards.length - 1) {
    APP.idx++;
    resetReveal();
    render();
  }
}

function goPrev() {
  if (APP.idx > 0) {
    APP.idx--;
    resetReveal();
    render();
  }
}

function markKnow(val) {
  const card = APP.cards[APP.idx];
  if (card) {
    APP.known[card.key] = val;
    saveProgress();
  }
  goNext();
}

// ===== Render =====
function render() {
  const app = document.getElementById('app');
  const card = APP.cards[APP.idx];

  if (!APP.data) {
    app.innerHTML = '<div class="empty-state"><p>로딩 중...</p></div>';
    return;
  }

  if (APP.cards.length === 0) {
    app.innerHTML = `
      ${renderHeader()}
      ${renderModes()}
      ${renderFilterBar()}
      <div class="empty-state">
        <p>${APP.filter === 'wrong' ? '틀린 카드가 없습니다!' : '카드가 없습니다.'}</p>
      </div>
    `;
    attachEvents();
    return;
  }

  const knownStatus = APP.known[card.key];
  const hasHint = card.두문자 || card.요약;
  const hasAnswer = card.문장 || card.상세;

  app.innerHTML = `
    ${renderHeader()}
    ${renderModes()}
    ${renderFilterBar()}
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${((APP.idx + 1) / APP.cards.length * 100).toFixed(1)}%"></div>
    </div>
    <div class="card">
      <div class="card-number">${APP.idx + 1} / ${APP.cards.length}</div>
      <div class="card-title">${escHtml(card.조문번호)}</div>
      ${card.취지 ? `<div class="card-purpose">취지: ${escHtml(card.취지)}</div>` : ''}

      ${hasHint ? `
        <div class="reveal-section hint-section ${APP.hintShown ? 'visible' : ''}" id="hint-section">
          <div class="reveal-label">HINT · 두문자</div>
          <div class="reveal-content">
            ${card.두문자 ? `<div class="acronym">${escHtml(card.두문자)}</div>` : ''}
            ${card.요약 ? `<div style="margin-top:8px">${escHtml(card.요약)}</div>` : ''}
          </div>
        </div>
      ` : ''}

      ${hasAnswer ? `
        <div class="reveal-section answer-section ${APP.answerShown ? 'visible' : ''}" id="answer-section">
          <div class="reveal-label">정답 · 전체 내용</div>
          <div class="reveal-content">
            ${card.문장 ? `<div>${escHtml(card.문장)}</div>` : ''}
            ${card.상세 && card.상세 !== card.문장 ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--card-border)">${escHtml(card.상세)}</div>` : ''}
          </div>
        </div>
      ` : ''}

      <div style="flex:1"></div>

      ${renderButtons(hasHint, hasAnswer)}

      ${APP.answerShown || (!hasHint && !hasAnswer) ? `
        <div class="check-group">
          <button class="btn-dunno" onclick="markKnow(false)">모르겠음</button>
          <button class="btn-know" onclick="markKnow(true)">알겠음</button>
        </div>
      ` : ''}
    </div>

    <div class="btn-group">
      <button class="btn btn-prev" onclick="goPrev()" ${APP.idx === 0 ? 'disabled' : ''}>이전</button>
      <button class="btn btn-next" onclick="goNext()" ${APP.idx >= APP.cards.length - 1 ? 'disabled' : ''}>다음</button>
    </div>
  `;

  attachEvents();
}

function renderHeader() {
  const total = APP.allCards.length;
  const knownCount = Object.values(APP.known).filter(v => v === true).length;
  const wrongCount = Object.values(APP.known).filter(v => v === false).length;

  return `
    <div class="header">
      <h1>상표법 암기카드</h1>
      <div class="header-right">
        <span class="progress-text" style="color:var(--success)">${knownCount}O</span>
        <span class="progress-text" style="color:var(--danger)">${wrongCount}X</span>
        <span class="progress-text">${total}장</span>
        <button class="btn-icon" onclick="shuffle()" title="셔플">🔀</button>
        <button class="btn-icon" onclick="if(confirm('진행상황을 초기화할까요?'))resetProgress()" title="초기화">↺</button>
      </div>
    </div>
  `;
}

function renderModes() {
  const modes = [
    ['all', '전체'],
    ['간략', '간략(조문)'],
    ['두문자', '두문자'],
    ['문장', '문장'],
  ];
  return `
    <div class="mode-selector">
      ${modes.map(([key, label]) =>
        `<button class="mode-btn ${APP.mode === key ? 'active' : ''}" data-mode="${key}">${label}</button>`
      ).join('')}
    </div>
  `;
}

function renderFilterBar() {
  const wrongCount = Object.values(APP.known).filter(v => v === false).length;
  return `
    <div class="filter-bar">
      <button class="filter-btn ${APP.filter === 'all' ? 'active' : ''}" data-filter="all">전체 보기</button>
      ${wrongCount > 0 ? `<button class="filter-btn ${APP.filter === 'wrong' ? 'active' : ''}" data-filter="wrong">틀린 것만 (${wrongCount})</button>` : ''}
    </div>
  `;
}

function renderButtons(hasHint, hasAnswer) {
  if (!APP.hintShown && hasHint) {
    return `<button class="btn btn-hint" id="btn-reveal-hint" style="width:100%">힌트 보기</button>`;
  }
  if (!APP.answerShown && hasAnswer) {
    return `<button class="btn btn-answer" id="btn-reveal-answer" style="width:100%">정답 보기</button>`;
  }
  return '';
}

function attachEvents() {
  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.mode = btn.dataset.mode;
      APP.idx = 0;
      resetReveal();
      applyFilters();
      render();
    });
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.filter = btn.dataset.filter;
      APP.idx = 0;
      resetReveal();
      applyFilters();
      render();
    });
  });

  // Reveal buttons
  const hintBtn = document.getElementById('btn-reveal-hint');
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      APP.hintShown = true;
      render();
    });
  }

  const answerBtn = document.getElementById('btn-reveal-answer');
  if (answerBtn) {
    answerBtn.addEventListener('click', () => {
      APP.answerShown = true;
      render();
    });
  }
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// ===== Keyboard shortcuts =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    if (!APP.hintShown && (APP.cards[APP.idx]?.두문자 || APP.cards[APP.idx]?.요약)) {
      APP.hintShown = true;
      render();
    } else if (!APP.answerShown && (APP.cards[APP.idx]?.문장 || APP.cards[APP.idx]?.상세)) {
      APP.answerShown = true;
      render();
    } else {
      goNext();
    }
  } else if (e.key === 'ArrowLeft') {
    goPrev();
  } else if (e.key === '1') {
    markKnow(false);
  } else if (e.key === '2') {
    markKnow(true);
  }
});

// ===== Touch swipe =====
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
document.addEventListener('touchend', e => {
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(diff) > 80) {
    if (diff > 0) goPrev();
    else goNext();
  }
});

// ===== Init =====
loadData();
