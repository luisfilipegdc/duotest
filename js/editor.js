// Editor do professor. Salva automaticamente a cada alteração.
//   #/editar/:curso           dados da trilha + lista de lições
//   #/editar/:curso/:licao    exercícios de uma lição
(function () {
  const { h, Store, Exercises, uid, splitList, toast, speak, shrinkImage } = Duo;
  const { TYPES } = Exercises;

  let saveTimer = null;
  function autosave(course) {
    clearTimeout(saveTimer);
    const status = document.querySelector('.save-status');
    if (status) status.textContent = 'Salvando…';
    saveTimer = setTimeout(() => {
      Store.save(course);
      const s = document.querySelector('.save-status');
      if (s) s.textContent = 'Salvo ✓';
    }, 400);
  }
  function saveNow(course) {
    clearTimeout(saveTimer);
    Store.save(course);
  }

  /** Campo de texto ligado a obj[key]. */
  function field(label, obj, key, course, opts = {}) {
    const tag = opts.multiline ? 'textarea' : 'input';
    const input = h(tag, {
      class: 'input', value: obj[key] || '', placeholder: opts.placeholder || '', rows: opts.rows || 2,
      onInput: e => { obj[key] = e.target.value; autosave(course); opts.onInput && opts.onInput(); },
    });
    return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input,
      opts.help && h('span', { class: 'help' }, opts.help));
  }

  /** Campo de lista (separada por vírgula ou por linha) ligado a obj[key] (array). */
  function listField(label, obj, key, course, opts = {}) {
    const sep = opts.lines ? '\n' : ',';
    const tag = opts.lines ? 'textarea' : 'input';
    const input = h(tag, {
      class: 'input', rows: 3, value: (obj[key] || []).join(opts.lines ? '\n' : ', '), placeholder: opts.placeholder || '',
      onInput: e => { obj[key] = splitList(e.target.value, sep); autosave(course); opts.onInput && opts.onInput(); },
    });
    return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input,
      opts.help && h('span', { class: 'help' }, opts.help));
  }

  function saveBar(course, backHref, backLabel) {
    return h('div', { class: 'editor-bar' },
      h('a', { class: 'back', href: backHref, onClick: () => saveNow(course) }, '← ', backLabel),
      h('span', { class: 'save-status muted small' }, 'Salvo ✓'));
  }

  // ---------- Página da trilha ----------
  function renderCourse(root, course) {
    const lessonsEl = h('div', { class: 'lesson-list' });
    function drawLessons() {
      lessonsEl.replaceChildren(...course.lessons.map((l, i) => {
        const invalid = l.questions.filter(q => Exercises.validate(q)).length;
        return h('div', { class: 'card lesson-row' },
          h('span', { class: 'lesson-num' }, i + 1),
          h('a', { class: 'lesson-link', href: `#/editar/${course.id}/${l.id}`, onClick: () => saveNow(course) },
            h('strong', null, l.title || 'Sem título'),
            h('span', { class: 'muted small' }, `${l.questions.length} exercício(s)`, invalid ? ` · ⚠ ${invalid} incompleto(s)` : '')),
          h('div', { class: 'row tight' },
            h('button', { class: 'icon-btn', title: 'Subir', disabled: i === 0, onClick: () => move(i, -1) }, '↑'),
            h('button', { class: 'icon-btn', title: 'Descer', disabled: i === course.lessons.length - 1, onClick: () => move(i, 1) }, '↓'),
            h('button', {
              class: 'icon-btn danger', title: 'Excluir lição',
              onClick: () => {
                if (l.questions.length && !confirm(`Excluir a lição "${l.title}" e seus exercícios?`)) return;
                course.lessons.splice(i, 1); saveNow(course); drawLessons();
              },
            }, '🗑')));
      }));
    }
    function move(i, d) {
      const [l] = course.lessons.splice(i, 1);
      course.lessons.splice(i + d, 0, l);
      saveNow(course); drawLessons();
    }
    drawLessons();

    root.replaceChildren(
      Duo.Home.topbar(),
      h('main', { class: 'page narrow editor' },
        saveBar(course, '#/', 'Trilhas'),
        h('h1', null, 'Editar trilha'),
        h('div', { class: 'card form' },
          field('Nome da trilha', course, 'title', course, { placeholder: 'Ex.: Frações, Verbos no passado, Revolução Francesa' }),
          h('div', { class: 'cols' },
            field('Disciplina', course, 'discipline', course, { placeholder: 'Ex.: Matemática' }),
            field('Nível / série', course, 'level', course, { placeholder: 'Ex.: 7º ano, Ensino Médio, Graduação' })),
          field('Descrição (opcional)', course, 'description', course, { multiline: true, placeholder: 'O que o aluno vai aprender' })),
        h('h2', { class: 'section-title' }, 'Lições'),
        h('p', { class: 'muted small' }, 'Os alunos fazem as lições em ordem. Cada lição libera a próxima. Dica: 5 a 10 exercícios por lição.'),
        lessonsEl,
        h('div', { class: 'row' },
          h('button', {
            class: 'btn',
            onClick: () => {
              const l = { id: uid(), title: `Lição ${course.lessons.length + 1}`, questions: [] };
              course.lessons.push(l); saveNow(course);
              location.hash = `#/editar/${course.id}/${l.id}`;
            },
          }, '+ Nova lição'),
          h('a', { class: 'btn primary', href: `#/trilha/${course.id}`, onClick: () => saveNow(course) }, 'Ver trilha'))));
  }

  // ---------- Editores por tipo de exercício ----------
  const EDITORS = {
    associar(q, course, redraw) {
      const rows = h('div', { class: 'pairs' });
      function draw() {
        rows.replaceChildren(...q.pairs.map((p, i) => h('div', { class: 'pair-row' },
          h('input', { class: 'input', value: p.a, placeholder: 'Item', onInput: e => { p.a = e.target.value; autosave(course); redraw(); } }),
          h('span', { class: 'muted' }, '↔'),
          h('input', { class: 'input', value: p.b, placeholder: 'Par', onInput: e => { p.b = e.target.value; autosave(course); redraw(); } }),
          h('button', { class: 'icon-btn danger', title: 'Remover par', disabled: q.pairs.length <= 2, onClick: () => { q.pairs.splice(i, 1); autosave(course); draw(); redraw(); } }, '✕'))));
      }
      draw();
      return [
        field('Instrução', q, 'prompt', course, { placeholder: 'Associe os pares' }),
        rows,
        h('button', { class: 'btn small', disabled: q.pairs.length >= 8, onClick: e => { e.preventDefault(); q.pairs.push({ a: '', b: '' }); autosave(course); draw(); redraw(); } }, '+ Par'),
      ];
    },

    multipla(q, course, redraw) {
      const name = 'ans-' + q.id;
      const rows = h('div', { class: 'opts-edit' });
      function draw() {
        rows.replaceChildren(...q.options.map((o, i) => h('div', { class: 'opt-row' + (q.answer === i ? ' correct' : '') },
          h('input', { type: 'radio', name, checked: q.answer === i, title: 'Alternativa correta', onChange: () => { q.answer = i; autosave(course); draw(); redraw(); } }),
          h('input', { class: 'input', value: o, placeholder: `Alternativa ${i + 1}`, onInput: e => { q.options[i] = e.target.value; autosave(course); redraw(); } }),
          h('button', {
            class: 'icon-btn danger', title: 'Remover', disabled: q.options.length <= 2,
            onClick: () => { q.options.splice(i, 1); if (q.answer >= i && q.answer > 0) q.answer--; autosave(course); draw(); redraw(); },
          }, '✕'))));
      }
      draw();
      return [
        field('Pergunta', q, 'prompt', course, { multiline: true, onInput: redraw }),
        h('span', { class: 'field-label' }, 'Alternativas (marque a correta)'),
        rows,
        h('button', { class: 'btn small', disabled: q.options.length >= 6, onClick: () => { q.options.push(''); autosave(course); draw(); redraw(); } }, '+ Alternativa'),
      ];
    },

    completar(q, course, redraw) {
      const preview = h('div', { class: 'preview' });
      function drawPreview() {
        preview.replaceChildren(h('span', { class: 'muted small' }, 'Como o aluno vê: '),
          ...Exercises.parseBlanks(q.text).map(p => p.blank ? h('span', { class: 'gap filled' }, p.text) : p.text));
      }
      drawPreview();
      return [
        field('Frase', q, 'text', course, {
          multiline: true, rows: 3, placeholder: 'Ex.: O Brasil foi descoberto em [1500] por [Pedro Álvares Cabral].',
          help: 'Coloque entre [colchetes] as palavras que o aluno deve completar.',
          onInput: () => { drawPreview(); redraw(); },
        }),
        preview,
        listField('Palavras extras para confundir (opcional)', q, 'distractors', course, { placeholder: 'Ex.: 1822, Dom Pedro I', help: 'Separe por vírgula.' }),
      ];
    },

    ordenar(q, course, redraw) {
      return [
        field('Instrução', q, 'prompt', course, { placeholder: 'Ex.: Monte a frase / Traduza: "..."' }),
        field('Frase correta', q, 'answer', course, { placeholder: 'Ex.: The cat is on the table', onInput: redraw }),
        listField('Palavras extras para confundir (opcional)', q, 'distractors', course, { placeholder: 'Ex.: dog, under', help: 'Separe por vírgula.' }),
      ];
    },

    vf(q, course, redraw) {
      const name = 'vf-' + q.id;
      return [
        field('Afirmação', q, 'prompt', course, { multiline: true, onInput: redraw }),
        h('div', { class: 'row' },
          h('label', { class: 'radio' }, h('input', { type: 'radio', name, checked: q.answer === true, onChange: () => { q.answer = true; autosave(course); } }), ' Verdadeira'),
          h('label', { class: 'radio' }, h('input', { type: 'radio', name, checked: q.answer === false, onChange: () => { q.answer = false; autosave(course); } }), ' Falsa')),
      ];
    },

    sequencia(q, course, redraw) {
      const rows = h('div', { class: 'opts-edit' });
      function draw() {
        rows.replaceChildren(...q.items.map((it, i) => h('div', { class: 'opt-row' },
          h('span', { class: 'seq-num' }, i + 1),
          h('input', { class: 'input', value: it, placeholder: i === 0 ? 'Ex.: 1500 – Chegada dos portugueses' : `Item ${i + 1}`, onInput: e => { q.items[i] = e.target.value; autosave(course); redraw(); } }),
          h('button', { class: 'icon-btn', title: 'Subir', disabled: i === 0, onClick: () => { [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]]; autosave(course); draw(); } }, '↑'),
          h('button', { class: 'icon-btn danger', title: 'Remover', disabled: q.items.length <= 3, onClick: () => { q.items.splice(i, 1); autosave(course); draw(); redraw(); } }, '✕'))));
      }
      draw();
      return [
        field('Instrução', q, 'prompt', course, { placeholder: 'Ex.: Coloque as fases da mitose na ordem' }),
        h('span', { class: 'field-label' }, 'Itens na ordem correta (o aluno recebe embaralhado)'),
        rows,
        h('button', { class: 'btn small', disabled: q.items.length >= 8, onClick: () => { q.items.push(''); autosave(course); draw(); redraw(); } }, '+ Item'),
      ];
    },

    forca(q, course, redraw) {
      return [
        field('Dica', q, 'prompt', course, { multiline: true, placeholder: 'Ex.: Glândula que produz a insulina', onInput: redraw }),
        field('Palavra ou expressão secreta', q, 'answer', course, {
          placeholder: 'Ex.: Pâncreas', onInput: redraw,
          help: 'Acentos são revelados junto com a letra (A revela Á, Ã, Â). Espaços e hífens já aparecem.',
        }),
      ];
    },

    ditado(q, course, redraw) {
      const langs = [['pt-BR', 'Português'], ['en-US', 'Inglês'], ['es-ES', 'Espanhol'], ['fr-FR', 'Francês'], ['it-IT', 'Italiano'], ['de-DE', 'Alemão']];
      return [
        field('Frase que será falada', q, 'text', course, { multiline: true, placeholder: 'Ex.: The book is on the table', onInput: redraw }),
        h('div', { class: 'row' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Idioma da voz'),
            h('select', { class: 'input', onChange: e => { q.lang = e.target.value; autosave(course); } },
              langs.map(([v, l]) => h('option', { value: v, selected: (q.lang || 'pt-BR') === v }, l)))),
          h('button', { class: 'btn small', onClick: () => speak(q.text, q.lang || 'pt-BR') }, '🔊 Ouvir')),
        h('span', { class: 'help' }, 'A voz vem do navegador do aluno; pode variar entre aparelhos.'),
      ];
    },

    digitar(q, course, redraw) {
      return [
        field('Pergunta', q, 'prompt', course, { multiline: true, onInput: redraw }),
        listField('Respostas aceitas', q, 'answers', course, {
          lines: true, placeholder: 'Uma por linha', onInput: redraw,
          help: 'Uma resposta por linha. Maiúsculas, acentos e pontuação final são ignorados.',
        }),
      ];
    },
  };

  /** Imagem opcional do exercício: link ou envio do computador (reduzida para caber no link). */
  function imageField(q, course) {
    const box = h('div', { class: 'image-field' });
    function draw() {
      if (q.image) {
        box.replaceChildren(
          h('img', { class: 'thumb', src: q.image, alt: '' }),
          h('div', { class: 'image-side' },
            h('input', { class: 'input', value: q.imageAlt || '', placeholder: 'Descrição da imagem (acessibilidade)', onInput: e => { q.imageAlt = e.target.value; autosave(course); } }),
            h('button', { class: 'btn small ghost danger', onClick: () => { delete q.image; delete q.imageAlt; autosave(course); draw(); } }, 'Remover imagem')));
        return;
      }
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        try { q.image = await shrinkImage(file.files[0]); autosave(course); draw(); } catch (e) { toast(e.message); }
      });
      const url = h('input', { class: 'input', placeholder: 'Cole o link de uma imagem (https://…)' });
      box.replaceChildren(
        h('span', { class: 'field-label' }, '🖼 Imagem (opcional)'),
        h('div', { class: 'row tight wrap' },
          url,
          h('button', { class: 'btn small', onClick: () => {
            const v = url.value.trim();
            if (!/^https:\/\//.test(v)) { toast('Use um link que comece com https://'); return; }
            q.image = v; autosave(course); draw();
          } }, 'Usar link'),
          h('button', { class: 'btn small', onClick: () => file.click() }, 'Enviar do computador')),
        file);
    }
    draw();
    return box;
  }

  function questionCard(q, i, lesson, course, drawAll) {
    const warn = h('span', { class: 'warn small' });
    const redraw = () => { warn.textContent = Exercises.validate(q) ? '⚠ ' + Exercises.validate(q) : ''; };
    redraw();
    const t = TYPES[q.type];
    const n = lesson.questions.length;
    const move = d => { lesson.questions.splice(i, 1); lesson.questions.splice(i + d, 0, q); saveNow(course); drawAll(); };
    return h('div', { class: 'card q-card' },
      h('div', { class: 'q-head' },
        h('span', { class: 'q-type' }, `${i + 1}. ${t.icon} ${t.label}`),
        h('div', { class: 'row tight' },
          h('button', { class: 'icon-btn', title: 'Subir', disabled: i === 0, onClick: () => move(-1) }, '↑'),
          h('button', { class: 'icon-btn', title: 'Descer', disabled: i === n - 1, onClick: () => move(1) }, '↓'),
          h('button', {
            class: 'icon-btn', title: 'Duplicar',
            onClick: () => { lesson.questions.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(q)), id: uid() }); saveNow(course); drawAll(); },
          }, '⧉'),
          h('button', { class: 'icon-btn danger', title: 'Excluir', onClick: () => { lesson.questions.splice(i, 1); saveNow(course); drawAll(); } }, '🗑'))),
      h('div', { class: 'q-body' }, EDITORS[q.type](q, course, redraw)),
      imageField(q, course),
      warn);
  }

  // ---------- Página da lição ----------
  function renderLesson(root, course, lesson) {
    const list = h('div', { class: 'q-list' });
    function drawAll() {
      list.replaceChildren(...lesson.questions.map((q, i) => questionCard(q, i, lesson, course, drawAll)));
      if (!lesson.questions.length) list.append(h('p', { class: 'muted empty' }, 'Nenhum exercício ainda. Escolha um tipo abaixo.'));
    }
    drawAll();

    const addButtons = Object.entries(TYPES).map(([type, t]) => h('button', {
      class: 'type-btn', title: t.hint,
      onClick: () => {
        lesson.questions.push({ id: uid(), type, ...t.blank() });
        saveNow(course); drawAll();
        const cards = list.querySelectorAll('.q-card');
        const last = cards[cards.length - 1];
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const first = last.querySelector('input.input, textarea');
        if (first) first.focus({ preventScroll: true });
      },
    }, h('span', { class: 'type-icon' }, t.icon), h('span', null, t.label), t.examples && h('span', { class: 'type-examples' }, t.examples)));

    root.replaceChildren(
      Duo.Home.topbar(),
      h('main', { class: 'page narrow editor' },
        saveBar(course, `#/editar/${course.id}`, course.title || 'Trilha'),
        h('div', { class: 'card form' }, field('Nome da lição', lesson, 'title', course, { placeholder: 'Ex.: Introdução' })),
        list,
        h('h2', { class: 'section-title' }, 'Adicionar exercício'),
        h('div', { class: 'type-grid' }, addButtons),
        h('div', { class: 'row sticky-actions' },
          h('button', {
            class: 'btn primary',
            onClick: () => {
              saveNow(course);
              if (!lesson.questions.some(q => !Exercises.validate(q))) { toast('Adicione pelo menos um exercício completo.'); return; }
              location.hash = `#/jogar/${course.id}/${lesson.id}?teste`;
            },
          }, '▶ Testar lição'))));
  }

  function render(root, courseId, lessonId) {
    const course = Store.get(courseId);
    if (!course || course.sharedFrom) return Duo.notFound(root);
    if (!lessonId) return renderCourse(root, course);
    const lesson = course.lessons.find(l => l.id === lessonId);
    if (!lesson) return Duo.notFound(root);
    renderLesson(root, course, lesson);
  }

  Duo.Editor = { render };
})();
