const STORAGE_KEY = 'ledger-v1';
const CATEGORIES = {
  expense: ['식비', '교통', '주거/통신', '쇼핑', '문화/여가', '기타'],
  income: ['급여', '용돈', '기타수입'],
};

const $ = (id) => document.getElementById(id);
const el = {
  toggle: $('sidebarToggle'), toggleLabel: $('toggleLabel'), panel: $('monthPanel'),
  monthForm: $('monthAddForm'), newMonth: $('newMonth'), monthList: $('monthList'),
  title: $('mainTitle'), deleteMonth: $('deleteMonthBtn'),
  sumIncome: $('sumIncome'), sumExpense: $('sumExpense'), sumBalance: $('sumBalance'),
  form: $('entryForm'), date: $('fDate'), cat: $('fCat'), memo: $('fMemo'), amount: $('fAmount'),
  submit: $('submitBtn'), cancel: $('cancelBtn'), txList: $('txList'),
  typeBtns: document.querySelectorAll('.type-btn'),
  memoSection: $('memoSection'), blockList: $('blockList'),
};

const BLOCK_TYPES = { p: '문단', h: '제목', ul: '목록', todo: '체크' };
const BLOCK_PLACEHOLDER = {
  p: '이번 달 메모를 적어 보세요',
  h: '제목',
  ul: '목록',
  todo: '할 일 (예: 월세 이체)',
};

// ---------- 데이터 ----------
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.months)) return data;
  } catch (e) { /* 저장소를 못 읽으면 새로 시작 */ }
  return { months: [], currentId: null };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.');
  }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const won = (n) => n.toLocaleString('ko-KR') + '원';
