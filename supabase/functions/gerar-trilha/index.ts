// Supabase Edge Function: gera uma trilha a partir de uma folhinha (foto/PDF) ou texto.
// Segredo necessário: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
// Opcional: ALLOWED_ORIGINS (lista separada por vírgula; ex.: https://usuario.github.io)
import Anthropic from "npm:@anthropic-ai/sdk@^0.129.0";
import { buildUserContent, MODEL, normalizeCourse, parseInput, responseSchema, SYSTEM_PROMPT } from "./core.ts";

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map(s => s.trim()).filter(Boolean);

function cors(origin: string | null) {
  const ok = allowed.includes("*") || (origin && allowed.includes(origin));
  return {
    "Access-Control-Allow-Origin": ok ? (allowed.includes("*") ? "*" : origin!) : "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Limite simples por IP (memória da instância). Na fase de contas, trocar por cota por professor.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;
function rateLimited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

Deno.serve(async req => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon";
  if (rateLimited(ip)) return reply(429, { error: "Muitas gerações seguidas. Tente de novo em alguns minutos." });

  let input;
  try {
    input = parseInput(await req.json());
  } catch (e) {
    return reply(400, { error: e instanceof Error ? e.message : "Requisição inválida." });
  }

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: responseSchema(input.types) },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(input) as Anthropic.Beta.BetaContentBlockParam[] }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return reply(422, { error: "A IA não pôde processar este material. Revise o conteúdo e tente de novo." });
    }
    if (message.stop_reason === "max_tokens") {
      return reply(422, { error: "A trilha ficou grande demais. Peça menos lições ou menos exercícios." });
    }
    const text = message.content.flatMap(b => (b.type === "text" ? [b.text] : [])).join("");
    const result = normalizeCourse(JSON.parse(text), input);
    return reply(200, { ...result, usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return reply(429, { error: "Serviço de IA ocupado. Tente de novo em instantes." });
    if (e instanceof Anthropic.BadRequestError) {
      console.error("bad request", e.message);
      return reply(400, { error: "O arquivo não pôde ser lido pela IA. Tente outra foto ou um PDF menor." });
    }
    if (e instanceof Anthropic.APIConnectionError) {
      console.error("connection error", e.message);
      return reply(503, { error: "Não foi possível falar com o serviço de IA. Tente de novo." });
    }
    if (e instanceof Anthropic.APIError) {
      console.error("api error", e.status, e.message);
      return reply(502, { error: "Falha no serviço de IA. Tente de novo." });
    }
    if (e instanceof SyntaxError) return reply(502, { error: "A resposta da IA veio incompleta. Tente de novo." });
    if (e instanceof Error) return reply(422, { error: e.message });
    return reply(500, { error: "Erro inesperado." });
  }
});
