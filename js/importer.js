// Importar de planilha: o professor cola (ou envia .csv) uma lista "pergunta | resposta | erradas…"
// e o Trilha cria vários tipos de exercício de uma vez. Funciona com Google Planilhas e Excel.
(function () {
  const { h, uid, shuffle, normalize, toast, Exercises } = Duo;

  /** Lê CSV/TSV com aspas. Detecta o separador: tab (colar da planilha), ";" (Excel BR) ou ",". */
  function parseTable(text) {
    const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
    const sep = firstLine.includes('\t') ? '\t'
      : (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') quoted = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
  }

  /** Converte a tabela em itens { q, a, wrong[] }, pulando o cabeçalho se houver. */
  function toItems(rows) {
    if (rows.length && /pergunta|questao|questão|termo|palavra/i.test(rows[0][0] || '') && /resposta|definic|significado|traduc/i.test(normalize(rows[0][1] || ''))) rows = rows.slice(1);
    return rows.map(r => ({ q: r[0] || '', a: r[1] || '', wrong: r.slice(2).filter(Boolean) })).filter(x => x.q && x.a);
  }

  const letters = s => [...s].filter(ch => /\p{L}|\p{N}/u.test(ch)).length;

  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    // Evita um último grupo pequeno demais: junta com o anterior
    if (out.length > 1 && out[out.length - 1].length < 3) out[out.length - 2].push(...out.pop());
    return out;
  }

  const BUILDERS = {
    multipla: items => items.map(it => {
      let wrong = it.wrong.slice(0, 4);
      if (wrong.length < 2) {
        // Sem alternativas erradas na planilha: usa respostas das outras linhas
        const others = shuffle(items.filter(o => normalize(o.a) !== normalize(it.a)).map(o => o.a));
        wrong = [...new Set([...wrong, ...others])].slice(0, 3);
      }
      return wrong.length ? { type: 'multipla', prompt: it.q, options: [it.a, ...wrong], answer: 0 } : null;
    }),
    associar: items => chunk(items, 5).map(group => {
      const seen = new Set();
      const pairs = group.filter(it => !seen.has(normalize(it.a)) && seen.add(normalize(it.a))).map(it => ({ a: it.q, b: it.a }));
      return pairs.length >= 2 ? { type: 'associar', prompt: 'Associe os pares', pairs } : null;
    }),
    digitar: items => items.map(it => ({ type: 'digitar', prompt: it.q, answers: [it.a] })),
    forca: items => items.filter(it => letters(it.a) >= 2 && letters(it.a) <= 30).map(it => ({ type: 'forca', prompt: it.q, answer: it.a })),
    cruzadinha: items => chunk(items.filter(it => letters(it.a) >= 2 && letters(it.a) <= 15), 8)
      .filter(g => g.length >= 3)
      .map(g => ({ type: 'cruzadinha', prompt: 'Complete a cruzadinha', words: g.map(it => ({ answer: it.a, clue: it.q })) })),
  };

  function build(items, modes) {
    return modes.flatMap(m => BUILDERS[m](items))
      .filter(Boolean)
      .map(q => ({ id: uid(), ...q }))
      .filter(q => !Exercises.validate(q));
  }

  function downloadTemplate() {
    const csv = '﻿Pergunta;Resposta;Errada 1;Errada 2;Errada 3\n'
      + 'Capital da França;Paris;Londres;Roma;Madri\n'
      + 'Órgão que bombeia o sangue;Coração;;;\n'
      + 'Quanto é 7 x 8?;56;54;64;\n'
      + 'Tradução de "book";livro;;;\n';
    const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'modelo-trilha.csv' });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /** Abre a janela de importação. onDone(questions) recebe os exercícios criados. */
  function open(onDone) {
    const area = h('textarea', { class: 'input mono', rows: 7, placeholder: 'Pergunta\tResposta\tErrada 1\tErrada 2\nCapital da França\tParis\tLondres\tRoma\n…' });
    const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv', hidden: true });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      area.value = await file.files[0].text();
      update();
    });
    const modes = [
      ['multipla', '🔘 Múltipla escolha', true],
      ['associar', '🔗 Associar pares (grupos de 5)', true],
      ['cruzadinha', '✖️ Cruzadinha (grupos de até 8)', false],
      ['forca', '🔤 Forca', false],
      ['digitar', '⌨️ Digitar resposta', false],
    ].map(([m, label, on]) => {
      const box = h('input', { type: 'checkbox', value: m, checked: on, onChange: () => update() });
      return h('label', { class: 'check' }, box, ' ', label);
    });
    const summary = h('p', { class: 'ai-status' });
    const go = h('button', { class: 'btn primary', disabled: true }, 'Importar');
    let result = [];

    function update() {
      const items = toItems(parseTable(area.value));
      const chosen = modes.map(l => l.querySelector('input')).filter(b => b.checked).map(b => b.value);
      result = build(items, chosen);
      summary.textContent = items.length
        ? `${items.length} linha(s) lidas → ${result.length} exercício(s) serão criados.`
        : '';
      go.disabled = !result.length;
    }
    area.addEventListener('input', update);

    const close = Duo.modal('Importar de planilha',
      h('p', { class: 'small' }, 'Na planilha, use uma linha por item: ', h('strong', null, 'coluna A = pergunta/termo'), ', ',
        h('strong', null, 'coluna B = resposta'), ' e, se quiser, colunas C, D, E = alternativas erradas. Selecione as células, copie e cole abaixo.'),
      area,
      h('div', { class: 'row tight wrap' },
        h('button', { class: 'btn small', onClick: () => file.click() }, 'Enviar arquivo .csv'),
        h('button', { class: 'btn small ghost', onClick: downloadTemplate }, 'Baixar modelo')),
      file,
      h('span', { class: 'field-label' }, 'Criar como'),
      h('div', { class: 'check-grid' }, modes),
      summary,
      h('div', { class: 'row' }, go),
      h('p', { class: 'muted small' }, 'Sem alternativas erradas na planilha, a múltipla escolha usa as respostas das outras linhas.'));

    go.addEventListener('click', () => {
      if (!result.length) return;
      onDone(result);
      close();
      toast(`${result.length} exercício(s) importados.`);
    });
  }

  Duo.Importer = { open, parseTable, toItems, build };
})();
