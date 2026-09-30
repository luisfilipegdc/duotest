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
          q('sequencia', { prompt: 'Coloque as etapas do ciclo da água na ordem', items: ['Evaporação da água dos oceanos', 'Condensação do vapor nas nuvens', 'Precipitação (chuva)', 'Infiltração no solo'] }),
          q('forca', { prompt: 'Nome da água que cai das nuvens em forma de gelo', answer: 'Granizo' }),
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
          q('ditado', { text: 'The cat is black', lang: 'en-US' }),
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
          q('sequencia', { prompt: 'Coloque os acontecimentos em ordem cronológica', items: ['Independência do Brasil', 'Abolição da escravidão', 'Proclamação da República', 'Revolução de 1930'] }),
          q('forca', { prompt: 'Sobrenome do marechal que proclamou a República', answer: 'Deodoro da Fonseca' }),
        ] },
      ],
    },
    {
      id: 'exemplo-portugues', discipline: 'Língua Portuguesa', level: '5º ano', title: 'Classes de palavras',
      description: 'Substantivo, adjetivo e verbo na prática.',
      lessons: [
        { id: 'l1', title: 'Substantivo, adjetivo e verbo', questions: [
          q('associar', { prompt: 'Associe cada palavra à sua classe', pairs: [
            { a: 'casa', b: 'substantivo' }, { a: 'bonito', b: 'adjetivo' }, { a: 'correr', b: 'verbo' }, { a: 'rapidamente', b: 'advérbio' }] }),
          q('completar', { text: 'Na frase "O menino [alegre] [correu] pelo parque", há um adjetivo e um verbo.', distractors: ['parque', 'pelo'] }),
          q('multipla', { prompt: 'Qual palavra é um substantivo próprio?', options: ['Brasil', 'cidade', 'bonito', 'andar'], answer: 0 }),
          q('forca', { prompt: 'Classe de palavra que indica ação, estado ou fenômeno da natureza', answer: 'Verbo' }),
          q('ditado', { text: 'A professora explicou a lição com paciência.', lang: 'pt-BR' }),
        ] },
      ],
    },
    {
      id: 'exemplo-matematica', discipline: 'Matemática', level: '6º ano', title: 'Frações',
      description: 'Leitura, equivalência e comparação de frações.',
      lessons: [
        { id: 'l1', title: 'Entendendo frações', questions: [
          q('completar', { text: 'Na fração 3/8, o [3] é o numerador e o [8] é o denominador.', distractors: ['11', '5'] }),
          q('associar', { prompt: 'Associe a fração ao número decimal', pairs: [
            { a: '1/2', b: '0,5' }, { a: '1/4', b: '0,25' }, { a: '3/4', b: '0,75' }, { a: '1/5', b: '0,2' }] }),
          q('sequencia', { prompt: 'Coloque as frações da menor para a maior', items: ['1/8', '1/4', '1/2', '3/4'] }),
          q('multipla', { prompt: 'Qual fração é equivalente a 1/2?', options: ['2/4', '1/3', '3/4', '2/3'], answer: 0 }),
          q('digitar', { prompt: 'Quanto é 1/2 + 1/4? (responda como fração)', answers: ['3/4'] }),
          q('vf', { prompt: '3/6 é maior que 1/2.', answer: false }),
        ] },
      ],
    },
    {
      id: 'exemplo-geografia', discipline: 'Geografia', level: 'Ensino Fundamental II', title: 'Regiões do Brasil',
      description: 'Estados, capitais e características das regiões.',
      lessons: [
        { id: 'l1', title: 'Capitais', questions: [
          q('associar', { prompt: 'Associe o estado à capital', pairs: [
            { a: 'Bahia', b: 'Salvador' }, { a: 'Pará', b: 'Belém' }, { a: 'Paraná', b: 'Curitiba' }, { a: 'Goiás', b: 'Goiânia' }, { a: 'Ceará', b: 'Fortaleza' }] }),
          q('multipla', { prompt: 'Qual é a maior região do Brasil em área?', options: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste'], answer: 0 }),
          q('forca', { prompt: 'Capital do Brasil', answer: 'Brasília' }),
          q('cruzadinha', { prompt: 'Complete a cruzadinha das regiões', words: [
            { answer: 'Nordeste', clue: 'Região com nove estados, entre eles Bahia e Ceará' },
            { answer: 'Sul', clue: 'Região mais fria do Brasil' },
            { answer: 'Norte', clue: 'Maior região em área' },
            { answer: 'Sudeste', clue: 'Região mais populosa' },
            { answer: 'Amazonas', clue: 'Maior estado do Brasil' }] }),
          q('vf', { prompt: 'O Brasil é dividido em cinco regiões.', answer: true }),
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
