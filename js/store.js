// Persistência local (localStorage).
// Modelo: Trilha { id, title, discipline, level, description, lessons: [ Lição { id, title, questions: [...] } ] }
(function () {
  const { uid } = Duo;
  const COURSES_KEY = 'trilha.courses.v1';
  const STATS_KEY = 'trilha.stats.v1';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { Duo.toast('Não foi possível salvar no navegador.'); }
  }

  const q = (type, data) => ({ id: uid(), type, ...data });

  const SAMPLES = [
    {
      id: 'exemplo-ciencias', discipline: 'Ciências', level: '6º ano', title: 'Água e seus estados',
      description: 'Estados físicos da matéria e o ciclo da água.',
      lessons: [
        { id: 'l1', title: 'Estados físicos', questions: [
          q('associar', { prompt: 'Associe cada processo ao que acontece', pairs: [
            { a: 'Evaporação', b: 'Líquido → gasoso' }, { a: 'Condensação', b: 'Gasoso → líquido' },
            { a: 'Solidificação', b: 'Líquido → sólido' }, { a: 'Fusão', b: 'Sólido → líquido' }] }),
          q('multipla', { prompt: 'Como se chama a passagem do estado líquido para o gasoso?', options: ['Evaporação', 'Condensação', 'Solidificação', 'Fusão'], answer: 0 }),
          q('completar', { text: 'A água ferve a [100] graus Celsius e congela a [0] grau.', distractors: ['50', '10'] }),
          q('digitar', { prompt: 'Qual a fórmula química da água?', answers: ['H2O', 'H₂O'] }),
        ] },
        { id: 'l2', title: 'Ciclo da água', questions: [
          q('vf', { prompt: 'As nuvens são formadas por vapor d\'água condensado.', answer: true }),
          q('ordenar', { prompt: 'Monte a frase', answer: 'A chuva devolve a água ao solo', distractors: ['sol', 'nunca'] }),
          q('multipla', { prompt: 'Qual é a principal fonte de energia do ciclo da água?', options: ['O Sol', 'O vento', 'A Lua', 'O núcleo da Terra'], answer: 0 }),
        ] },
      ],
    },
    {
      id: 'exemplo-ingles', discipline: 'Inglês', level: 'Iniciante', title: 'Animals',
      description: 'Vocabulário básico de animais.',
      lessons: [
        { id: 'l1', title: 'Pets', questions: [
          q('associar', { prompt: 'Associe as palavras', pairs: [
            { a: 'dog', b: 'cachorro' }, { a: 'cat', b: 'gato' }, { a: 'bird', b: 'pássaro' }, { a: 'fish', b: 'peixe' }] }),
          q('multipla', { prompt: 'Como se diz "gato" em inglês?', options: ['Cat', 'Cap', 'Car', 'Cut'], answer: 0 }),
          q('digitar', { prompt: 'Escreva em inglês: cachorro', answers: ['dog'] }),
        ] },
        { id: 'l2', title: 'Frases', questions: [
          q('ordenar', { prompt: 'Traduza: "O gato está na mesa"', answer: 'The cat is on the table', distractors: ['dog', 'under'] }),
          q('completar', { text: 'The [bird] can fly and the [fish] can swim.', distractors: ['dog', 'cat'] }),
        ] },
      ],
    },
    {
      id: 'exemplo-historia', discipline: 'História', level: 'Ensino Médio', title: 'Brasil República',
      description: 'Da Proclamação da República à Era Vargas.',
      lessons: [
        { id: 'l1', title: 'Proclamação', questions: [
          q('multipla', { prompt: 'Quem proclamou a República no Brasil?', options: ['Marechal Deodoro da Fonseca', 'Dom Pedro II', 'Getúlio Vargas', 'Floriano Peixoto'], answer: 0 }),
          q('completar', { text: 'A República foi proclamada em [1889], encerrando o período do [Império].', distractors: ['1822', 'Estado Novo'] }),
          q('vf', { prompt: 'O primeiro presidente civil do Brasil foi Prudente de Morais.', answer: true }),
          q('associar', { prompt: 'Associe o período ao ano de início', pairs: [
            { a: 'República Velha', b: '1889' }, { a: 'Era Vargas', b: '1930' }, { a: 'Estado Novo', b: '1937' }] }),
        ] },
      ],
    },
  ];

  const Store = {
    courses() {
      let list = read(COURSES_KEY, null);
      if (!list) { list = SAMPLES; write(COURSES_KEY, list); }
      return list;
    },
    get(id) { return this.courses().find(c => c.id === id) || null; },
    save(course) {
      const list = this.courses();
      const i = list.findIndex(c => c.id === course.id);
      course.updatedAt = Date.now();
      if (i >= 0) list[i] = course; else list.push(course);
      write(COURSES_KEY, list);
      return course;
    },
    remove(id) { write(COURSES_KEY, this.courses().filter(c => c.id !== id)); },

    create() {
      return this.save({
        id: uid(), title: 'Nova trilha', discipline: '', level: '', description: '',
        lessons: [{ id: uid(), title: 'Lição 1', questions: [] }],
      });
    },

    /** Trilha recebida por link: fica guardada como "estou fazendo" (somente leitura), mantendo o progresso. */
    saveShared(course) {
      const id = 'shared-' + course.id;
      const prev = this.get(id);
      return this.save({ ...course, id, sharedFrom: course.id, createdAt: prev ? prev.createdAt : Date.now() });
    },

    /** Cria uma cópia editável (ex.: importar arquivo ou reaproveitar a trilha de outro professor). */
    duplicate(course) {
      const copy = JSON.parse(JSON.stringify(course));
      delete copy.sharedFrom;
      copy.id = uid();
      copy.lessons = (copy.lessons || []).map(l => ({ ...l, id: uid(), questions: (l.questions || []).map(x => ({ ...x, id: uid() })) }));
      return this.save(copy);
    },

    stats() { return read(STATS_KEY, { xp: 0, streak: 0, lastDay: null, progress: {} }); },
    lessonProgress(courseId, lessonId) {
      const p = this.stats().progress[courseId];
      return p ? p[lessonId] || null : null;
    },
    /** Registra lição concluída e atualiza XP e sequência de dias. */
    recordRun(courseId, lessonId, xp, accuracy) {
      const s = this.stats();
      const day = d => new Date(d).toLocaleDateString('sv'); // AAAA-MM-DD no fuso local
      const today = day(Date.now());
      if (s.lastDay !== today) s.streak = s.lastDay === day(Date.now() - 864e5) ? s.streak + 1 : 1;
      s.lastDay = today;
      s.xp += xp;
      const c = s.progress[courseId] = s.progress[courseId] || {};
      const prev = c[lessonId];
      c[lessonId] = { best: Math.max(accuracy, prev ? prev.best : 0), times: (prev ? prev.times : 0) + 1 };
      write(STATS_KEY, s);
      return s;
    },
    /** Sequência atual (zera se o aluno pulou um dia). */
    currentStreak() {
      const s = this.stats();
      const day = d => new Date(d).toLocaleDateString('sv');
      return s.lastDay === day(Date.now()) || s.lastDay === day(Date.now() - 864e5) ? s.streak : 0;
    },
  };

  Duo.Store = Store;
})();
