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

/** Lê um texto em voz alta com a voz do navegador (grátis, funciona offline na maioria dos aparelhos). */
function speak(text, lang = 'pt-BR', rate = 1) {
  if (!('speechSynthesis' in window) || !text) { toast('Seu navegador não tem leitura em voz alta.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voice = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase()));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

/** Reduz uma imagem enviada pelo professor para caber no link compartilhável. */
function shrinkImage(file, maxSide = 560, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      const webp = c.toDataURL('image/webp', quality);
      resolve(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Imagem inválida.'));
    img.src = URL.createObjectURL(file);
  });
}

Object.assign(window.Duo, { h, shuffle, uid, normalize, splitList, toast, modal, copyText, speak, shrinkImage });
