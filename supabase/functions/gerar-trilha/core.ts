// Núcleo da geração de trilhas com IA: esquema da resposta, prompt, validação da entrada
// e normalização da saída. Sem dependências, para poder ser testado fora do Deno.

export const MODEL = "claude-opus-5-5";

export const QUESTION_TYPES = [
  "associar", "multipla", "completar", "ordenar", "vf", "sequencia", "forca", "ditado", "digitar",
] as const;
export type QuestionType = typeof QUESTION_TYPES[number];

const LANGS = ["pt-BR", "en-US", "es-ES", "fr-FR", "it-IT", "de-DE"];

export const LIMITS = {
  maxFiles: 6,
  maxFileBytes: 12 * 1024 * 1024,   // por arquivo (já decodificado)
  maxTotalBytes: 24 * 1024 * 1024,
  maxTextChars: 60_000,
  maxLessons: 6,
  maxPerLesson: 12,
};

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

// ---------- Esquema da resposta (structured outputs) ----------

const str = { type: "string" };
const strArr = { type: "array", items: str };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const q = (type: QuestionType, props: Record<string, unknown>) => obj({ type: { type: "string", const: type }, ...props });

const QUESTION_SCHEMAS: Record<QuestionType, unknown> = {
  associar: q("associar", { prompt: str, pairs: { type: "array", items: obj({ a: str, b: str }) } }),
  multipla: q("multipla", { prompt: str, options: strArr, answer: { type: "integer" } }),
  completar: q("completar", { text: str, distractors: strArr }),
  ordenar: q("ordenar", { prompt: str, answer: str, distractors: strArr }),
  vf: q("vf", { prompt: str, answer: { type: "boolean" } }),
  sequencia: q("sequencia", { prompt: str, items: strArr }),
  forca: q("forca", { prompt: str, answer: str }),
  ditado: q("ditado", { text: str, lang: { type: "string", enum: LANGS } }),
  digitar: q("digitar", { prompt: str, answers: strArr }),
};

export function responseSchema(types: QuestionType[]) {
  return obj({
    title: str,
    discipline: str,
    level: str,
    description: str,
    notes_for_teacher: str,
    lessons: {
      type: "array",
      items: obj({
        title: str,
        questions: { type: "array", items: { anyOf: types.map(t => QUESTION_SCHEMAS[t]) } },
      }),
    },
  });
}

// ---------- Prompt ----------

export const SYSTEM_PROMPT = `Você ajuda professores brasileiros de qualquer disciplina e nível a transformar material de aula em uma trilha de exercícios curtos, no estilo de aplicativos de aprendizagem com lições em sequência.

O professor envia uma "folhinha" (foto ou PDF de uma lista de exercícios ou de um texto de aula) e/ou texto colado. Sua tarefa é criar uma trilha fiel a esse material:
- Baseie o conteúdo no material enviado. Se a folhinha já tiver exercícios, aproveite-os, convertendo cada um para o tipo de exercício mais próximo. Não invente fatos que não estejam no material ou que não sejam conhecimento básico e consensual do tema.
- Organize as lições da mais simples para a mais complexa. Cada lição deve ter um título curto que diga o que o aluno pratica.
- Adeque vocabulário e dificuldade ao nível/série informado. Escreva em português do Brasil, exceto quando o conteúdo for de outro idioma (ex.: aula de inglês).
- Cada exercício deve ter uma única resposta correta, sem ambiguidade. Alternativas e palavras para confundir devem ser plausíveis, do mesmo assunto.
- Varie os tipos de exercício dentro de cada lição, usando apenas os tipos permitidos.

Formato de cada tipo:
- associar: 3 a 6 pares {a, b} (termo ↔ definição, palavra ↔ tradução, causa ↔ efeito). Os textos de "b" devem ser todos diferentes.
- multipla: pergunta, 3 a 5 alternativas e "answer" = índice (a partir de 0) da alternativa correta.
- completar: frase com as palavras que o aluno completa entre colchetes, ex.: "A água ferve a [100] °C." Até 3 lacunas; "distractors" com 1 a 3 palavras erradas plausíveis.
- ordenar: "answer" é uma frase curta (até 12 palavras) que o aluno monta com as palavras embaralhadas; "prompt" diz o que fazer (ex.: "Traduza: ..." ou "Monte a definição").
- vf: afirmação e "answer" true/false. Equilibre verdadeiras e falsas.
- sequencia: 3 a 6 itens já na ordem correta (datas, etapas, fases).
- forca: "prompt" é a dica; "answer" é uma palavra ou expressão curta (até 20 letras).
- ditado: só para conteúdo de idiomas ou alfabetização; "text" é a frase falada e "lang" o idioma.
- digitar: pergunta com resposta curta e objetiva; "answers" lista as formas aceitas (ex.: ["H2O", "H₂O"]).

Em "notes_for_teacher", escreva em 1 a 3 frases o que você não conseguiu aproveitar do material (partes ilegíveis, exercícios que dependem de desenho, etc.) ou deixe vazio.`;

