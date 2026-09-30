// Tipos de exercício: metadados, validação e renderização no modo aluno.
//
// Contrato do render(q, api):
//   api.setReady(bool)   habilita/desabilita o botão "Verificar"
//   api.onCheck(fn)      fn() => { correct: bool, answer: string } chamada ao verificar
//   api.finish(result)   encerra sozinho (tipos com auto: true, que não têm botão Verificar)
//
// Campos opcionais do tipo:
//   auto            o exercício se encerra sozinho (associar, forca)
//   answerText(q)   resposta mostrada quando o aluno pula
//   speechText(q)   texto lido pelo botão "Ouvir"
(function () {
  const { h, shuffle, normalize, speak } = Duo;

  /** Letra-base para comparação na forca (Á, Ã, Â → A; Ç → C). */
  function baseLetter(ch) {
    return ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }
  const isLetter = ch => /\p{L}|\p{N}/u.test(ch);

  /** Divide "A água ferve a [100] graus" em partes de texto e lacunas. */
  function parseBlanks(text) {
    return String(text || '').split(/\[([^\]]+)\]/).map((t, i) => ({ blank: i % 2 === 1, text: t }));
  }

  function words(s) {
    return String(s || '').trim().split(/\s+/).filter(Boolean);
  }


  /**
   * Monta a grade da cruzadinha de forma determinística (todos os alunos veem a mesma).
   * Coloca a palavra mais longa na horizontal e encaixa as outras onde cruzarem mais letras.
   * Palavras que não cruzam com nenhuma ficam soltas abaixo (disconnected > 0).
   */
  function layoutCrossword(words) {
    const items = (words || [])
      .map((w, i) => ({ i, clue: String(w.clue || '').trim(), raw: String(w.answer || '').trim(), word: [...String(w.answer || '')].filter(isLetter).map(baseLetter).join('') }))
      .filter(x => x.word.length >= 2 && x.clue);
    const order = [...items].sort((a, b) => b.word.length - a.word.length || a.i - b.i);
    const grid = new Map(); // "r,c" -> { ch, h, v }
    const key = (r, c) => r + ',' + c;
    const get = (r, c) => grid.get(key(r, c));
    const entries = [];
    let disconnected = 0;

    function score(w, r, c, dir) {
      const dr = dir === 'v' ? 1 : 0, dc = dir === 'h' ? 1 : 0;
      if (get(r - dr, c - dc) || get(r + dr * w.length, c + dc * w.length)) return -1;
      let hits = 0;
      for (let k = 0; k < w.length; k++) {
        const rr = r + dr * k, cc = c + dc * k, cell = get(rr, cc);
        if (cell) {
          if (cell.ch !== w[k] || cell[dir]) return -1;
          hits++;
        } else if (dir === 'h' ? (get(rr - 1, cc) || get(rr + 1, cc)) : (get(rr, cc - 1) || get(rr, cc + 1))) {
          return -1;
        }
      }
      return hits;
    }
    function place(item, r, c, dir) {
      const dr = dir === 'v' ? 1 : 0, dc = dir === 'h' ? 1 : 0;
      for (let k = 0; k < item.word.length; k++) {
        const kk = key(r + dr * k, c + dc * k);
        const cell = grid.get(kk) || { ch: item.word[k], h: false, v: false };
        cell[dir] = true;
        grid.set(kk, cell);
      }
      entries.push({ ...item, r, c, dir });
    }

    order.forEach((item, n) => {
      if (n === 0) return place(item, 0, 0, 'h');
      let best = null;
      for (const [k, cell] of grid) {
        const [cr, cc] = k.split(',').map(Number);
        for (let j = 0; j < item.word.length; j++) {
          if (item.word[j] !== cell.ch) continue;
          for (const dir of ['v', 'h']) {
            const r = dir === 'v' ? cr - j : cr, c = dir === 'h' ? cc - j : cc;
            const sc = score(item.word, r, c, dir);
            if (sc > 0 && (!best || sc > best.sc)) best = { r, c, dir, sc };
          }
        }
      }
      if (best) return place(item, best.r, best.c, best.dir);
      // Sem cruzamento: coloca solta abaixo da grade
      disconnected++;
      const rows = [...grid.keys()].map(k => Number(k.split(',')[0]));
      const cols = [...grid.keys()].map(k => Number(k.split(',')[1]));
      let r = Math.max(...rows) + 2;
      while (score(item.word, r, Math.min(...cols), 'h') < 0) r++;
      place(item, r, Math.min(...cols), 'h');
    });

    if (!entries.length) return { entries: [], cells: new Map(), rows: 0, cols: 0, disconnected: 0 };
    const minR = Math.min(...[...grid.keys()].map(k => Number(k.split(',')[0])));
    const minC = Math.min(...[...grid.keys()].map(k => Number(k.split(',')[1])));
    const cells = new Map();
    for (const [k, cell] of grid) {
      const [r, c] = k.split(',').map(Number);
      cells.set(key(r - minR, c - minC), cell.ch);
    }
    entries.forEach(e => { e.r -= minR; e.c -= minC; });
    // Numeração tradicional: da esquerda para a direita, de cima para baixo
    const starts = [...new Set(entries.map(e => key(e.r, e.c)))]
      .map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const numOf = new Map(starts.map(([r, c], i) => [key(r, c), i + 1]));
    entries.forEach(e => { e.num = numOf.get(key(e.r, e.c)); });
    entries.sort((a, b) => a.num - b.num);
    const rows = Math.max(...[...cells.keys()].map(k => Number(k.split(',')[0]))) + 1;
    const cols = Math.max(...[...cells.keys()].map(k => Number(k.split(',')[1]))) + 1;
    return { entries, cells, rows, cols, disconnected };
  }

  // ---------- Vídeo do YouTube ----------

  /** Extrai o id do vídeo de links do YouTube (watch, youtu.be, shorts, embed). */
  function youtubeId(url) {
    const m = String(url || '').trim().match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  /** "1:30", "01:02:03", "90", "1m30s" → segundos (ou null). */
  function parseTime(v) {
    const t = String(v ?? '').trim().toLowerCase();
    if (!t) return null;
    if (/^\d+(:\d{1,2}){0,2}$/.test(t)) return t.split(':').reduce((acc, n) => acc * 60 + Number(n), 0);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m && (m[1] || m[2] || m[3]) ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : null;
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + ':' + String(s).padStart(2, '0');
  }

  /** Carrega a API de iframe do YouTube uma vez. Rejeita se não carregar (rede bloqueada, offline). */
  let ytPromise = null;
  function loadYouTube() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytPromise) return ytPromise;
    ytPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ytPromise = null; reject(new Error('timeout')); }, 12000);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); if (prev) prev(); resolve(window.YT); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => { clearTimeout(timer); ytPromise = null; tag.remove(); reject(new Error('load')); };
      document.head.append(tag);
    });
    return ytPromise;
  }

  const TYPES = {
    associar: {
      label: 'Associar pares', icon: '🔗', auto: true,
      examples: 'Palavra ↔ tradução · país ↔ capital · fórmula ↔ nome · autor ↔ obra',
      answerText: q => q.pairs.map(p => `${p.a} ↔ ${p.b}`).join(' · '),
      speechText: q => q.prompt,
      hint: 'Ligue cada item ao seu par. Ótimo para vocabulário, conceitos, datas, fórmulas.',
      blank: () => ({ prompt: 'Associe os pares', pairs: [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }] }),
      validate(q) {
        const ok = (q.pairs || []).filter(p => p.a.trim() && p.b.trim());
        if (ok.length < 2) return 'Preencha pelo menos 2 pares completos.';
        if (ok.length !== q.pairs.length) return 'Há pares incompletos.';
        return null;
      },
      render(q, api) {
        const pairs = q.pairs.filter(p => p.a.trim() && p.b.trim());
        let selected = null;
        let errors = 0;
        let matched = 0;
        const make = (side, p) => {
          const btn = h('button', { class: 'tile', onClick: () => pick(side, p, btn) }, side === 'a' ? p.a : p.b);
          return btn;
        };
        function pick(side, p, btn) {
          if (btn.classList.contains('matched')) return;
          if (!selected || selected.side === side) {
            if (selected) selected.btn.classList.remove('selected');
            selected = { side, p, btn };
            btn.classList.add('selected');
            return;
          }
          const [left, right] = side === 'a' ? [p, selected.p] : [selected.p, p];
          const other = selected.btn;
          selected = null;
          other.classList.remove('selected');
          if (normalize(left.b) === normalize(right.b)) {
            [btn, other].forEach(b => { b.classList.add('matched'); b.disabled = true; });
            if (++matched === pairs.length) {
              api.finish({ correct: true, answer: errors ? `Concluído com ${errors} tentativa(s) errada(s).` : '' });
            }
          } else {
            errors++;
            [btn, other].forEach(b => { b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 500); });
          }
        }
        return h('div', { class: 'ex' },
          h('h2', { class: 'ex-title' }, q.prompt || 'Associe os pares'),
          h('div', { class: 'match' },
            h('div', { class: 'col' }, shuffle(pairs).map(p => make('a', p))),
            h('div', { class: 'col' }, shuffle(pairs).map(p => make('b', p)))));
      },
    },

    multipla: {
      label: 'Múltipla escolha', icon: '🔘',
      examples: 'Qualquer matéria: conceitos, interpretação, cálculo',
      speechText: q => [q.prompt, ...q.options.filter(o => o.trim())].join('. '),
      hint: 'Uma pergunta e de 2 a 6 alternativas, uma correta.',
      blank: () => ({ prompt: '', options: ['', '', '', ''], answer: 0 }),
      validate(q) {
        if (!q.prompt.trim()) return 'Escreva a pergunta.';
        const filled = q.options.filter(o => o.trim());
        if (filled.length < 2) return 'Preencha pelo menos 2 alternativas.';
        if (!(q.options[q.answer] || '').trim()) return 'Marque uma alternativa correta preenchida.';
        return null;
      },
      render(q, api) {
        const opts = shuffle(q.options.map((t, i) => ({ t, i })).filter(o => o.t.trim()));
        let sel = null;
        const btns = opts.map((o, k) => {
          const b = h('button', {
            class: 'option',
            onClick: () => {
              sel = o.i;
              btns.forEach(x => x.classList.remove('selected'));
              b.classList.add('selected');
              api.setReady(true);
            },
          }, h('span', { class: 'kbd' }, k + 1), h('span', null, o.t));
          return b;
        });
        api.onCheck(() => ({ correct: sel === q.answer, answer: q.options[q.answer] }));
        api.onKey(k => { const n = Number(k); if (n >= 1 && n <= btns.length) btns[n - 1].click(); });
        return h('div', { class: 'ex' }, h('h2', { class: 'ex-title' }, q.prompt), h('div', { class: 'options' }, btns));
      },
    },

    completar: {
      label: 'Complete a frase', icon: '✏️',
      examples: 'Definições · regras de gramática · leis da Física',
      speechText: q => parseBlanks(q.text).map(p => p.blank ? ' lacuna ' : p.text).join(''),
      hint: 'Escreva a frase e coloque entre [colchetes] as palavras que o aluno deve completar.',
      blank: () => ({ text: '', distractors: [] }),
      validate(q) {
        if (!parseBlanks(q.text).some(p => p.blank)) return 'Marque pelo menos uma lacuna com [colchetes].';
        return null;
      },
      render(q, api) {
        const parts = parseBlanks(q.text);
        const blanks = parts.filter(p => p.blank);
        const bank = shuffle([...blanks.map(b => b.text.trim()), ...(q.distractors || [])]).map(t => ({ t, used: false }));
        const filled = blanks.map(() => null); // índice no banco
        const sentence = h('div', { class: 'sentence' });
        const bankEl = h('div', { class: 'bank' });

        function draw() {
          let bi = 0;
          sentence.replaceChildren(...parts.map(p => {
            if (!p.blank) return h('span', null, p.text);
            const i = bi++;
            const f = filled[i];
            return h('button', {
              class: 'gap' + (f != null ? ' filled' : ''),
              onClick: () => { if (f != null) { bank[f].used = false; filled[i] = null; draw(); } },
            }, f != null ? bank[f].t : ' ');
          }));
          bankEl.replaceChildren(...bank.map((w, k) => h('button', {
            class: 'chip' + (w.used ? ' used' : ''),
            disabled: w.used,
            onClick: () => {
              const slot = filled.indexOf(null);
              if (slot < 0) return;
              filled[slot] = k; w.used = true; draw();
            },
          }, w.t)));
          api.setReady(filled.every(f => f != null));
        }
        draw();
        api.onCheck(() => ({
          correct: blanks.every((b, i) => normalize(bank[filled[i]].t) === normalize(b.text)),
          answer: parts.map(p => p.text).join(''),
        }));
        return h('div', { class: 'ex' }, h('h2', { class: 'ex-title' }, 'Complete a frase'), sentence, bankEl);
      },
    },

    ordenar: {
      label: 'Ordenar palavras', icon: '🧩',
      examples: 'Tradução · sintaxe · montar uma definição',
      speechText: q => q.prompt,
      hint: 'Escreva a frase correta. O aluno recebe as palavras embaralhadas para montar.',
      blank: () => ({ prompt: 'Monte a frase', answer: '', distractors: [] }),
      validate(q) {
        if (words(q.answer).length < 2) return 'A frase precisa ter pelo menos 2 palavras.';
        return null;
      },
      render(q, api) {
        const tokens = shuffle([...words(q.answer), ...(q.distractors || [])]).map(t => ({ t, placed: false }));
        const line = [];
        const lineEl = h('div', { class: 'answer-line' });
        const bankEl = h('div', { class: 'bank' });
        function draw() {
          lineEl.replaceChildren(...line.map((k, pos) => h('button', {
            class: 'chip',
            onClick: () => { tokens[k].placed = false; line.splice(pos, 1); draw(); },
          }, tokens[k].t)));
          bankEl.replaceChildren(...tokens.map((w, k) => h('button', {
            class: 'chip' + (w.placed ? ' used' : ''),
            disabled: w.placed,
            onClick: () => { w.placed = true; line.push(k); draw(); },
          }, w.t)));
          api.setReady(line.length > 0);
        }
        draw();
        api.onCheck(() => ({
          correct: normalize(line.map(k => tokens[k].t).join(' ')) === normalize(q.answer),
          answer: q.answer,
        }));
        return h('div', { class: 'ex' }, h('h2', { class: 'ex-title' }, q.prompt || 'Monte a frase'), lineEl, bankEl);
      },
    },

    vf: {
      label: 'Verdadeiro ou falso', icon: '⚖️',
      examples: 'Afirmações rápidas de revisão',
      speechText: q => q.prompt,
      hint: 'Uma afirmação que o aluno julga como verdadeira ou falsa.',
      blank: () => ({ prompt: '', answer: true }),
      validate(q) { return q.prompt.trim() ? null : 'Escreva a afirmação.'; },
      render(q, api) {
        let sel = null;
        const mk = (val, label) => {
          const b = h('button', {
            class: 'option big',
            onClick: () => { sel = val; [t, f].forEach(x => x.classList.remove('selected')); b.classList.add('selected'); api.setReady(true); },
          }, label);
          return b;
        };
        const t = mk(true, '✔ Verdadeiro');
        const f = mk(false, '✘ Falso');
        api.onCheck(() => ({ correct: sel === q.answer, answer: q.answer ? 'Verdadeiro' : 'Falso' }));
        api.onKey(k => { if (k === '1' || k.toLowerCase() === 'v') t.click(); if (k === '2' || k.toLowerCase() === 'f') f.click(); });
        return h('div', { class: 'ex' },
          h('p', { class: 'ex-kicker' }, 'Verdadeiro ou falso?'),
          h('h2', { class: 'ex-title' }, q.prompt),
          h('div', { class: 'options two' }, t, f));
      },
    },

    sequencia: {
      label: 'Linha do tempo / sequência', icon: '📅',
      examples: 'Datas históricas · fases da mitose · etapas de uma receita · ordem de operações',
      hint: 'Escreva os itens na ordem correta (datas, etapas de um processo, fases). O aluno recebe embaralhado.',
      blank: () => ({ prompt: 'Coloque na ordem correta', items: ['', '', ''] }),
      validate(q) {
        const filled = q.items.filter(i => i.trim());
        if (filled.length < 3) return 'Preencha pelo menos 3 itens.';
        if (filled.length !== q.items.length) return 'Há itens vazios.';
        return null;
      },
      answerText: q => q.items.map((t, i) => `${i + 1}. ${t}`).join('  '),
      speechText: q => q.prompt,
      render(q, api) {
        let order = shuffle(q.items.map((t, i) => ({ t, i })));
        // Garante que não comece já na ordem certa
        if (order.every((o, k) => o.i === k)) order = [...order.slice(1), order[0]];
        const placed = [];
        const listEl = h('ol', { class: 'seq-list' });
        const bankEl = h('div', { class: 'bank column' });
        function draw() {
          listEl.replaceChildren(...placed.map((o, pos) => h('li', null, h('button', {
            class: 'seq-item placed', title: 'Toque para devolver',
            onClick: () => { placed.splice(pos, 1); draw(); },
          }, h('span', { class: 'seq-num' }, pos + 1), h('span', null, o.t)))),
          ...Array.from({ length: q.items.length - placed.length }, (_, k) =>
            h('li', { class: 'seq-slot' }, h('span', { class: 'seq-num' }, placed.length + k + 1))));
          bankEl.replaceChildren(...order.filter(o => !placed.includes(o)).map(o => h('button', {
            class: 'seq-item', onClick: () => { placed.push(o); draw(); },
          }, o.t)));
          api.setReady(placed.length === q.items.length);
        }
        draw();
        api.onCheck(() => ({
          correct: placed.every((o, k) => normalize(o.t) === normalize(q.items[k])),
          answer: q.items.map((t, i) => `${i + 1}. ${t}`).join('  '),
        }));
        return h('div', { class: 'ex' },
          h('h2', { class: 'ex-title' }, q.prompt || 'Coloque na ordem correta'),
          h('p', { class: 'muted small' }, 'Toque nos itens na ordem certa. Toque de novo para desfazer.'),
          listEl, bankEl);
      },
    },

    forca: {
      label: 'Forca (palavra oculta)', icon: '🔤', auto: true,
      examples: 'Vocabulário · termos técnicos · nomes de personagens',
      hint: 'O aluno descobre a palavra letra por letra a partir de uma dica. Até 6 erros.',
      blank: () => ({ prompt: '', answer: '' }),
      validate(q) {
        if (!q.prompt.trim()) return 'Escreva a dica.';
        const letters = [...q.answer].filter(isLetter).length;
        if (letters < 2) return 'A palavra precisa ter pelo menos 2 letras.';
        if (letters > 30) return 'Use no máximo 30 letras.';
        return null;
      },
      answerText: q => q.answer.trim(),
      speechText: q => q.prompt,
      render(q, api) {
        const MAX = 6;
        const word = q.answer.trim();
        const guessed = new Set();
        let errors = 0;
        let over = false;
        const wordEl = h('div', { class: 'hang-word', 'aria-live': 'polite' });
        const livesEl = h('div', { class: 'hang-lives' });
        const keys = {};
        const kb = h('div', { class: 'keyboard' }, [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(L => {
          keys[L] = h('button', { class: 'key', onClick: () => guess(L) }, L);
          return keys[L];
        }));
        const hidden = () => [...word].filter(ch => isLetter(ch) && !guessed.has(baseLetter(ch)));
        function draw() {
          wordEl.replaceChildren(...word.split(' ').map(w => h('span', { class: 'hang-group' }, [...w].map(ch =>
            isLetter(ch)
              ? h('span', { class: 'hang-letter' + (guessed.has(baseLetter(ch)) ? ' shown' : '') }, guessed.has(baseLetter(ch)) || over ? ch : '\u00a0')
              : h('span', { class: 'hang-sep' }, ch)))));
          livesEl.replaceChildren(h('span', { class: 'muted small' }, 'Tentativas: '),
            ...Array.from({ length: MAX }, (_, i) => h('span', { class: 'life' + (i < MAX - errors ? '' : ' lost') })));
        }
        function guess(L) {
          if (over || guessed.has(L)) return;
          guessed.add(L);
          const hit = [...word].some(ch => isLetter(ch) && baseLetter(ch) === L);
          keys[L].classList.add(hit ? 'hit' : 'miss');
          keys[L].disabled = true;
          if (!hit) errors++;
          if (!hidden().length) { over = true; draw(); api.finish({ correct: true, answer: word }); return; }
          if (errors >= MAX) { over = true; draw(); api.finish({ correct: false, answer: word }); return; }
          draw();
        }
        api.onKey(k => { const L = baseLetter(k); if (/^[A-Z]$/.test(L)) guess(L); });
        draw();
        return h('div', { class: 'ex' },
          h('p', { class: 'ex-kicker' }, 'Descubra a palavra'),
          h('h2', { class: 'ex-title' }, q.prompt),
          wordEl, livesEl, kb);
      },
    },

    ditado: {
      label: 'Ditado (ouvir e escrever)', icon: '🎧',
      examples: 'Idiomas · alfabetização · ortografia',
      hint: 'O aluno ouve a frase (voz do navegador) e escreve o que ouviu. Ótimo para idiomas e alfabetização.',
      blank: () => ({ text: '', lang: 'pt-BR' }),
      validate(q) { return q.text.trim() ? null : 'Escreva a frase que será falada.'; },
      answerText: q => q.text,
      speechText: () => '',
      render(q, api) {
        const input = h('input', {
          class: 'input big', type: 'text', placeholder: 'Escreva o que você ouviu', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
          onInput: () => api.setReady(input.value.trim().length > 0),
        });
        const play = rate => speak(q.text, q.lang || 'pt-BR', rate);
        setTimeout(() => play(1), 300);
        api.onCheck(() => ({ correct: normalize(input.value) === normalize(q.text), answer: q.text }));
        return h('div', { class: 'ex' },
          h('h2', { class: 'ex-title' }, 'Escreva o que você ouvir'),
          h('div', { class: 'listen' },
            h('button', { class: 'listen-btn', 'aria-label': 'Ouvir', onClick: () => play(1) }, '🔊'),
            h('button', { class: 'listen-btn slow', 'aria-label': 'Ouvir devagar', onClick: () => play(0.6) }, '🐢')),
          input);
      },
    },

    cruzadinha: {
      label: 'Cruzadinha', icon: '✖️',
      examples: 'Vocabulário · conceitos-chave · nomes de órgãos, países, autores',
      hint: 'Palavras e dicas. A grade é montada automaticamente, cruzando as palavras.',
      blank: () => ({ prompt: 'Complete a cruzadinha', words: [{ answer: '', clue: '' }, { answer: '', clue: '' }, { answer: '', clue: '' }] }),
      validate(q) {
        const words = q.words || [];
        const filled = words.filter(w => w.answer.trim() && w.clue.trim());
        if (filled.length < 3) return 'Preencha pelo menos 3 palavras com dica.';
        if (filled.length !== words.length) return 'Há palavras ou dicas vazias.';
        const long = words.find(w => [...w.answer].filter(isLetter).length > 15);
        if (long) return `"${long.answer}" é longa demais (máx. 15 letras).`;
        if (words.some(w => [...w.answer].filter(isLetter).length < 2)) return 'Cada palavra precisa ter pelo menos 2 letras.';
        return null;
      },
      answerText: q => q.words.map(w => w.answer.trim()).join(', '),
      speechText: q => q.words.map((w, i) => `${i + 1}: ${w.clue}`).join('. '),
      render(q, api) {
        const L = layoutCrossword(q.words);
        const inputs = new Map();
        let current = L.entries[0];
        const cellKey = (r, c) => r + ',' + c;
        const cellsOf = e => Array.from({ length: e.word.length }, (_, k) => cellKey(e.r + (e.dir === 'v' ? k : 0), e.c + (e.dir === 'h' ? k : 0)));
        const clueEls = new Map();

        function highlight() {
          inputs.forEach(inp => inp.classList.remove('active'));
          cellsOf(current).forEach(k => inputs.get(k).classList.add('active'));
          clueEls.forEach((el, e) => el.classList.toggle('active', e === current));
        }
        function entryAt(k, prefer) {
          const all = L.entries.filter(e => cellsOf(e).includes(k));
          return all.find(e => e.dir === prefer) || all[0];
        }
        function refresh() {
          api.setReady([...inputs.values()].every(i => i.value));
        }
        const grid = h('div', { class: 'cw-grid', style: `--cw-size: min(38px, calc((100vw - 48px) / ${L.cols})); grid-template-columns: repeat(${L.cols}, var(--cw-size)); grid-template-rows: repeat(${L.rows}, var(--cw-size))` });
        const numbers = new Map(L.entries.map(e => [cellKey(e.r, e.c), e.num]));
        L.cells.forEach((ch, k) => {
          const [r, c] = k.split(',').map(Number);
          const inp = h('input', {
            class: 'cw-cell', maxlength: 2, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
            'aria-label': `Linha ${r + 1}, coluna ${c + 1}`,
            onFocus: () => { if (!cellsOf(current).includes(k)) current = entryAt(k, current.dir); highlight(); },
            // Tocar de novo numa casa de cruzamento troca a direção (horizontal ↔ vertical)
            onMousedown: () => { inp.dataset.wasFocused = document.activeElement === inp ? '1' : ''; },
            onClick: () => {
              if (!inp.dataset.wasFocused) return;
              const other = entryAt(k, current.dir === 'h' ? 'v' : 'h');
              if (other && other !== current) { current = other; highlight(); }
            },
            onInput: e => {
              const v = [...e.target.value.toUpperCase()].filter(isLetter).pop() || '';
              e.target.value = v;
              if (v) {
                const list = cellsOf(current), pos = list.indexOf(k);
                const next = list[pos + 1];
                if (next) { inputs.get(next).focus(); inputs.get(next).select(); }
              }
              refresh();
            },
            onKeydown: e => {
              if (e.key === 'Backspace' && !inp.value) {
                const list = cellsOf(current), pos = list.indexOf(k);
                if (pos > 0) { e.preventDefault(); const prev = inputs.get(list[pos - 1]); prev.value = ''; prev.focus(); refresh(); }
              }
            },
          });
          inputs.set(k, inp);
          grid.append(h('div', { class: 'cw-box', style: `grid-row: ${r + 1}; grid-column: ${c + 1}` },
            numbers.has(k) ? h('span', { class: 'cw-num' }, numbers.get(k)) : '', inp));
        });
        const clueList = dir => L.entries.filter(e => e.dir === dir).map(e => {
          const el = h('li', { onClick: () => { current = e; const first = inputs.get(cellsOf(e)[0]); first.focus(); first.select(); highlight(); } },
            h('strong', null, e.num + '. '), e.clue, h('span', { class: 'muted' }, ` (${e.word.length})`));
          clueEls.set(e, el);
          return el;
        });
        api.onCheck(() => ({
          correct: [...inputs].every(([k, inp]) => baseLetter(inp.value) === L.cells.get(k)),
          answer: L.entries.map(e => `${e.num}. ${e.raw}`).join('  '),
        }));
        setTimeout(() => { const first = inputs.get(cellsOf(current)[0]); if (first && window.matchMedia('(pointer: fine)').matches) first.focus(); highlight(); }, 50);
        return h('div', { class: 'ex' },
          h('h2', { class: 'ex-title' }, q.prompt || 'Complete a cruzadinha'),
          h('div', { class: 'cw-wrap' }, grid),
          h('div', { class: 'cw-clues' },
            L.entries.some(e => e.dir === 'h') && h('div', null, h('h3', null, '→ Horizontais'), h('ol', null, clueList('h'))),
            L.entries.some(e => e.dir === 'v') && h('div', null, h('h3', null, '↓ Verticais'), h('ol', null, clueList('v')))));
      },
    },

    video: {
      label: 'Pergunta no vídeo', icon: '🎬',
      examples: 'Trecho de videoaula, documentário, experimento, música',
      hint: 'Cole um link do YouTube e marque o trecho. O vídeo para no fim do trecho e a pergunta aparece.',
      blank: () => ({ url: '', start: 0, end: null, prompt: '', options: ['', '', ''], answer: 0 }),
      validate(q) {
        if (!youtubeId(q.url)) return 'Cole um link válido do YouTube.';
        if (!(q.end > (q.start || 0))) return 'Informe onde o vídeo para (depois do início).';
        if (q.end - (q.start || 0) > 20 * 60) return 'Use trechos de até 20 minutos.';
        if (!String(q.prompt || '').trim()) return 'Escreva a pergunta.';
        const filled = (q.options || []).filter(o => o.trim());
        if (filled.length < 2) return 'Preencha pelo menos 2 alternativas.';
        if (!(q.options[q.answer] || '').trim()) return 'Marque uma alternativa correta preenchida.';
        return null;
      },
      answerText: q => q.options[q.answer],
      speechText: q => [q.prompt, ...q.options.filter(o => o.trim())].join('. '),
      render(q, api) {
        const id = youtubeId(q.url);
        const start = q.start || 0;
        const holder = h('div');
        const frame = h('div', { class: 'video-frame' }, holder);
        const info = h('p', { class: 'muted small video-info' }, `Assista ao trecho (${formatTime(start)} – ${formatTime(q.end)}). A pergunta aparece quando o vídeo parar.`);
        const questionBox = h('div', { class: 'video-question', hidden: true });
        const goBtn = h('button', { class: 'btn small', hidden: true, onClick: () => reveal() }, 'Responder agora');
        const replayBtn = h('button', { class: 'btn small ghost', onClick: () => replay() }, '↺ Rever o trecho');
        let player = null;
        let poll = null;
        let revealed = false;

        // Pergunta: mesma mecânica da múltipla escolha
        const opts = shuffle(q.options.map((t, i) => ({ t, i })).filter(o => o.t.trim()));
        let sel = null;
        const btns = opts.map((o, k) => {
          const b = h('button', {
            class: 'option',
            onClick: () => { sel = o.i; btns.forEach(x => x.classList.remove('selected')); b.classList.add('selected'); api.setReady(true); },
          }, h('span', { class: 'kbd' }, k + 1), h('span', null, o.t));
          return b;
        });
        questionBox.append(h('h2', { class: 'ex-title' }, q.prompt), h('div', { class: 'options' }, btns));

        function reveal() {
          if (revealed) return;
          revealed = true;
          clearInterval(poll);
          questionBox.hidden = false;
          goBtn.hidden = true;
          info.textContent = 'Agora responda:';
          setTimeout(() => questionBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }
        function replay() {
          if (!player || !player.seekTo) return;
          player.seekTo(start, true);
          player.playVideo();
        }
        function fallback(msg) {
          frame.replaceChildren(h('div', { class: 'video-fallback' },
            h('p', null, msg),
            h('a', { class: 'btn small', href: `https://www.youtube.com/watch?v=${id}&t=${start}s`, target: '_blank', rel: 'noopener' }, 'Abrir no YouTube')));
          replayBtn.hidden = true;
          goBtn.hidden = false;
        }

        loadYouTube().then(YT => {
          if (!holder.isConnected) return;
          player = new YT.Player(holder, {
            host: 'https://www.youtube-nocookie.com',
            videoId: id,
            playerVars: { start, end: q.end, rel: 0, playsinline: 1, modestbranding: 1 },
            events: {
              onStateChange: e => { if (e.data === YT.PlayerState.ENDED) reveal(); },
              onError: () => fallback('Este vídeo não pode ser exibido aqui (removido ou com incorporação bloqueada).'),
            },
          });
          // Garantia extra: alguns navegadores não disparam ENDED com o parâmetro "end"
          poll = setInterval(() => {
            if (!frame.isConnected) { clearInterval(poll); return; }
            try { if (player.getCurrentTime && player.getCurrentTime() >= q.end - 0.3) { player.pauseVideo(); reveal(); } } catch { /* player ainda carregando */ }
          }, 500);
        }).catch(() => fallback('Não foi possível carregar o YouTube nesta rede. Assista pelo link e depois responda.'));

        api.onCheck(() => ({ correct: sel === q.answer, answer: q.options[q.answer] }));
        api.onKey(k => { if (revealed) { const n = Number(k); if (n >= 1 && n <= btns.length) btns[n - 1].click(); } });
        return h('div', { class: 'ex' },
          h('p', { class: 'ex-kicker' }, '🎬 Pergunta no vídeo'),
          frame, info,
          h('div', { class: 'row tight wrap' }, replayBtn, goBtn),
          questionBox);
      },
    },

    digitar: {
      label: 'Digitar resposta', icon: '⌨️',
      examples: 'Resultado de conta · fórmula química · data',
      speechText: q => q.prompt,
      hint: 'O aluno digita a resposta. Aceita variações (uma por linha); ignora maiúsculas e acentos.',
      blank: () => ({ prompt: '', answers: [] }),
      validate(q) {
        if (!q.prompt.trim()) return 'Escreva a pergunta.';
        if (!q.answers.length) return 'Informe pelo menos uma resposta aceita.';
        return null;
      },
      render(q, api) {
        const input = h('input', {
          class: 'input big', type: 'text', placeholder: 'Digite sua resposta', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
          onInput: () => api.setReady(input.value.trim().length > 0),
        });
        setTimeout(() => input.focus(), 50);
        api.onCheck(() => ({
          correct: q.answers.some(a => normalize(a) === normalize(input.value)),
          answer: q.answers[0],
        }));
        return h('div', { class: 'ex' }, h('h2', { class: 'ex-title' }, q.prompt), input);
      },
    },
  };

  function validate(q) {
    const t = TYPES[q.type];
    return t ? t.validate(q) : 'Tipo de exercício desconhecido.';
  }

  Duo.Exercises = { TYPES, validate, parseBlanks, layoutCrossword, youtubeId, parseTime, formatTime };
})();
