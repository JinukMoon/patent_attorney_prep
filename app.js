// ===== 변리사 암기카드 =====

const APP = {
  // Common
  subject: localStorage.getItem('subject') || '상표법', // '상표법' | '특허법'
  data: null,
  cards: [],
  allCards: [],
  idx: 0,
  shuffled: false,

  // 상표법 state
  hintShown: false,
  answerShown: false,
  mode: 'all', // 'all' | '간략' | '두문자'

  // 특허법 state
  patentCategory: 'all',
  revealedCount: 0, // how many fields revealed so far
};

// ===== Data Loading =====
async function loadData() {
  if (APP.subject === '상표법') {
    const resp = await fetch('data/상표법_암기자료.json');
    APP.data = await resp.json();
    buildTrademarkCards();
  } else {
    const resp = await fetch('data/특허법_암기자료.json');
    APP.data = await resp.json();
    buildPatentCards();
  }
  shuffle();
}

// ===== Switch subject =====
function switchSubject(subject) {
  if (APP.subject === subject) return;
  APP.subject = subject;
  localStorage.setItem('subject', subject);
  APP.data = null;
  APP.cards = [];
  APP.allCards = [];
  APP.idx = 0;
  APP.mode = 'all';
  APP.patentCategory = 'all';
  APP.revealedCount = 0;
  APP.hintShown = false;
  APP.answerShown = false;
  render(); // show loading
  loadData();
}

// ===== 상표법 cards =====
function buildTrademarkCards() {
  const d = APP.data;
  const cards = [];

  for (const item of d.간략) {
    const pairId = 'pair-' + item.id;
    if (item.취지) {
      cards.push({
        key: item.id + '-취지', pairId, 조문번호: item.id,
        문제유형: '의의/취지', 두문자: '', 정답: item.취지, sources: ['간략'],
      });
    }
    if (item.요건) {
      cards.push({
        key: item.id + '-요건', pairId, 조문번호: item.id,
        문제유형: '요건', 두문자: item.두문자 || '', 정답: item.요건, sources: ['간략'],
      });
    }
  }

  for (const item of d.두문자) {
    cards.push({
      key: '두문자-' + item.id, pairId: null, 조문번호: item.id,
      문제유형: '두문자', 두문자: item.두문자, 정답: item.상세, sources: ['두문자'],
    });
  }

  APP.allCards = cards;
  applyFilters();
}

// ===== 특허법 cards =====
// Each field of each 항목 becomes a separate card
// Cards from the same 항목 are grouped (pairId) so they appear in order
function buildPatentCards() {
  const d = APP.data;
  const cards = [];

  for (const item of d.항목) {
    const groupId = 'patent-' + item.id;
    for (let i = 0; i < item.fields.length; i++) {
      const field = item.fields[i];
      cards.push({
        key: item.id + '-' + field.label,
        groupId,
        groupIndex: i,
        groupTotal: item.fields.length,
        조문번호: item.id,
        카테고리: item.카테고리,
        fieldLabel: field.label,
        fieldContent: field.content,
      });
    }
  }

  APP.allCards = cards;
  applyFilters();
}

// ===== Filters =====
function applyFilters() {
  let cards = [...APP.allCards];

  if (APP.subject === '상표법') {
    if (APP.mode === '간략') {
      cards = cards.filter(c => c.sources.includes('간략'));
    } else if (APP.mode === '두문자') {
      cards = cards.filter(c => c.sources.includes('두문자'));
    }
  } else {
    if (APP.patentCategory !== 'all') {
      cards = cards.filter(c => c.카테고리 === APP.patentCategory);
    }
  }

  APP.cards = cards;
  APP.idx = Math.min(APP.idx, Math.max(0, cards.length - 1));
}

// ===== Shuffle =====
function shuffle() {
  if (APP.subject === '상표법') {
    shuffleTrademark();
  } else {
    shufflePatent();
  }
}