const ymLabel = (ym) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`;
const thisMonth = () => today().slice(0, 7);
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const state = load();
let formType = 'expense';
let editingId = null;

const currentMonth = () => state.months.find((m) => m.id === state.currentId);
const monthTotals = (m) => {
  let income = 0, expense = 0;
  m.entries.forEach((e) => (e.type === 'income' ? (income += e.amount) : (expense += e.amount)));
  return { income, expense };
};

// ---------- 월 ----------
function addMonth(ym) {
  let m = state.months.find((x) => x.ym === ym);
  if (!m) {
    m = { id: uid(), ym, entries: [], blocks: [] };
    state.months.push(m);
    state.months.sort((a, b) => b.ym.localeCompare(a.ym));
  }
  state.currentId = m.id;
  resetForm();
  save();
  render();
}

function deleteMonth() {
  const m = currentMonth();
  if (!m) return;
  if (!confirm(`${ymLabel(m.ym)}의 내역 ${m.entries.length}건이 모두 삭제됩니다. 계속할까요?`)) return;
  state.months = state.months.filter((x) => x.id !== m.id);
  state.currentId = state.months.length ? state.months[0].id : null;
  resetForm();
  save();
  render();
}

// ---------- 내역 폼 ----------
function setType(type) {
  formType = type;
  el.typeBtns.forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  el.cat.replaceChildren(...CATEGORIES[type].map((c) => new Option(c, c)));
}

function resetForm() {
  editingId = null;
  setType('expense');
  el.form.reset();
  el.date.value = defaultDate();
  el.submit.textContent = '추가';
  el.cancel.hidden = true;
}

function defaultDate() {
  const m = currentMonth();
  const t = today();
  return m && t.slice(0, 7) !== m.ym ? m.ym + '-01' : t;
}

function startEdit(entry) {
  editingId = entry.id;
  setType(entry.type);
  el.date.value = entry.date;
  el.cat.value = entry.cat;
  el.memo.value = entry.memo;
  el.amount.value = entry.amount;
  el.submit.textContent = '수정 완료';
  el.cancel.hidden = false;
  el.memo.focus();
  render();
}

function onSubmit(ev) {
  ev.preventDefault();
  const m = currentMonth();
  if (!m) return;
  const amount = Math.round(Number(el.amount.value));
  if (!(amount > 0) || !el.date.value) return;

  const data = {
    type: formType, date: el.date.value, cat: el.cat.value,
    memo: el.memo.value.trim(), amount,
  };

  if (editingId) {
    Object.assign(m.entries.find((e) => e.id === editingId), data);
  } else {
    m.entries.push({ id: uid(), ...data });
  }
  // 날짜를 다른 달로 바꾸면 그 달로 옮긴다
  const ym = data.date.slice(0, 7);
  if (ym !== m.ym) moveEntries(m, ym);

  resetForm();
  save();
  render();
}

function moveEntries(from, ym) {
  const moving = from.entries.filter((e) => e.date.slice(0, 7) === ym);
  from.entries = from.entries.filter((e) => e.date.slice(0, 7) !== ym);
  let to = state.months.find((x) => x.ym === ym);
  if (!to) {
    to = { id: uid(), ym, entries: [], blocks: [] };
    state.months.push(to);
    state.months.sort((a, b) => b.ym.localeCompare(a.ym));
  }
  to.entries.push(...moving);
  state.currentId = to.id;
}

function deleteEntry(id) {
  const m = currentMonth();
  m.entries = m.entries.filter((e) => e.id !== id);
  if (editingId === id) resetForm();
  save();
  render();
}

// ---------- 화면 ----------
function render() {
  renderMonths();
  const m = currentMonth();
  const has = Boolean(m);

  el.title.textContent = has ? ymLabel(m.ym) : '월을 추가해 주세요';
  el.toggleLabel.textContent = has ? ymLabel(m.ym) : '월 선택';
  el.deleteMonth.hidden = !has;
  [...el.form.elements].forEach((c) => (c.disabled = !has));

  const { income, expense } = has ? monthTotals(m) : { income: 0, expense: 0 };
  el.sumIncome.textContent = won(income);
  el.sumExpense.textContent = won(expense);
  el.sumBalance.textContent = won(income - expense);

  renderEntries(has ? m : null);
  renderBlocks(has ? m : null);
  renderReport(has ? m : null);
  renderGoal();
}

// ---------- 올해 목표 저축 ----------
// 끝난 달(이번 달 이전)의 수입 − 지출을 올해 저축액으로 자동 합산한다.
function renderGoal() {
  const year = today().slice(0, 4);
  const cur = thisMonth();
  const goal = (state.yearGoals && state.yearGoals[year]) || 0;
  const done = state.months.filter((m) => m.ym.startsWith(year) && m.ym < cur);
  const saved = done.reduce((s, m) => { const t = monthTotals(m); return s + t.income - t.expense; }, 0);
  const signed = (n) => (n > 0 ? '+' : '') + won(n);

  $('goalTitle').textContent = `${year}년 목표 저축`;
  const input = $('goalInput');
  if (document.activeElement !== input) input.value = goal ? goal.toLocaleString('ko-KR') : '';

  const p = goal > 0 ? (saved / goal) * 100 : null;
  $('goalFill').style.width = p === null ? '0%' : Math.min(100, Math.max(0, p)) + '%';
  $('goalFill').classList.toggle('reached', p !== null && p >= 100);
  $('goalPct').textContent = p === null ? '목표 금액을 입력해 보세요' : p >= 100 ? `${pct(p)} · 목표 달성!` : `목표의 ${pct(p)} 저축`;
  $('goalSaved').textContent = `지금까지 저축 ${signed(saved)} (끝난 ${done.length}개월)`;

  const remainEl = $('goalRemain');
  if (p === null) {
    remainEl.textContent = '';
  } else if (saved >= goal) {
    remainEl.textContent = `목표보다 ${won(saved - goal)} 더 모았어요`;
  } else {
    const left = goal - saved;
    const monthsLeft = 12 - Number(cur.slice(5)) + 1; // 이번 달 포함
    remainEl.textContent = year === cur.slice(0, 4)
      ? `남은 ${won(left)} · 남은 ${monthsLeft}개월 동안 월 ${won(Math.ceil(left / monthsLeft))}씩`
      : `남은 금액 ${won(left)}`;
  }

  const now = state.months.find((m) => m.ym === cur);
  if (now) {
    const t = monthTotals(now);
    $('goalHint').textContent = `이번 달 현재 잔액 ${signed(t.income - t.expense)}은 월이 끝나면 반영돼요.`;
  } else {
    $('goalHint').textContent = '월이 끝나면 그 달의 남은 금액(수입 − 지출)이 자동으로 더해져요.';
  }
}

// ---------- 월 메모 (블록 에디터) ----------
const newBlock = (type = 'p', text = '') => ({ id: uid(), type, text, done: false });

function renderBlocks(m) {
  closeSlash();
  el.memoSection.hidden = !m;
  if (!m) return;
  if (!Array.isArray(m.blocks) || !m.blocks.length) m.blocks = [newBlock()];
  el.blockList.replaceChildren(...m.blocks.map((b) => makeBlock(m, b)));
  el.blockList.querySelectorAll('.block-text').forEach(autosize);
}

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function focusBlock(id, atStart) {
  const ta = el.blockList.querySelector(`textarea[data-id="${id}"]`);
  if (!ta) return;
  ta.focus();
  const pos = atStart ? 0 : ta.value.length;
  ta.setSelectionRange(pos, pos);
}

// 한글 조합 중(또는 막 끝난 직후)의 Enter는 글자 확정용이므로 동작을 실행하지 않는다.
// 브라우저에 따라 compositionend가 keydown보다 먼저 와서 isComposing이 false가 되기도 해서 시간 여유를 둔다.
let imeActive = false;
let imeEndedAt = 0;
document.addEventListener('compositionstart', () => { imeActive = true; }, true);
document.addEventListener('compositionend', () => { imeActive = false; imeEndedAt = performance.now(); }, true);
const composing = (ev) =>
  ev.isComposing || ev.keyCode === 229 || imeActive || performance.now() - imeEndedAt < 50;

// 빈 블록에서 "/" → 블록 종류 메뉴
const SLASH_ITEMS = [
  { type: 'p', label: '문단', desc: '자유롭게 적는 메모' },
  { type: 'h', label: '제목', desc: '구역 나누기 (예: 고정지출)' },
  { type: 'ul', label: '목록', desc: '지출·수입 항목 나열' },
  { type: 'todo', label: '체크리스트', desc: '납부 확인 (월세, 통신비)' },
];
let slash = null; // { menu, rows, index, m, b }

function closeSlash() {
  if (!slash) return;
  slash.menu.remove();
  slash = null;
}

function setSlashIndex(index) {
  slash.index = (index + SLASH_ITEMS.length) % SLASH_ITEMS.length;
  slash.rows.forEach((r, i) => {
    r.classList.toggle('active', i === slash.index);
    r.setAttribute('aria-selected', String(i === slash.index));
  });
  slash.rows[slash.index].scrollIntoView({ block: 'nearest' });
}

function pickSlash(index) {
  const { m, b } = slash;
  closeSlash();
  b.type = SLASH_ITEMS[index].type;
  if (b.type !== 'todo') b.done = false;
  save();
  renderBlocks(m);
  focusBlock(b.id);
}

function openSlash(m, b, row) {
  closeSlash();
  const menu = document.createElement('div');
  menu.className = 'slash-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', '블록 종류');
  const rows = SLASH_ITEMS.map((item, i) => {
    const r = document.createElement('div');
    r.className = 'slash-item';
    r.setAttribute('role', 'option');
    const label = document.createElement('strong');
    label.textContent = item.label;
    const desc = document.createElement('span');
    desc.textContent = item.desc;
    r.append(label, desc);
    r.addEventListener('mousedown', (ev) => ev.preventDefault()); // 입력 포커스 유지
    r.addEventListener('click', () => pickSlash(i));
    r.addEventListener('mousemove', () => slash && slash.index !== i && setSlashIndex(i));
    menu.append(r);
    return r;
  });
  row.append(menu);
  slash = { menu, rows, index: 0, m, b };
  setSlashIndex(0);
}

function makeBlock(m, b) {
  const row = document.createElement('div');
  row.className = `block block-${b.type}` + (b.type === 'todo' && b.done ? ' done' : '');

  const sel = document.createElement('select');
  sel.className = 'block-type';
  sel.setAttribute('aria-label', '블록 종류');
  Object.entries(BLOCK_TYPES).forEach(([v, label]) => sel.append(new Option(label, v)));
  sel.value = b.type;
  sel.addEventListener('change', () => {
    b.type = sel.value;
    save();
    renderBlocks(m);
    focusBlock(b.id);
  });
  row.append(sel);

  if (b.type === 'ul' || b.type === 'todo') {
    const marker = document.createElement('span');
    marker.className = 'block-marker';
    if (b.type === 'ul') {
      marker.textContent = '•';
    } else {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = b.done;
      cb.setAttribute('aria-label', '완료');
      cb.addEventListener('change', () => {
        b.done = cb.checked;
        row.classList.toggle('done', b.done);
        save();
      });
      marker.append(cb);
    }
    row.append(marker);
  }

  const ta = document.createElement('textarea');
  ta.className = 'block-text';
  ta.rows = 1;
  ta.value = b.text;
  ta.dataset.id = b.id;
  ta.placeholder = BLOCK_PLACEHOLDER[b.type];
  ta.addEventListener('input', () => {
    // 마크다운 단축: "# ", "- ", "[] " (한글 입력 중에는 건드리지 않음)
    const shortcut = b.type === 'p' && ta.value.match(/^(#|-|\*|\[\]) /);
    if (shortcut) {
      b.type = shortcut[1] === '#' ? 'h' : shortcut[1] === '[]' ? 'todo' : 'ul';
      b.text = ta.value.slice(shortcut[0].length);
      save();
      renderBlocks(m);
      focusBlock(b.id);
      return;
    }
    b.text = ta.value;
    autosize(ta);
    save();
  });
  ta.addEventListener('keydown', (ev) => {
    if (composing(ev)) return;
    const i = m.blocks.indexOf(b);

    if (slash && slash.b === b) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); setSlashIndex(slash.index + 1); return; }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); setSlashIndex(slash.index - 1); return; }
      if (ev.key === 'Enter') { ev.preventDefault(); pickSlash(slash.index); return; }
      if (ev.key === 'Escape' || ev.key === 'Backspace') { ev.preventDefault(); closeSlash(); return; }
      if (ev.key !== 'Shift' && ev.key !== 'Control' && ev.key !== 'Alt' && ev.key !== 'Meta') closeSlash();
    }

    if (ev.key === '/' && b.text === '' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      ev.preventDefault();
      openSlash(m, b, row);
      return;
    }

    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      const pos = ta.selectionStart;
      const rest = b.text.slice(pos);
      b.text = b.text.slice(0, pos);
      const nb = newBlock(b.type === 'ul' || b.type === 'todo' ? b.type : 'p', rest);
      m.blocks.splice(i + 1, 0, nb);
      save();
      renderBlocks(m);
      focusBlock(nb.id, true);
    } else if (ev.key === 'Backspace' && b.text === '') {
      ev.preventDefault();
      if (m.blocks.length === 1) {
        // 마지막 남은 블록은 지우지 않고 빈 문단으로
        if (b.type !== 'p') { b.type = 'p'; b.done = false; save(); renderBlocks(m); focusBlock(b.id); }
        return;
      }
      m.blocks.splice(i, 1);
      save();
      renderBlocks(m);
      const target = m.blocks[i - 1] || m.blocks[i];
      focusBlock(target.id, i === 0);
    } else if (ev.key === 'ArrowUp' && ta.selectionStart === 0 && i > 0) {
      ev.preventDefault();
      focusBlock(m.blocks[i - 1].id);
    } else if (ev.key === 'ArrowDown' && ta.selectionStart === ta.value.length && i < m.blocks.length - 1) {
      ev.preventDefault();
      focusBlock(m.blocks[i + 1].id, true);
    }
  });
  ta.addEventListener('blur', () => { if (slash && slash.b === b) closeSlash(); });
  row.append(ta);
  return row;
}

function renderMonths() {
  el.monthList.replaceChildren(...state.months.map((m) => {
    const { income, expense } = monthTotals(m);
    const net = income - expense;
    const li = document.createElement('li');
    li.className = 'month-item' + (m.id === state.currentId ? ' active' : '');
    const name = document.createElement('span');
    name.className = 'month-name';
    name.textContent = ymLabel(m.ym);
    const sum = document.createElement('span');
    sum.className = 'month-sum ' + (net < 0 ? 'expense' : net > 0 ? 'income' : '');
    sum.textContent = (net > 0 ? '+' : '') + won(net);
    li.append(name, sum);
    li.addEventListener('click', () => {
      state.currentId = m.id;
      resetForm();
      save();
      render();
      el.panel.classList.remove('open');
      el.toggle.setAttribute('aria-expanded', 'false');
    });
    return li;
  }));
}

function renderEntries(m) {
  if (!m || !m.entries.length) {
    const li = document.createElement('li');
    li.className = 'tx-empty';
    li.textContent = m ? '아직 내역이 없어요. 위에서 첫 내역을 추가해 보세요.' : '왼쪽에서 월을 추가하면 시작할 수 있어요.';
    el.txList.replaceChildren(li);
    return;
  }
  const sorted = [...m.entries].sort((a, b) => b.date.localeCompare(a.date));
  el.txList.replaceChildren(...sorted.map((e) => {
    const li = document.createElement('li');
    li.className = 'tx' + (e.id === editingId ? ' editing' : '');

    const cat = document.createElement('span');
    cat.className = 'tx-cat' + (e.type === 'income' ? ' income-cat' : '');
    cat.textContent = e.cat;

    const info = document.createElement('span');
    info.className = 'tx-info';
    const memo = document.createElement('span');
    memo.className = 'tx-memo';
    memo.textContent = e.memo || '(메모 없음)';
    const date = document.createElement('span');
    date.className = 'tx-date';
    date.textContent = `${Number(e.date.slice(5, 7))}월 ${Number(e.date.slice(8))}일`;
    info.append(memo, date);

    const amt = document.createElement('span');
    amt.className = 'tx-amount ' + e.type;
    amt.textContent = (e.type === 'income' ? '+' : '-') + won(e.amount);

    const actions = document.createElement('span');
    actions.className = 'tx-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'tx-btn';
    edit.textContent = '수정';
    edit.addEventListener('click', () => startEdit(e));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'tx-btn del';
    del.textContent = '삭제';
    del.addEventListener('click', () => deleteEntry(e.id));
    actions.append(edit, del);

    li.append(cat, info, amt, actions);
    return li;
  }));
}

// ---------- 월 결산 · 소비 피드백 ----------
// 외부 AI를 호출하지 않고, 입력된 내역만으로 계산한 규칙 기반 분석이다.
const FIXED_CATS = ['주거/통신'];
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const pct = (n) => `${Math.round(n * 10) / 10}%`;

function prevYm(ym) {
  const [y, mo] = ym.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function expenseByCat(m) {
  const by = {};
  m.entries.forEach((e) => { if (e.type === 'expense') by[e.cat] = (by[e.cat] || 0) + e.amount; });
  return by;
}

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function analyze(m) {
  const { income, expense } = monthTotals(m);
  const saved = income - expense;
  const goal = state.goalRate ?? 20;
  const byCat = expenseByCat(m);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const prev = state.months.find((x) => x.ym === prevYm(m.ym));
  const prevBy = prev ? expenseByCat(prev) : null;
  const expenses = m.entries.filter((e) => e.type === 'expense');
  const biggest = expenses.reduce((a, e) => (!a || e.amount > a.amount ? e : a), null);
  const byDay = Array(7).fill(0);
  expenses.forEach((e) => { byDay[new Date(e.date + 'T00:00:00').getDay()] += e.amount; });
  return {
    income, expense, saved, goal, cats, byCat, prev, prevBy, expenses, biggest, byDay,
    spendRate: income > 0 ? (expense / income) * 100 : null,
    saveRate: income > 0 ? (saved / income) * 100 : null,
  };
}

function buildFeedback(a, status) {
  const out = [];
  const add = (tone, text) => out.push({ tone, text });

  if (status === 'ongoing') add('tip', '아직 진행 중인 달이라 지금까지의 내역 기준이에요. 월말에 다시 확인하면 정확해요.');

  if (a.income <= 0) {
    add('warn', '수입 내역이 없어 수입 대비 비율과 저축률을 계산할 수 없어요. 급여 등 수입을 입력해 보세요.');
  } else {
    const summary = `수입의 ${pct(a.spendRate)}를 사용했고, ${won(Math.abs(a.saved))}을 ${a.saved >= 0 ? '저축했어요' : '초과 지출했어요 (적자)'}.`;
    add(a.saveRate >= a.goal ? 'good' : a.saveRate >= 0 ? 'warn' : 'bad', summary);

    if (a.saveRate >= a.goal) {
      add('good', `목표 저축률 ${a.goal}%를 ${won(Math.round(a.saved - (a.income * a.goal) / 100))} 초과 달성했어요.`);
    } else {
      const need = Math.ceil(a.expense - (a.income * (100 - a.goal)) / 100);
      add('warn', `목표 저축률 ${a.goal}%를 맞추려면 지출을 ${won(need)} 줄여야 해요.`);
      let remain = need;
      const plan = [];
      a.cats.filter(([c]) => !FIXED_CATS.includes(c)).forEach(([c, amt]) => {
        if (remain <= 0) return;
        const cut = Math.min(remain, Math.floor(amt * 0.3));
        if (cut <= 0) return;
        plan.push(`${c} ${won(cut)} (${pct((cut / amt) * 100)} 절약)`);
        remain -= cut;
      });
      if (plan.length) add('tip', `줄이기 쉬운 변동비부터 보면: ${plan.join(', ')}.`);
      if (remain > 0) add('tip', `변동비를 30%씩 줄여도 ${won(remain)}이 모자라요. 월세·통신비 같은 고정비(요금제, 구독)도 점검해 보세요.`);
    }
  }

  if (a.cats.length) {
    const [top, topAmt] = a.cats[0];
    const share = (topAmt / a.expense) * 100;
    add('bad',
      `가장 큰 지출은 ${top}(${won(topAmt)})으로 전체 지출의 ${pct(share)}예요.${share >= 40 && !FIXED_CATS.includes(top) ? ' 한 항목에 쏠려 있어요.' : ''}`);
  }

  if (a.prevBy) {
    const prevTotal = Object.values(a.prevBy).reduce((s, v) => s + v, 0);
    if (prevTotal > 0 && a.expense > 0) {
      const d = a.expense - prevTotal;
      add(d > 0 ? 'warn' : 'good', `총지출이 전월보다 ${won(Math.abs(d))} ${d > 0 ? '늘었어요' : '줄었어요'} (${d > 0 ? '+' : '-'}${pct((Math.abs(d) / prevTotal) * 100)}).`);
    }
    a.cats.forEach(([c, amt]) => {
      const p = a.prevBy[c] || 0;
      const d = amt - p;
      if (d >= 30000 && (p === 0 || d / p >= 0.2)) add('warn', `${c}가 전월보다 ${won(d)} 늘었어요${p ? ` (+${pct((d / p) * 100)})` : ' (이번 달 새로 생김)'}.`);
    });
    Object.entries(a.prevBy).forEach(([c, p]) => {
      const d = p - (a.byCat[c] || 0);
      if (d >= 30000 && d / p >= 0.2) add('good', `${c}를 전월보다 ${won(d)} 아꼈어요.`);
    });
  }

  if (a.expenses.length >= 5 && a.expense > 0) {
    const maxDay = a.byDay.indexOf(Math.max(...a.byDay));
    const share = (a.byDay[maxDay] / a.expense) * 100;
    if (share >= 35) add('tip', `지출의 ${pct(share)}가 ${DAY_NAMES[maxDay]}요일에 몰려 있어요. 그날의 소비 습관을 살펴보세요.`);
  }
  if (a.biggest && a.expense > 0 && a.biggest.amount >= 50000 && a.biggest.amount / a.expense >= 0.3 && a.expenses.length > 1) {
    add('tip', `'${a.biggest.memo || a.biggest.cat}' 한 건(${won(a.biggest.amount)})이 지출의 ${pct((a.biggest.amount / a.expense) * 100)}를 차지해요.`);
  }
  return out;
}

function renderReport(m) {
  const sec = $('reportSection');
  sec.hidden = !m;
  if (!m) return;

  const cur = thisMonth();
  const status = m.ym < cur ? 'done' : m.ym === cur ? 'ongoing' : 'future';
  const badge = $('reportBadge');
  badge.textContent = status === 'done' ? '결산' : status === 'ongoing' ? '진행 중 · 중간 점검' : '예정';
  badge.className = 'report-badge ' + status;

  const body = $('reportBody');
  if (!m.entries.length) {
    body.replaceChildren(h('p', 'report-empty', '내역이 쌓이면 수입 대비 지출 비율, 저축액, 절약 팁을 분석해 드려요.'));
    return;
  }

  const a = analyze(m);
  const parts = [];

  // 핵심 수치
  const stats = h('div', 'report-stats');
  const stat = (label, value, cls) => {
    const c = h('div', 'stat');
    c.append(h('span', 'stat-label', label), h('strong', 'stat-value ' + (cls || ''), value));
    return c;
  };
  stats.append(
    stat('수입 대비 지출', a.spendRate === null ? '-' : pct(a.spendRate)),
    stat('저축액', (a.saved > 0 ? '+' : '') + won(a.saved), a.saved >= 0 ? 'income' : 'expense'),
    stat('저축률', a.saveRate === null ? '-' : pct(a.saveRate), a.saveRate !== null && a.saveRate >= a.goal ? 'income' : ''),
  );
  parts.push(stats);

  // 목표 저축률 설정
  const goalRow = h('label', 'goal-row', '목표 저축률 ');
  const goalInput = document.createElement('input');
  goalInput.type = 'number';
  goalInput.min = '0';
  goalInput.max = '90';
  goalInput.value = a.goal;
  goalInput.addEventListener('change', () => {
    const v = Math.min(90, Math.max(0, Math.round(Number(goalInput.value) || 0)));
    state.goalRate = v;
    save();
    renderReport(m);
  });
  goalRow.append(goalInput, document.createTextNode(' %'));
  parts.push(goalRow);

  // 수입 대비 지출 막대
  if (a.income > 0) {
    const bar = h('div', 'usage-bar');
    const fill = h('div', 'usage-fill' + (a.spendRate > 100 ? ' over' : ''));
    fill.style.width = Math.min(100, a.spendRate) + '%';
    const goalLine = h('div', 'usage-goal');
    goalLine.style.left = 100 - a.goal + '%';
    goalLine.title = `목표 지출선 (수입의 ${100 - a.goal}%)`;
    bar.append(fill, goalLine);
    parts.push(bar, h('p', 'usage-caption', `세로선은 목표 저축률 ${a.goal}%에 맞는 지출 한도(수입의 ${100 - a.goal}%)예요.`));
  }

  // 카테고리별 지출
  if (a.cats.length) {
    const wrap = h('div', 'cat-report');
    wrap.append(h('h4', '', '카테고리별 지출'));
    a.cats.forEach(([c, amt], idx) => {
      const row = h('div', 'cat-row' + (idx === 0 ? ' top' : ''));
      const head = h('div', 'cat-head');
      head.append(h('span', 'cat-name', c), h('span', 'cat-amt', won(amt)));
      const meta = [`지출의 ${pct((amt / a.expense) * 100)}`];
      if (a.income > 0) meta.push(`수입의 ${pct((amt / a.income) * 100)}`);
      if (a.prevBy) {
        const p = a.prevBy[c] || 0;
        const d = amt - p;
        if (d !== 0) meta.push(`전월 ${d > 0 ? '▲' : '▼'} ${won(Math.abs(d))}`);
      }
      const track = h('div', 'cat-track');
      const fill = h('div', 'cat-fill');
      fill.style.width = (amt / a.cats[0][1]) * 100 + '%';
      track.append(fill);
      row.append(head, track, h('span', 'cat-meta', meta.join(' · ')));
      wrap.append(row);
    });
    parts.push(wrap);
  }

  // 피드백
  const fb = h('div', 'feedback');
  fb.append(h('h4', '', '이번 달 피드백'));
  const ul = h('ul', 'feedback-list');
  buildFeedback(a, status).forEach(({ tone, text }) => ul.append(h('li', 'fb-' + tone, text)));
  fb.append(ul, h('p', 'report-note', '입력한 내역으로 계산한 자동 분석이에요. 저축액은 수입 − 지출로 계산하며, 외부 AI 서비스는 사용하지 않아요.'));
  parts.push(fb);

  body.replaceChildren(...parts);
}

// ---------- 이벤트 ----------
el.toggle.addEventListener('click', () => {
  const open = el.panel.classList.toggle('open');
  el.toggle.setAttribute('aria-expanded', String(open));
});
el.monthForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (el.newMonth.value) addMonth(el.newMonth.value);
});
el.deleteMonth.addEventListener('click', deleteMonth);
// 입력하는 동안 3자리마다 쉼표를 넣는다 (커서 위치는 숫자 기준으로 유지)
$('goalInput').addEventListener('input', (ev) => {
  const input = ev.target;
  const digitsBefore = input.value.slice(0, input.selectionStart).replace(/\D/g, '').length;
  const digits = input.value.replace(/\D/g, '').slice(0, 13);
  input.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
  let pos = 0;
  for (let seen = 0; pos < input.value.length && seen < digitsBefore; pos++) {
    if (/\d/.test(input.value[pos])) seen++;
  }
  input.setSelectionRange(pos, pos);
});
$('goalInput').addEventListener('change', (ev) => {
  const v = Number(ev.target.value.replace(/\D/g, '')) || 0;
  (state.yearGoals = state.yearGoals || {})[today().slice(0, 4)] = v;
  save();
  renderGoal();
});
el.typeBtns.forEach((b) => b.addEventListener('click', () => setType(b.dataset.type)));
el.form.addEventListener('submit', onSubmit);
// 메모 입력란에서 한글 확정용 Enter가 폼 제출로 이어지지 않게 한다
el.form.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && composing(ev)) ev.preventDefault();
});
el.cancel.addEventListener('click', () => { resetForm(); render(); });

// ---------- 시작 ----------
el.newMonth.value = thisMonth();
if (!state.months.length) {
  addMonth(thisMonth());
} else {
  if (!currentMonth()) state.currentId = state.months[0].id;
  resetForm();
  render();
}
