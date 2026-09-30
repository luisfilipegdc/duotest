// Tela inicial: trilhas do professor e trilhas recebidas por link.
(function () {
  const { h, Store, Share, modal, toast } = Duo;

  function statsBar() {
    const s = Store.stats();
    return h('div', { class: 'stats' },
      h('span', { class: 'stat streak', title: 'Dias seguidos' }, '🔥 ', Store.currentStreak()),
      h('span', { class: 'stat xp', title: 'Pontos de experiência' }, '⚡ ', s.xp, ' XP'));
  }

  function topbar() {
    return h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#/' }, h('span', { class: 'logo' }, '⛰'), 'Trilha'),
      statsBar());
  }

  function countQuestions(c) {
    return c.lessons.reduce((n, l) => n + l.questions.length, 0);
  }

  function doneLessons(c) {
    return c.lessons.filter(l => Store.lessonProgress(c.id, l.id)).length;
  }

  function card(c, mine) {
    const done = doneLessons(c);
    const pct = c.lessons.length ? Math.round(100 * done / c.lessons.length) : 0;
    return h('article', { class: 'card course-card' },
      h('a', { class: 'card-main', href: `#/trilha/${c.id}` },
        h('div', { class: 'tags' },
          c.discipline && h('span', { class: 'tag' }, c.discipline),
          c.level && h('span', { class: 'tag soft' }, c.level)),
        h('h3', null, c.title),
        c.description && h('p', { class: 'muted' }, c.description),
        h('div', { class: 'meta' },
          h('span', null, `${c.lessons.length} lição(ões) · ${countQuestions(c)} exercícios`),
          h('span', null, `${pct}%`)),
        h('div', { class: 'progress thin' }, h('div', { class: 'bar', style: `width:${pct}%` }))),
      h('div', { class: 'card-actions' },
        h('a', { class: 'btn small primary', href: `#/trilha/${c.id}` }, done ? 'Continuar' : 'Começar'),
        mine && h('a', { class: 'btn small', href: `#/editar/${c.id}` }, 'Editar'),
        mine && h('button', { class: 'btn small', onClick: () => shareDialog(c) }, 'Compartilhar'),
        !mine && h('button', {
          class: 'btn small', title: 'Cria uma cópia sua para editar',
          onClick: () => { const copy = Store.duplicate(c); toast('Cópia criada em "Minhas trilhas".'); location.hash = `#/editar/${copy.id}`; },
        }, 'Copiar e editar'),
        h('button', {
          class: 'btn small ghost danger',
          onClick: () => { if (confirm(`Excluir "${c.title}"? Isso não pode ser desfeito.`)) { Store.remove(c.id); Duo.route(); } },
        }, 'Excluir')));
  }

  async function shareDialog(course) {
    const valid = course.lessons.some(l => l.questions.some(q => !Duo.Exercises.validate(q)));
    if (!valid) { toast('Adicione pelo menos um exercício completo antes de compartilhar.'); return; }
    const link = await Share.linkFor(course);
    const input = h('input', { class: 'input', readonly: true, value: link, onFocus: e => e.target.select() });
    modal('Compartilhar trilha',
      h('p', null, 'Envie este link para seus alunos (WhatsApp, Classroom, e-mail…). A trilha inteira vai dentro do link: não precisa de cadastro.'),
      input,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onClick: () => Duo.copyText(link) }, 'Copiar link'),
        h('button', { class: 'btn', onClick: () => Share.downloadJson(course) }, 'Baixar arquivo')),
      h('p', { class: 'muted small' }, 'Se você editar a trilha, gere e envie o link de novo. O progresso dos alunos é mantido.'),
      link.length > 6000 && h('p', { class: 'warn small' }, 'Trilha grande: o link ficou longo. Se algum app cortar o link, envie o arquivo.'));
  }

  function importFile() {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const course = Share.withIds(JSON.parse(await file.text()));
        const saved = Store.duplicate(course);
        toast('Trilha importada!');
        location.hash = `#/trilha/${saved.id}`;
      } catch (e) {
        toast('Não foi possível importar: ' + e.message);
      }
    });
    input.click();
  }

  function render(root) {
    const all = Store.courses();
    const mine = all.filter(c => !c.sharedFrom);
    const shared = all.filter(c => c.sharedFrom);
    root.replaceChildren(
      topbar(),
      h('main', { class: 'page' },
        h('section', { class: 'hero' },
          h('h1', null, 'Sua matéria, um passo por dia'),
          h('p', null, 'Monte trilhas de exercícios curtos para qualquer disciplina. Seus alunos estudam um pouco todo dia, no celular ou no computador.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', onClick: () => { location.hash = `#/editar/${Store.create().id}`; } }, '+ Nova trilha'),
            h('button', { class: 'btn', onClick: importFile }, 'Importar arquivo'))),
        shared.length > 0 && h('section', null,
          h('h2', { class: 'section-title' }, 'Estou fazendo'),
          h('div', { class: 'grid' }, shared.map(c => card(c, false)))),
        h('section', null,
          h('h2', { class: 'section-title' }, 'Minhas trilhas'),
          mine.length
            ? h('div', { class: 'grid' }, mine.map(c => card(c, true)))
            : h('p', { class: 'muted' }, 'Você ainda não criou nenhuma trilha.'))));
  }

  Duo.Home = { render, topbar, shareDialog };
})();
