// ===== 상표법 암기카드 =====

const APP = {
  data: null,
  cards: [],
  allCards: [],
  idx: 0,
  hintShown: false,
  answerShown: false,
  mode: 'all',
  shuffled: false,
};

// ===== Data Loading =====
async function loadData() {
  const resp = await fetch('data/상표법_암기자료.json');
  APP.data = await resp.json();
  buildCards();
  shuffle();
}

// ===== Build card list =====
function buildCards() {
  const d = APP.data;
  const cards = [];

  // 간략: each entry becomes 2 cards (의의/취지 + 요건), grouped as a pair
  for (const item of d.간략) {
    const pairId = 'pair-' + item.id;

    // Card 1: 의의/취지
    if (item.취지) {
      cards.push({
        key: item.id + '-취지',
        pairId,
        조문번호: item.id,
        문제유형: '의의/취지',
        두문자: '',
        정답: item.취지,
        sources: ['간략'],
      });
    }

    // Card 2: 요건
    if (item.요건) {
      cards.push({
        key: item.id + '-요건',
        pairId,
        조문번호: item.id,
        문제유형: '요건',
        두문자: item.두문자 || '',
        정답: item.요건,
        sources: ['간략'],
      });
    }
  }

  // 두문자: each entry is a single card
  for (const item of d.두문자) {
    cards.push({
      key: '두문자-' + item.id,
      pairId: null,
      조문번호: item.id,
      문제유형: '두문자',
      두문자: item.두문자,
      정답: item.상세,
      sources: ['두문자'],
    });
  }

  APP.allCards = cards;
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
  if (APP.mode === '간략') {
    cards = cards.filter(c => c.sources.includes('간략'));
  } else if (APP.mode === '두문자') {
    cards = cards.filter(c => c.sources.includes('두문자'));
  }
  APP.cards = cards;
  APP.idx = Math.min(APP.idx, Math.max(0, cards.length - 1));
}

// ===== Shuffle (pairs stay together) =====
function shuffle() {
  // Group cards into pairs and singles
  const pairs = [];
  const singles = [];
  const seenPairs = new Set();

  for (let i = 0; i < APP.cards.length; i++) {
    const card = APP.cards[i];
    if (card.pairId && !seenPairs.has(card.pairId)) {
      seenPairs.add(card.pairId);
      const pair = APP.cards.filter(c => c.pairId === card.pairId);
      // Sort: 의의/취지 first, then 요건
      pair.sort((a, b) => {
        if (a.문제유형 === '의의/취지') return -1;
        if (b.문제유형 === '의의/취지') return 1;
        return 0;
      });
      pairs.push(pair);
    } else if (!card.pairId) {
      singles.push([card]);
    }
  }

  // Shuffle groups
  const groups = [...pairs, ...singles];
  for (let i = groups.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [groups[i], groups[j]] = [groups[j], groups[i]];
  }

  // Flatten
  APP.cards = groups.flat();
  APP.shuffled = true;
  APP.idx = 0;
  resetReveal();
  render();
}

function resetReveal() {
  APP.hintShown = false;
  APP.answerShown = false;
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
      <div class="empty-state">
        <p>카드가 없습니다.</p>
      </div>
    `;
    attachEvents();
    return;
  }

  const hasHint = !!card.두문자;
  const hasAnswer = !!card.정답;

  // Question type badge color
  let typeBadge = '';
  if (card.문제유형 === '의의/취지') {
    typeBadge = '<span class="type-badge purpose">의의/취지</span>';
  } else if (card.문제유형 === '요건') {
    typeBadge = '<span class="type-badge requirement">요건</span>';
  } else if (card.문제유형 === '두문자') {
    typeBadge = '<span class="type-badge mnemonic">두문자</span>';
  }

  app.innerHTML = `
    ${renderHeader()}
    ${renderModeTabs()}
    <div class="progress-track">
      <div class="progress-fill" style="width:${((APP.idx + 1) / APP.cards.length * 100).toFixed(1)}%"></div>
    </div>
    <div class="card">
      <div class="card-inner">
        <div class="card-counter">
          <span class="card-idx">${APP.idx + 1} / ${APP.cards.length}</span>
          ${typeBadge}
        </div>

        <div class="card-title">${esc(card.조문번호)}</div>

        ${hasHint ? `
          <div class="reveal-zone hint-zone ${APP.hintShown ? 'visible' : ''}">
            <div class="zone-inner">
              <div class="zone-tag">Hint</div>
              <div class="acronym-display">${esc(card.두문자)}</div>
            </div>
          </div>
        ` : ''}

        ${hasAnswer ? `
          <div class="reveal-zone answer-zone ${APP.answerShown ? 'visible' : ''}">
            <div class="zone-inner">
              <div class="zone-tag">Answer</div>
              <div class="answer-text">${highlightAcronym(card.정답, card.두문자)}</div>
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
  return `
    <div class="header">
      <div class="header-brand">
        <h1>상표법</h1>
        <span class="badge">2026</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" onclick="shuffle()" title="셔플">⟳</button>
      </div>
    </div>
  `;
}

function renderModeTabs() {
  const modes = [
    ['all', '전체'],
    ['간략', '조문'],
    ['두문자', '두문자'],
  ];
  return `
    <div class="mode-tabs">
      ${modes.map(([key, label]) =>
        `<button class="mode-tab ${APP.mode === key ? 'active' : ''}" data-mode="${key}">${label}</button>`
      ).join('')}
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
  return html;
}

function attachEvents() {
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.mode = btn.dataset.mode;
      APP.idx = 0;
      resetReveal();
      applyFilters();
      shuffle();
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

function highlightAcronym(text, acronym) {
  if (!text || !acronym) return esc(text);
  const chars = acronym.replace(/[·\s·&/,()（）\d\-+\[\]]/g, '').split('');
  if (chars.length === 0) return esc(text);

  let result = '';
  let charIdx = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (charIdx < chars.length && c === chars[charIdx]) {
      result += `<mark class="hl">${esc(c)}</mark>`;
      charIdx++;
    } else if (c === '\n') {
      result += '<br>';
    } else {
      result += esc(c);
    }
  }
  return result;
}

// ===== Keyboard =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    const card = APP.cards[APP.idx];
    if (!card) return;
    if (!APP.hintShown && card.두문자) {
      APP.hintShown = true;
      render();
    } else if (!APP.answerShown && card.정답) {
      APP.answerShown = true;
      render();
    } else {
      goNext();
    }
  } else if (e.key === 'ArrowLeft') {
    goPrev();
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