export interface GenerateInput {
  files: { name: string; mediaType: string; data: string }[];
  text: string;
  discipline: string;
  level: string;
  lessons: number;
  perLesson: number;
  types: QuestionType[];
  instructions: string;
}

/** Valida e limpa o corpo da requisição do app. Lança Error com mensagem para o professor. */
export function parseInput(body: unknown): GenerateInput {
  if (!body || typeof body !== "object") throw new Error("Requisição inválida.");
  const b = body as Record<string, unknown>;
  const s = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const n = (v: unknown, min: number, max: number, def: number) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;
  };

  const rawFiles = Array.isArray(b.files) ? b.files : [];
  if (rawFiles.length > LIMITS.maxFiles) throw new Error(`Envie no máximo ${LIMITS.maxFiles} arquivos.`);
  let total = 0;
  const files = rawFiles.map((f: any, i: number) => {
    const mediaType = s(f?.mediaType, 40);
    const data = typeof f?.data === "string" ? f.data : "";
    if (!MEDIA_TYPES.includes(mediaType)) throw new Error(`Arquivo ${i + 1}: use imagem (JPG, PNG, WEBP) ou PDF.`);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error(`Arquivo ${i + 1} está corrompido.`);
    const bytes = Math.floor(data.length * 3 / 4);
    if (bytes > LIMITS.maxFileBytes) throw new Error(`Arquivo ${i + 1} é grande demais (máx. 12 MB).`);
    total += bytes;
    return { name: s(f?.name, 120) || `arquivo-${i + 1}`, mediaType, data };
  });
  if (total > LIMITS.maxTotalBytes) throw new Error("Os arquivos juntos passam de 24 MB.");

  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (text.length > LIMITS.maxTextChars) throw new Error("O texto é longo demais (máx. 60 mil caracteres).");
  if (!files.length && text.length < 20) throw new Error("Envie uma folhinha (foto ou PDF) ou cole o conteúdo da aula.");

  const types = (Array.isArray(b.types) ? b.types : []).filter((t): t is QuestionType => QUESTION_TYPES.includes(t as QuestionType));

  return {
    files,
    text,
    discipline: s(b.discipline, 80),
    level: s(b.level, 80),
    lessons: n(b.lessons, 1, LIMITS.maxLessons, 2),
    perLesson: n(b.perLesson, 3, LIMITS.maxPerLesson, 6),
    types: types.length ? [...new Set(types)] : QUESTION_TYPES.filter(t => t !== "ditado"),
    instructions: s(b.instructions, 1000),
  };
}

/** Monta o conteúdo da mensagem do usuário: arquivos primeiro, depois as instruções. */
export function buildUserContent(input: GenerateInput) {
  const blocks: unknown[] = input.files.map(f => f.mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data }, title: f.name }
    : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } });

  const lines = [
    input.text && `<conteudo_colado>\n${input.text}\n</conteudo_colado>`,
    `Disciplina: ${input.discipline || "identifique pelo material"}`,
    `Nível/série: ${input.level || "identifique pelo material"}`,
    `Número de lições: ${input.lessons}`,
    `Exercícios por lição: ${input.perLesson}`,
    `Tipos de exercício permitidos: ${input.types.join(", ")}`,
    input.instructions && `Pedidos do professor: ${input.instructions}`,
    "Crie a trilha a partir do material acima.",
  ].filter(Boolean);
  blocks.push({ type: "text", text: lines.join("\n") });
  return blocks;
}

