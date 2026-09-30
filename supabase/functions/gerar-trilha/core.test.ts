// Rodar: node --experimental-strip-types --test supabase/functions/gerar-trilha/core.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUserContent, normalizeCourse, parseInput, QUESTION_TYPES, responseSchema } from "./core.ts";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("parseInput exige material", () => {
  assert.throws(() => parseInput({ text: "curto" }), /folhinha/);
  assert.throws(() => parseInput(null), /inválida/);
});

test("parseInput aceita imagem e limita números", () => {
  const i = parseInput({ files: [{ name: "f.png", mediaType: "image/png", data: png }], lessons: 99, perLesson: 1, types: ["forca", "xxx"] });
  assert.equal(i.lessons, 6);
  assert.equal(i.perLesson, 3);
  assert.deepEqual(i.types, ["forca"]);
});

test("parseInput recusa tipo de arquivo e base64 inválidos", () => {
  assert.throws(() => parseInput({ files: [{ mediaType: "text/html", data: png }] }), /imagem/);
  assert.throws(() => parseInput({ files: [{ mediaType: "image/png", data: "<script>" }] }), /corrompido/);
});

test("tipos padrão excluem ditado", () => {
  const i = parseInput({ text: "O ciclo da água tem evaporação, condensação e precipitação." });
  assert.ok(!i.types.includes("ditado"));
  assert.equal(i.types.length, QUESTION_TYPES.length - 1);
});

test("conteúdo: arquivos antes do texto; PDF vira document", () => {
  const i = parseInput({ files: [{ name: "a.pdf", mediaType: "application/pdf", data: png }], text: "Texto da aula sobre frações e decimais." });
  const c = buildUserContent(i) as any[];
  assert.equal(c[0].type, "document");
  assert.equal(c.at(-1).type, "text");
  assert.match(c.at(-1).text, /conteudo_colado/);
});

test("esquema: todo objeto tem required e additionalProperties false", () => {
  const walk = (s: any) => {
    if (!s || typeof s !== "object") return;
    if (s.type === "object") {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual(new Set(s.required), new Set(Object.keys(s.properties)));
    }
    Object.values(s).forEach(walk);
  };
  walk(responseSchema([...QUESTION_TYPES]));
});

test("normalizeCourse converte e descarta inválidos", () => {
  const input = parseInput({ text: "conteúdo de teste suficiente para gerar", types: ["multipla", "completar", "forca", "associar"] });
  const out = normalizeCourse({
    title: "Frações", discipline: "Matemática", level: "6º ano", description: "d", notes_for_teacher: "",
    lessons: [
      { title: "L1", questions: [
        { type: "multipla", prompt: "1/2 = ?", options: ["0,5", "0,2"], answer: 0 },
        { type: "multipla", prompt: "sem resposta", options: ["a", "b"], answer: 5 },
        { type: "completar", text: "sem lacuna", distractors: [] },
        { type: "forca", prompt: "dica", answer: "Numerador" },
        { type: "associar", prompt: "", pairs: [{ a: "1", b: "x" }, { a: "2", b: "X" }] },
        { type: "vf", prompt: "não permitido", answer: true },
      ] },
      { title: "vazia", questions: [] },
    ],
  }, input);
  assert.equal(out.course.lessons.length, 1);
  assert.equal(out.course.lessons[0].questions.length, 2);
  assert.equal(out.dropped, 4);
});

test("normalizeCourse falha sem exercícios", () => {
  const input = parseInput({ text: "conteúdo de teste suficiente para gerar" });
  assert.throws(() => normalizeCourse({ lessons: [] }, input), /não conseguiu/);
});
