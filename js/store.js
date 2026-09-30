// Persistência local (localStorage): lições do professor e estatísticas do aluno.
(function () {
  const { uid } = Duo;
  const LESSONS_KEY = 'duoprof.lessons.v1';
  const STATS_KEY = 'duoprof.stats.v1';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { Duo.toast('Não foi possível salvar no navegador.'); }
  }

  const SAMPLE = [
    {
      id: 'exemplo-ciencias', discipline: 'Ciências', title: 'Ciclo da água',
      description: 'Estados físicos e etapas do ciclo da água.',
      questions: [
        { id: uid(), type: 'multipla', prompt: 'Como se chama a passagem do estado líquido para o gasoso?', options: ['Evaporação', 'Condensação', 'Solidificação', 'Fusão'], answer: 0 },
        { id: uid(), type: 'completar', text: 'A água ferve a [100] graus Celsius e congela a [0] grau.', distractors: ['50', '10'] },
        { id: uid(), type: 'associar', prompt: 'Associe cada processo ao que acontece', pairs: [
          { a: 'Evaporação', b: 'Líquido → gasoso' },
          { a: 'Condensação', b: 'Gasoso → líquido' },
          { a: 'Solidificação', b: 'Líquido → sólido' },
          { a: 'Fusão', b: 'Sólido → líquido' },
        ] },
        { id: uid(), type: 'vf', prompt: 'As nuvens são formadas por vapor d\'água condensado.', answer: true },
        { id: uid(), type: 'ordenar', prompt: 'Monte a frase', answer: 'A chuva devolve a água ao solo', distractors: ['sol', 'nunca'] },
        { id: uid(), type: 'digitar', prompt: 'Qual a fórmula química da água?', answers: ['H2O', 'H₂O'] },
      ],
    },
    {
      id: 'exemplo-ingles', discipline: 'Inglês', title: 'Animals',
      description: 'Vocabulário básico de animais.',
      questions: [
        { id: uid(), type: 'associar', prompt: 'Associe as palavras', pairs: [
          { a: 'dog', b: 'cachorro' }, { a: 'cat', b: 'gato' }, { a: 'bird', b: 'pássaro' }, { a: 'fish', b: 'peixe' }, { a: 'horse', b: 'cavalo' },
        ] },
        { id: uid(), type: 'ordenar', prompt: 'Traduza: "O gato está na mesa"', answer: 'The cat is on the table', distractors: ['dog', 'under'] },
        { id: uid(), type: 'completar', text: 'The [bird] can fly and the [fish] can swim.', distractors: ['dog', 'cat'] },
        { id: uid(), type: 'multipla', prompt: 'Como se diz "cavalo" em inglês?', options: ['Horse', 'House', 'Mouse', 'Hose'], answer: 0 },
        { id: uid(), type: 'digitar', prompt: 'Escreva em inglês: cachorro', answers: ['dog'] },
      ],
    },
    {
      id: 'exemplo-matematica', discipline: 'Matemática', title: 'Frações',
      description: 'Leitura e equivalência de frações.',
      questions: [
        { id: uid(), type: 'multipla', prompt: 'Qual fração é equivalente a 1/2?', options: ['2/4', '1/3', '3/4', '2/3'], answer: 0 },
        { id: uid(), type: 'associar', prompt: 'Associe a fração ao decimal', pairs: [
          { a: '1/2', b: '0,5' }, { a: '1/4', b: '0,25' }, { a: '3/4', b: '0,75' }, { a: '1/5', b: '0,2' },
        ] },
        { id: uid(), type: 'vf', prompt: '3/6 é maior que 1/2.', answer: false },
        { id: uid(), type: 'completar', text: 'Na fração 3/8, o [3] é o numerador e o [8] é o denominador.', distractors: ['11', '5'] },
      ],
    },
  ];

  const Store = {
    lessons() {
      let list = read(LESSONS_KEY, null);
      if (!list) { list = SAMPLE; write(LESSONS_KEY, list); }
      return list;
    },
    get(id) { return this.lessons().find(l => l.id === id) || null; },
    save(lesson) {
      const list = this.lessons();
      const i = list.findIndex(l => l.id === lesson.id);
      lesson.updatedAt = Date.now();
      if (i >= 0) list[i] = lesson; else list.push(lesson);
      write(LESSONS_KEY, list);
      return lesson;
    },
    remove(id) { write(LESSONS_KEY, this.lessons().filter(l => l.id !== id)); },
    /** Importa uma lição de fora, sempre com id novo para não sobrescrever nada. */
    importLesson(lesson) {
      const copy = JSON.parse(JSON.stringify(lesson));
      copy.id = uid();
      copy.questions = (copy.questions || []).map(q => ({ ...q, id: uid() }));
      return this.save(copy);
    },

    stats() { return read(STATS_KEY, { xp: 0, streak: 0, lastDay: null, completed: {} }); },
    /** Registra uma lição concluída e atualiza XP e sequência de dias. */
    recordRun(lessonId, xp, accuracy) {
      const s = this.stats();
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      if (s.lastDay !== today) s.streak = s.lastDay === yesterday ? s.streak + 1 : 1;
      s.lastDay = today;
      s.xp += xp;
      const prev = s.completed[lessonId];
      s.completed[lessonId] = { best: Math.max(accuracy, prev ? prev.best : 0), times: (prev ? prev.times : 0) + 1 };
      write(STATS_KEY, s);
      return s;
    },
  };

  Duo.Store = Store;
})();
