// Modo aluno: joga uma lição no estilo Duolingo (vidas, progresso, correção imediata, repetição dos erros).
(function () {
  const { h, Store, Exercises, copyText } = Duo;
  const HEARTS = 5;
  const XP_PER_QUESTION = 10;

  let keyHandler = null;
  function setKeyHandler(fn) {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = fn;
    if (fn) document.addEventListener('keydown', fn);
  }

  function render(root, courseId, lessonId, isTest) {
    const course = Store.get(courseId);
    const lesson = course && course.lessons.find(l => l.id === lessonId);
    if (!lesson) return Duo.notFound(root);
    const questions = lesson.questions.filter(q => !Exercises.validate(q));
    if (!questions.length) return Duo.notFound(root);

    const exitHref = isTest ? `#/editar/${course.id}/${lesson.id}` : `#/trilha/${course.id}`;
    const state = {
      queue: questions.map(q => ({ q, retry: false })),
      pos: 0,
      hearts: HEARTS,
      solved: 0,           // exercícios resolvidos (para a barra de progresso)
      firstTry: 0,         // acertos de primeira
      missed: [],          // enunciados errados (para o resumo)
      start: Date.now(),
    };

    const bar = h('div', { class: 'bar' });
    const heartsEl = h('span', { class: 'hearts', 'aria-label': 'Vidas' });
    const stage = h('div', { class: 'stage' });
    const footer = h('footer', { class: 'play-footer' });

    root.replaceChildren(h('div', { class: 'player' },
      h('header', { class: 'play-head' },
        h('a', { class: 'icon-btn close', href: exitHref, title: 'Sair', onClick: e => { if (state.solved && !confirm('Sair da lição? Seu progresso nesta lição será perdido.')) e.preventDefault(); } }, '✕'),
        h('div', { class: 'progress' }, bar),
        heartsEl),
      stage,
      footer));

    function drawHud() {
      bar.style.width = `${Math.round(100 * state.solved / questions.length)}%`;
      heartsEl.textContent = `❤ ${state.hearts}`;
    }

    function next() {
      drawHud();
      if (state.hearts <= 0) return gameOver();
      if (state.pos >= state.queue.length) return finish();
      const item = state.queue[state.pos];
      let checkFn = null;
      let keyFn = null;
      let answered = false;

      const checkBtn = h('button', { class: 'btn primary wide', disabled: true, onClick: () => doCheck() }, 'Verificar');
      const api = {
        setReady: ok => { checkBtn.disabled = !ok; },
        onCheck: fn => { checkFn = fn; },
        onKey: fn => { keyFn = fn; },
        finish: result => showResult(result),
      };
      const el = Exercises.TYPES[item.q.type].render(item.q, api);
      stage.replaceChildren(item.retry ? h('p', { class: 'retry-tag' }, '↻ Vamos tentar de novo') : '', el);
      stage.scrollTop = 0;
      footer.className = 'play-footer';
      footer.replaceChildren(h('div', { class: 'footer-inner' },
        h('button', { class: 'btn ghost', onClick: () => showResult({ correct: false, answer: skipAnswer(item.q, checkFn) }) }, 'Pular'),
        checkFn || item.q.type !== 'associar' ? checkBtn : ''));

      setKeyHandler(e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (answered) return;
          if (!checkBtn.disabled && checkBtn.isConnected) doCheck();
          return;
        }
        if (keyFn && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') keyFn(e.key);
      });

      function doCheck() {
        if (answered || !checkFn) return;
        showResult(checkFn());
      }

      function showResult(result) {
        if (answered) return;
        answered = true;
        stage.querySelectorAll('button, input').forEach(b => { b.disabled = true; });
        if (result.correct) {
          state.solved++;
          if (!item.retry) state.firstTry++;
        } else {
          state.hearts--;
          if (!item.retry) state.missed.push(item.q);
          state.queue.push({ q: item.q, retry: true });
        }
        drawHud();
        const cont = h('button', { class: `btn wide ${result.correct ? 'success-solid' : 'danger-solid'}`, onClick: () => { state.pos++; next(); } }, 'Continuar');
        footer.className = `play-footer ${result.correct ? 'ok' : 'bad'}`;
        footer.replaceChildren(h('div', { class: 'footer-inner' },
          h('div', { class: 'feedback', role: 'status' },
            h('strong', null, result.correct ? pick(['Muito bem!', 'Mandou bem!', 'Correto!', 'Isso aí!']) : 'Resposta correta:'),
            result.correct ? (result.answer ? h('span', null, result.answer) : '') : h('span', null, result.answer)),
          cont));
        setTimeout(() => cont.focus(), 30);
        setKeyHandler(e => { if (e.key === 'Enter') { e.preventDefault(); cont.click(); } });
      }
    }

    function skipAnswer(q, checkFn) {
      if (q.type === 'associar') return q.pairs.map(p => `${p.a} ↔ ${p.b}`).join(' · ');
      try { return checkFn ? checkFn().answer : ''; } catch { return ''; }
    }

    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

    function summaryScreen(title, emoji, body, actions) {
      setKeyHandler(null);
      footer.replaceChildren();
      footer.className = 'play-footer hidden';
      stage.replaceChildren(h('div', { class: 'summary' }, h('div', { class: 'big-emoji' }, emoji), h('h1', null, title), body, h('div', { class: 'row center' }, actions)));
    }

    function finish() {
      const accuracy = state.firstTry / questions.length;
      const bonus = state.hearts === HEARTS ? 5 : 0;
      const xp = state.firstTry * XP_PER_QUESTION + bonus;
      const secs = Math.round((Date.now() - state.start) / 1000);
      const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      if (!isTest) Store.recordRun(course.id, lesson.id, xp, accuracy);

      const idx = course.lessons.findIndex(l => l.id === lesson.id);
      const nextLesson = course.lessons.slice(idx + 1).find(l => l.questions.some(q => !Exercises.validate(q)));
      const report = [
        `Trilha: ${course.title}`,
        `Lição: ${lesson.title}`,
        `Acertos de primeira: ${state.firstTry}/${questions.length} (${Math.round(accuracy * 100)}%)`,
        `Tempo: ${time}`,
        state.missed.length ? `Errei: ${state.missed.map(q => q.prompt || q.text || q.answer).join(' | ')}` : 'Não errei nenhuma!',
      ].join('\n');

      summaryScreen(
        accuracy === 1 ? 'Perfeito!' : 'Lição concluída!',
        accuracy === 1 ? '🏆' : '🎉',
        h('div', null,
          isTest && h('p', { class: 'muted' }, 'Modo teste: o progresso não foi registrado.'),
          h('div', { class: 'score-grid' },
            h('div', { class: 'score xp' }, h('span', null, 'XP'), h('strong', null, `⚡ ${xp}`)),
            h('div', { class: 'score acc' }, h('span', null, 'Precisão'), h('strong', null, `🎯 ${Math.round(accuracy * 100)}%`)),
            h('div', { class: 'score time' }, h('span', null, 'Tempo'), h('strong', null, `⏱ ${time}`))),
          !isTest && h('p', { class: 'muted small' }, `🔥 Sequência: ${Store.currentStreak()} dia(s)`)),
        [
          !isTest && course.sharedFrom && h('button', { class: 'btn', onClick: () => copyText(report) }, 'Copiar resultado para o professor'),
          h('button', { class: 'btn', onClick: () => render(root, courseId, lessonId, isTest) }, 'Refazer'),
          !isTest && nextLesson
            ? h('a', { class: 'btn primary', href: `#/jogar/${course.id}/${nextLesson.id}` }, 'Próxima lição →')
            : h('a', { class: 'btn primary', href: exitHref }, isTest ? 'Voltar ao editor' : 'Voltar à trilha'),
        ]);
    }

    function gameOver() {
      summaryScreen('Suas vidas acabaram', '💔',
        h('p', { class: 'muted' }, 'Sem problemas: errar faz parte. Revise e tente de novo!'),
        [
          h('a', { class: 'btn', href: exitHref }, 'Sair'),
          h('button', { class: 'btn primary', onClick: () => render(root, courseId, lessonId, isTest) }, 'Tentar de novo'),
        ]);
    }

    next();
  }

  Duo.Player = { render, cleanup: () => setKeyHandler(null) };
})();
