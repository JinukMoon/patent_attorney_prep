// ===== 상표법 암기카드 =====

const APP = {
  data: null,
  cards: [],
  allCards: [],
  idx: 0,
  hintShown: false,
  answerShown: false,
  mode: 'all',
  filter: 'all',
  known: {},
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
  const merged = new Map();

  for (const item of d.간략) {
    const key = item.id;
    merged.set(key, {
      key, 조문번호: item.id, 요약: item.요약, 취지: item.취지,
      두문자: '', 상세: '', 문장: '', sources: ['간략'],
    });
  }

  for (const item of d.두문자) {
    const key = item.id;
    const baseKey = findMatchingKey(merged, key);
    if (baseKey) {
      const card = merged.get(baseKey);
      if (!card.두문자) {
        card.두문자 = item.두문자;
        card.상세 = item.상세;
        card.sources.push('두문자');
      } else {
        merged.set(key, {
          key, 조문번호: item.id, 요약: '', 취지: '',
          두문자: item.두문자, 상세: item.상세, 문장: '', sources: ['두문자'],
        });
      }
    } else {
      merged.set(key, {
        key, 조문번호: item.id, 요약: '', 취지: '',
        두문자: item.두문자, 상세: item.상세, 문장: '', sources: ['두문자'],
      });
    }
  }

  for (const item of d.문장) {
    const key = item.id;
    const baseKey = findMatchingKey(merged, key);
    if (baseKey) {
      merged.get(baseKey).문장 = item.문장;
      merged.get(baseKey).sources.push('문장');
    } else {
      merged.set(key, {
        key, 조문번호: item.id, 요약: '', 취지: '',
        두문자: '', 상세: '', 문장: item.문장, sources: ['문장'],
      });
    }
  }

  APP.allCards = Array.from(merged.values());
  applyFilters();
}

function findMatchingKey(map, searchId) {
  if (map.has(searchId)) return searchId;

  const normalize = (s) => {
    const nums = s.match(/\d+/g) || [];
    const hasFront = /전/.test(s);
    const hasBack = /후/.test(s);
    return nums.join('-') + (hasFront ? '-전' : '') + (hasBack ? '-후' : '');
  };

  const searchNorm = normalize(searchId);
  if (!searchNorm || searchNorm === '') return null;

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
  if (APP.mode !== 'all') {
    cards = cards.filter(c => c.sources.includes(APP.mode));
  }
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
  try { localStorage.setItem('trademark-quiz-known', JSON.stringify(APP.known)); } catch(e) {}
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('trademark-quiz-known');
    if (saved) APP.known = JSON.parse(saved);
  } catch(e) {}
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
    app.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div></div>';
    return;
  }

  if (APP.cards.length === 0) {
    app.innerHTML = `
      ${renderHeader()}
      ${renderModeTabs()}
      ${renderFilterBar()}
      <div class="empty-state">
        <p>${APP.filter === 'wrong' ? '틀린 카드가 없습니다.' : '카드가 없습니다.'}</p>
      </div>
    `;
    attachEvents();
    return;
  }

  const knownStatus = APP.known[card.key];
  const hasHint = card.두문자 || card.요약;
  const hasAnswer = card.문장 || card.상세;

  let statusClass = '';
  if (knownStatus === true) statusClass = 'known';
  else if (knownStatus === false) statusClass = 'unknown';

  app.innerHTML = `
    ${renderHeader()}
    ${renderModeTabs()}
    ${renderFilterBar()}
    <div class="progress-track">
      <div class="progress-fill" style="width:${((APP.idx + 1) / APP.cards.length * 100).toFixed(1)}%"></div>
    </div>
    <div class="card">
      <div class="card-inner">
        <div class="card-counter">
          <span class="card-idx">${APP.idx + 1} / ${APP.cards.length}</span>
          <span class="card-status ${statusClass}"></span>
        </div>

        <div class="card-title">${esc(card.조문번호)}</div>

        ${card.취지 ? `<div class="card-purpose">${esc(card.취지)}</div>` : ''}

        ${hasHint ? `
          <div class="reveal-zone hint-zone ${APP.hintShown ? 'visible' : ''}">
            <div class="zone-inner">
              <div class="zone-tag">Hint</div>
              ${card.두문자 ? `<div class="acronym-display">${esc(card.두문자)}</div>` : ''}
              ${card.요약 ? `<div class="summary-text">${esc(card.요약)}</div>` : ''}
            </div>
          </div>
        ` : ''}

        ${hasAnswer ? `
          <div class="reveal-zone answer-zone ${APP.answerShown ? 'visible' : ''}">
            <div class="zone-inner">
              <div class="zone-tag">Answer</div>
              ${card.문장 ? `<div class="answer-text">${esc(card.문장)}</div>` : ''}
              ${card.상세 && card.상세 !== card.문장 ? `
                ${card.문장 ? '<div class="answer-divider"></div>' : ''}
                <div class="answer-text">${esc(card.상세)}</div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <div style="flex:1"></div>
      </div>

      <div class="card-actions">
        ${renderActionButtons(hasHint, hasAnswer)}
      </div>
    </div>

    <div class="nav-row">
      <button class="nav-btn prev" onclick="goPrev()" ${APP.idx === 0 ? 'disabled' : ''}>←</button>
      <button class="nav-btn next" onclick="goNext()" ${APP.idx >= APP.cards.length - 1 ? 'disabled' : ''}>다음</button>
    </div>
  `;

  attachEvents();
}

