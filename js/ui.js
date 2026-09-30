// Utilitários de interface compartilhados por todas as telas.
window.Duo = window.Duo || {};

/** Cria um elemento: h('button', {class: 'btn', onClick: fn}, 'Texto', filho, ...) */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Normaliza respostas: ignora maiúsculas, acentos, espaços extras e pontuação final. */
function normalize(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?;:,]+$/, '')
    .trim();
}

/** Divide texto separado por vírgula em lista limpa. */
function splitList(s, sep = ',') {
  return String(s || '').split(sep).map(x => x.trim()).filter(Boolean);
}

function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

function modal(title, ...content) {
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'overlay', onClick: e => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal' },
      h('div', { class: 'modal-head' },
        h('h2', null, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onClick: close }, '✕')),
      ...content));
  document.body.append(overlay);
  return close;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiado!');
  } catch {
    prompt('Copie o texto abaixo:', text);
  }
}

Object.assign(window.Duo, { h, shuffle, uid, normalize, splitList, toast, modal, copyText });