// ---------- Normalização da saída ----------

const clean = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const cleanList = (v: unknown, max = 200) => (Array.isArray(v) ? v.map(x => clean(x, max)).filter(Boolean) : []);

/** Converte um exercício da IA para o formato do app, ou null se estiver inválido. */
export function normalizeQuestion(raw: any, allowed: QuestionType[]): Record<string, unknown> | null {
  if (!raw || !allowed.includes(raw.type)) return null;
  switch (raw.type as QuestionType) {
    case "associar": {
      const pairs = (Array.isArray(raw.pairs) ? raw.pairs : [])
        .map((p: any) => ({ a: clean(p?.a, 120), b: clean(p?.b, 120) }))
        .filter((p: any) => p.a && p.b)
        .slice(0, 8);
      const distinct = new Set(pairs.map((p: any) => p.b.toLowerCase())).size === pairs.length;
      return pairs.length >= 2 && distinct ? { type: "associar", prompt: clean(raw.prompt) || "Associe os pares", pairs } : null;
    }
    case "multipla": {
      const options = cleanList(raw.options, 200).slice(0, 6);
      const answer = Number(raw.answer);
      if (!clean(raw.prompt) || options.length < 2 || !Number.isInteger(answer) || !options[answer]) return null;
      return { type: "multipla", prompt: clean(raw.prompt), options, answer };
    }
    case "completar": {
      const text = clean(raw.text, 600);
      return /\[[^\]]+\]/.test(text) ? { type: "completar", text, distractors: cleanList(raw.distractors, 60).slice(0, 5) } : null;
    }
    case "ordenar": {
      const answer = clean(raw.answer, 200);
      return answer.split(/\s+/).length >= 2
        ? { type: "ordenar", prompt: clean(raw.prompt) || "Monte a frase", answer, distractors: cleanList(raw.distractors, 40).slice(0, 4) }
        : null;
    }
    case "vf":
      return clean(raw.prompt) && typeof raw.answer === "boolean" ? { type: "vf", prompt: clean(raw.prompt), answer: raw.answer } : null;
    case "sequencia": {
      const items = cleanList(raw.items, 160).slice(0, 8);
      return items.length >= 3 ? { type: "sequencia", prompt: clean(raw.prompt) || "Coloque na ordem correta", items } : null;
    }
    case "forca": {
      const answer = clean(raw.answer, 40);
      const letters = [...answer].filter(ch => /\p{L}|\p{N}/u.test(ch)).length;
      return clean(raw.prompt) && letters >= 2 && letters <= 30 ? { type: "forca", prompt: clean(raw.prompt), answer } : null;
    }
    case "ditado": {
      const text = clean(raw.text, 300);
      return text ? { type: "ditado", text, lang: LANGS.includes(raw.lang) ? raw.lang : "pt-BR" } : null;
    }
    case "digitar": {
      const answers = cleanList(raw.answers, 120).slice(0, 8);
      return clean(raw.prompt) && answers.length ? { type: "digitar", prompt: clean(raw.prompt), answers } : null;
    }
  }
  return null;
}

/** Converte a trilha da IA para o formato do app, descartando exercícios inválidos. */
export function normalizeCourse(raw: any, input: GenerateInput) {
  let dropped = 0;
  const lessons = (Array.isArray(raw?.lessons) ? raw.lessons : []).map((l: any, i: number) => {
    const all = Array.isArray(l?.questions) ? l.questions : [];
    const questions = all.map((x: any) => normalizeQuestion(x, input.types)).filter(Boolean);
    dropped += all.length - questions.length;
    return { title: clean(l?.title, 80) || `Lição ${i + 1}`, questions };
  }).filter((l: any) => l.questions.length);
  if (!lessons.length) throw new Error("A IA não conseguiu criar exercícios com esse material. Tente uma foto mais nítida ou cole o texto.");
  return {
    course: {
      title: clean(raw?.title, 100) || "Trilha gerada com IA",
      discipline: clean(raw?.discipline, 80) || input.discipline,
      level: clean(raw?.level, 80) || input.level,
      description: clean(raw?.description, 300),
      lessons,
    },
    notes: clean(raw?.notes_for_teacher, 600),
    dropped,
  };
}