function renderHeader() {
  const knownCount = Object.values(APP.known).filter(v => v === true).length;
  const wrongCount = Object.values(APP.known).filter(v => v === false).length;

  return `
    <div class="header">
      <div class="header-brand">
        <h1>상표법</h1>
        <span class="badge">2026</span>
      </div>
      <div class="header-stats">
        ${knownCount > 0 ? `<span class="stat-pill correct"><span class="dot"></span>${knownCount}</span>` : ''}
        ${wrongCount > 0 ? `<span class="stat-pill wrong"><span class="dot"></span>${wrongCount}</span>` : ''}
      </div>
      <div class="header-actions">
        <button class="icon-btn" onclick="shuffle()" title="셔플">⟳</button>
        <button class="icon-btn" onclick="if(confirm('진행상황을 초기화할까요?'))resetProgress()" title="초기화">✕</button>
      </div>
    </div>
  `;
}

function renderModeTabs() {
  const modes = [
    ['all', '전체'],
    ['간략', '조문'],
    ['두문자', '두문자'],
    ['문장', '문장'],
  ];
  return `
    <div class="mode-tabs">
      ${modes.map(([key, label]) =>
        `<button class="mode-tab ${APP.mode === key ? 'active' : ''}" data-mode="${key}">${label}</button>`
      ).join('')}
    </div>
  `;
}

function renderFilterBar() {
  const wrongCount = Object.values(APP.known).filter(v => v === false).length;
  return `
    <div class="filter-bar">
      <button class="filter-chip ${APP.filter === 'all' ? 'active' : ''}" data-filter="all">전체</button>
      ${wrongCount > 0 ? `<button class="filter-chip ${APP.filter === 'wrong' ? 'active' : ''}" data-filter="wrong">오답 ${wrongCount}</button>` : ''}
    </div>
  `;
}

function renderActionButtons(hasHint, hasAnswer) {
  let html = '';

  if (!APP.hintShown && hasHint) {
    html += `<button class="reveal-btn hint" id="btn-hint">힌트 보기</button>`;
  } else if (!APP.answerShown && hasAnswer) {
    html += `<button class="reveal-btn answer" id="btn-answer">정답 보기</button>`;
  }

  if (APP.answerShown || (!hasHint && !hasAnswer)) {
    html += `
      <div class="judge-row">
        <button class="judge-btn fail" onclick="markKnow(false)">모르겠음</button>
        <button class="judge-btn pass" onclick="markKnow(true)">알겠음</button>
      </div>
    `;
  }

  return html;
}

function attachEvents() {
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.mode = btn.dataset.mode;
      APP.idx = 0;
      resetReveal();
      applyFilters();
      render();
    });
  });

  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.filter = btn.dataset.filter;
      APP.idx = 0;
      resetReveal();
      applyFilters();
      render();
    });
  });

  const hintBtn = document.getElementById('btn-hint');
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      APP.hintShown = true;
      render();
    });
  }

  const answerBtn = document.getElementById('btn-answer');
  if (answerBtn) {
    answerBtn.addEventListener('click', () => {
      APP.answerShown = true;
      render();
    });
  }
}

function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// ===== Keyboard =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    const card = APP.cards[APP.idx];
    if (!card) return;
    if (!APP.hintShown && (card.두문자 || card.요약)) {
      APP.hintShown = true;
      render();
    } else if (!APP.answerShown && (card.문장 || card.상세)) {
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
let touchStartY = 0;
document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx > 0) goPrev();
    else goNext();
  }
}, { passive: true });

// ===== Init =====
loadData();