function shuffleTrademark() {
  const pairs = [];
  const singles = [];
  const seenPairs = new Set();

  for (const card of APP.cards) {
    if (card.pairId && !seenPairs.has(card.pairId)) {
      seenPairs.add(card.pairId);
      const pair = APP.cards.filter(c => c.pairId === card.pairId);
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

  const groups = [...pairs, ...singles];
  fisherYates(groups);
  APP.cards = groups.flat();
  APP.shuffled = true;
  APP.idx = 0;
  resetReveal();
  render();
}

function shufflePatent() {
  // Group cards by groupId (same 항목), keep field order within group
  const groupMap = new Map();
  const soloCards = [];

  for (const card of APP.cards) {
    if (card.groupId) {
      if (!groupMap.has(card.groupId)) groupMap.set(card.groupId, []);
      groupMap.get(card.groupId).push(card);
    } else {
      soloCards.push([card]);
    }
  }

  // Sort within each group by groupIndex
  const groups = [];
  for (const [, cards] of groupMap) {
    cards.sort((a, b) => a.groupIndex - b.groupIndex);
    groups.push(cards);
  }

  // Add solo cards
  groups.push(...soloCards);

  // Shuffle groups (항목 순서를 랜덤으로, 내부 field 순서는 유지)
  fisherYates(groups);

  APP.cards = groups.flat();
  APP.shuffled = true;
  APP.idx = 0;
  APP.revealedCount = 0;
  render();
}

function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function resetReveal() {
  APP.hintShown = false;
  APP.answerShown = false;
  APP.revealedCount = 0;
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

function revealNext() {
  if (APP.subject === '상표법') {
    revealNextTrademark();
  } else {
    APP.revealedCount++;
    render();
  }
}

function revealNextTrademark() {
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
}

// ===== Render =====
function render() {
  const app = document.getElementById('app');

  if (!APP.data) {
    app.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div></div>';
    return;
  }

  if (APP.subject === '상표법') {
    renderTrademark(app);
  } else {
    renderPatent(app);
  }
}

function renderTrademark(app) {
  const card = APP.cards[APP.idx];

  if (APP.cards.length === 0) {
    app.innerHTML = `${renderSubjectTabs()}${renderHeader()}${renderTrademarkModeTabs()}
      <div class="empty-state"><p>카드가 없습니다.</p></div>`;
    attachEvents();
    return;
  }

  const hasHint = !!card.두문자;
  const hasAnswer = !!card.정답;
  const titleSuffix = card.문제유형 !== '두문자' && card.문제유형 ? ` — ${card.문제유형}` : '';

  app.innerHTML = `
    ${renderSubjectTabs()}
    ${renderHeader()}
    ${renderTrademarkModeTabs()}
    <div class="progress-track">
      <div class="progress-fill" style="width:${((APP.idx + 1) / APP.cards.length * 100).toFixed(1)}%"></div>
    </div>
    <div class="card">
      <div class="card-inner">
        <div class="card-counter">
          <span class="card-idx">${APP.idx + 1} / ${APP.cards.length}</span>
          ${card.sources.includes('두문자') ? '<span class="type-badge mnemonic">두문자</span>' : '<span class="type-badge purpose">의의/취지/요건</span>'}
        </div>
        <div class="card-title">${esc(card.조문번호)}${esc(titleSuffix)}</div>
        ${hasHint ? `
          <div class="reveal-zone hint-zone ${APP.hintShown ? 'visible' : ''}">
            <div class="zone-inner">
              <div class="zone-tag">Hint</div>
              <div class="acronym-display">${esc(card.두문자)}</div>
            </div>
          </div>` : ''}
        ${hasAnswer ? `
          <div class="reveal-zone answer-zone ${APP.answerShown ? 'visible' : ''}">
            <div class="zone-inner">
              <div class="zone-tag">Answer</div>
              <div class="answer-text">${highlightAcronym(card.정답, card.두문자)}</div>
            </div>
          </div>` : ''}
        <div style="flex:1"></div>
      </div>
      <div class="card-actions">
        ${renderTrademarkActions(hasHint, hasAnswer)}
      </div>
    </div>
    ${renderNav()}
  `;
  attachEvents();
}

function renderPatent(app) {
  const card = APP.cards[APP.idx];

  if (APP.cards.length === 0) {
    app.innerHTML = `${renderSubjectTabs()}${renderHeader()}${renderPatentCategoryTabs()}
      <div class="empty-state"><p>카드가 없습니다.</p></div>`;
    attachEvents();
    return;
  }

  // Find all cards in the same group to show revealed ones
  const groupCards = card.groupId
    ? APP.cards.filter(c => c.groupId === card.groupId)
    : [card];
  const currentGroupIdx = groupCards.indexOf(card);

  // How many fields to show: current card's field is revealed when revealedCount >= 1
  const isRevealed = APP.revealedCount >= 1;

  app.innerHTML = `
    ${renderSubjectTabs()}
    ${renderHeader()}
    ${renderPatentCategoryTabs()}
    <div class="progress-track">
      <div class="progress-fill" style="width:${((APP.idx + 1) / APP.cards.length * 100).toFixed(1)}%"></div>
    </div>
    <div class="card">
      <div class="card-inner">
        <div class="card-counter">
          <span class="card-idx">${APP.idx + 1} / ${APP.cards.length}</span>
          <span class="type-badge category-badge">${esc(card.카테고리)}</span>
        </div>
        <div class="card-title">${esc(card.조문번호)}</div>
        <div class="field-label-question">${esc(card.fieldLabel)}</div>
        <div class="reveal-zone answer-zone ${isRevealed ? 'visible' : ''}">
          <div class="zone-inner">
            <div class="zone-tag">${esc(card.fieldLabel)}</div>
            <div class="answer-text">${esc(card.fieldContent)}</div>
          </div>
        </div>
        <div class="field-progress">
          ${groupCards.map((gc, i) => {
            const isCurrent = gc === card;
            const isPast = groupCards.indexOf(gc) < currentGroupIdx;
            const cls = isCurrent ? (isRevealed ? 'done' : 'current') : (isPast ? 'done' : '');
            return `<span class="field-dot ${cls}" title="${esc(gc.fieldLabel)}"></span>`;
          }).join('')}
        </div>
        <div style="flex:1"></div>
      </div>
      <div class="card-actions">
        ${!isRevealed ? '<button class="reveal-btn answer" id="btn-reveal">정답 보기</button>' : ''}
      </div>
    </div>
    ${renderNav()}
  `;
  attachEvents();
}

// ===== Shared render helpers =====
function renderSubjectTabs() {
  const subjects = [['상표법', '상표법'], ['특허법', '특허법']];
  return `
    <div class="subject-tabs">
      ${subjects.map(([key, label]) =>
        `<button class="subject-tab ${APP.subject === key ? 'active' : ''}" data-subject="${key}">${label}</button>`
      ).join('')}
    </div>
  `;
}

function renderHeader() {
  return `
    <div class="header">
      <div class="header-brand">
        <h1>변리사 암기카드</h1>
        <span class="badge">2026</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" onclick="shuffle()" title="셔플">⟳</button>
      </div>
    </div>
  `;
}

function renderTrademarkModeTabs() {
  const modes = [['all', '전체'], ['간략', '조문'], ['두문자', '두문자']];
  return `
    <div class="mode-tabs">
      ${modes.map(([key, label]) =>
        `<button class="mode-tab ${APP.mode === key ? 'active' : ''}" data-mode="${key}">${label}</button>`
      ).join('')}
    </div>
  `;
}

function renderPatentCategoryTabs() {
  const cats = [
    ['all', '전체'],
    ['특허요건', '특허요건'],
    ['출원/이익제도', '출원/이익'],
    ['특허권&실시권', '특허권/실시권'],
    ['특허침해 및 구제', '침해/구제'],
    ['특유쟁점', '특유쟁점'],
    ['특허심판 및 심결취소소송', '심판/소송'],
    ['PCT 제도', 'PCT'],
  ];
  return `
    <div class="mode-tabs patent-cats">
      ${cats.map(([key, label]) =>
        `<button class="mode-tab ${APP.patentCategory === key ? 'active' : ''}" data-patcat="${key}">${label}</button>`
      ).join('')}
    </div>
  `;
}

function renderNav() {
  return `
    <div class="nav-row">
      <button class="nav-btn prev" onclick="goPrev()" ${APP.idx === 0 ? 'disabled' : ''}>←</button>
      <button class="nav-btn next" onclick="goNext()" ${APP.idx >= APP.cards.length - 1 ? 'disabled' : ''}>다음</button>
    </div>
  `;
}

function renderTrademarkActions(hasHint, hasAnswer) {
  if (!APP.hintShown && hasHint) {
    return '<button class="reveal-btn hint" id="btn-hint">힌트 보기</button>';
  } else if (!APP.answerShown && hasAnswer) {
    return '<button class="reveal-btn answer" id="btn-answer">정답 보기</button>';
  }
  return '';
}

// ===== Events =====
function attachEvents() {
  // Subject tabs
  document.querySelectorAll('.subject-tab').forEach(btn => {
    btn.addEventListener('click', () => switchSubject(btn.dataset.subject));
  });

  // 상표법 mode tabs
  document.querySelectorAll('.mode-tab[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.mode = btn.dataset.mode;
      APP.idx = 0;
      resetReveal();
      applyFilters();
      shuffle();
    });
  });

  // 특허법 category tabs
  document.querySelectorAll('.mode-tab[data-patcat]').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.patentCategory = btn.dataset.patcat;
      APP.idx = 0;
      resetReveal();
      applyFilters();
      shuffle();
    });
  });

  // Reveal buttons
  const hintBtn = document.getElementById('btn-hint');
  if (hintBtn) hintBtn.addEventListener('click', () => { APP.hintShown = true; render(); });

  const answerBtn = document.getElementById('btn-answer');
  if (answerBtn) answerBtn.addEventListener('click', () => { APP.answerShown = true; render(); });

  const revealBtn = document.getElementById('btn-reveal');
  if (revealBtn) revealBtn.addEventListener('click', () => { APP.revealedCount++; render(); });
}

// ===== Utilities =====
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

    if (APP.subject === '상표법') {
      revealNextTrademark();
    } else {
      if (APP.revealedCount < 1) {
        APP.revealedCount++;
        render();
      } else {
        goNext();
      }
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
