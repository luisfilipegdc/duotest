# DuoProf — Plano

Plataforma no estilo Duolingo para **qualquer professor, de qualquer matéria**, criar lições gamificadas.

## Tipos de exercício (MVP)
- **Associar pares** — palavra ↔ tradução, país ↔ capital, fração ↔ decimal
- **Múltipla escolha** — 2 a 6 opções
- **Complete a frase** — lacunas marcadas com `[colchetes]` + banco de palavras
- **Ordenar palavras** — montar a frase/sequência correta
- **Verdadeiro ou falso**
- **Digitar resposta** — ignora maiúsculas, acentos e pontuação final

## Papéis
- **Professor:** cria lições, testa, compartilha por link/QR/código, vê resultados (fase 2)
- **Aluno:** joga com vidas, XP, sequência de dias e revisão dos erros

## Arquitetura (recomendação: A agora, B depois)
- **A. Só navegador:** localStorage + lição compactada dentro do link. Sem servidor.
- **B. Com backend (ex.: Supabase):** login, turmas, painel de resultados.

## Fases
1. MVP navegador: editor, 6 tipos, modo jogo, link, importar/exportar JSON, exemplos
2. Turmas e resultados (backend)
3. Engajamento: trilhas, ranking, conquistas, revisão espaçada
4. Produtividade: importar planilha, gerar exercícios com IA

## Perguntas em aberto
1. Público (Fundamental, Médio, Superior)?
2. Resultados do aluno já no MVP?
3. Celular ou computador?
4. Nome do produto?
5. Uso interno ou produto para muitos professores?

## Status
Esqueleto inicial em `index.html` e `js/` (utilitários, armazenamento, compartilhamento). Telas ainda não implementadas — aguardando fechamento do plano.
