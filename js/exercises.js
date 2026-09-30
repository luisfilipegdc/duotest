// Tipos de exercício: metadados, validação e renderização no modo aluno.
//
// Contrato do render(q, api):
//   api.setReady(bool)   habilita/desabilita o botão "Verificar"
//   api.onCheck(fn)      fn() => { correct: bool, answer: string } chamada ao verificar
//   api.finish(result)   encerra sozinho (usado pelo "associar", que não tem botão Verificar)
(function () {
  const { h, shuffle, normalize } = Duo;

  /** Divide "A água ferve a [100] graus" em partes de texto e lacunas. */
  function parseBlanks(text) {
    return String(text || '').split(/\[([^\]]+)\]/).map((t, i) => ({ blank: i % 2 === 1, text: t }));
  }

  function words(s) {
    return String(s || '').trim().split(/\s+/).filter(Boolean);
  }

  const TYPES = {
    associar: {
      label: 'Associar pares', icon: '🔗',
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

    digitar: {
      label: 'Digitar resposta', icon: '⌨️',
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

  Duo.Exercises = { TYPES, validate, parseBlanks };
})();
