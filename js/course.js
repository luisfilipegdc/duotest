// Mapa da trilha: lições em sequência, com desbloqueio progressivo.
(function () {
  const { h, Store } = Duo;

  function render(root, courseId) {
    const c = Store.get(courseId);
    if (!c) return Duo.notFound(root);
    const mine = !c.sharedFrom;
    const lessons = c.lessons.filter(l => l.questions.some(q => !Duo.Exercises.validate(q)));
    // A próxima lição liberada é a primeira ainda não concluída.
    const firstOpen = lessons.findIndex(l => !Store.lessonProgress(c.id, l.id));
    const current = firstOpen < 0 ? lessons.length : firstOpen;

    const nodes = lessons.map((l, i) => {
      const p = Store.lessonProgress(c.id, l.id);
      const state = p ? 'done' : i === current ? 'current' : 'locked';
      const offset = [0, 1, 2, 1, 0, -1, -2, -1][i % 8] * 56;
      const stars = p ? (p.best >= 1 ? 3 : p.best >= 0.8 ? 2 : 1) : 0;
      return h('div', { class: `node-wrap ${state}`, style: `transform: translateX(${offset}px)` },
        h(state === 'locked' ? 'span' : 'a', {
          class: `node ${state}`,
          href: state === 'locked' ? null : `#/jogar/${c.id}/${l.id}`,
          'aria-label': `${l.title}${state === 'locked' ? ' (bloqueada)' : ''}`,
        }, state === 'done' ? '✓' : state === 'locked' ? '🔒' : '★'),
        state === 'current' && h('span', { class: 'start-bubble' }, i === 0 ? 'Começar' : 'Próxima'),
        h('span', { class: 'node-label' }, l.title),
        p && h('span', { class: 'node-stars', 'aria-label': `${stars} de 3 estrelas` }, '★'.repeat(stars) + '☆'.repeat(3 - stars)));
    });

    root.replaceChildren(
      Duo.Home.topbar(),
      h('main', { class: 'page narrow' },
        h('div', { class: 'course-head' },
          h('a', { class: 'back', href: '#/' }, '← Trilhas'),
          h('div', { class: 'tags' },
            c.discipline && h('span', { class: 'tag' }, c.discipline),
            c.level && h('span', { class: 'tag soft' }, c.level)),
          h('h1', null, c.title),
          c.description && h('p', { class: 'muted' }, c.description),
          mine && h('div', { class: 'row' },
            h('a', { class: 'btn small', href: `#/editar/${c.id}` }, 'Editar'),
            h('button', { class: 'btn small', onClick: () => Duo.Home.shareDialog(c) }, 'Compartilhar'))),
        lessons.length
          ? h('div', { class: 'path' }, nodes,
              current >= lessons.length && h('div', { class: 'finish' }, '🏆 Trilha concluída! Refaça as lições para melhorar suas estrelas.'))
          : h('div', { class: 'empty' },
              h('p', null, 'Esta trilha ainda não tem exercícios.'),
              mine && h('a', { class: 'btn primary', href: `#/editar/${c.id}` }, 'Adicionar exercícios'))));
  }

  Duo.Course = { render };
})();
