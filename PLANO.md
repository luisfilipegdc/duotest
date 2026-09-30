# Trilha — Plano

> "O Duolingo da sua matéria": o professor monta a trilha em minutos, o aluno estuda um pouco todo dia.

## Decisões
- **Nome:** Trilha
- **Público:** todos (Fundamental, Médio, Superior, cursos livres)
- **Plataforma:** web primeiro, responsivo (celular no navegador)
- **Modelo:** produto para muitos professores
- **Notas/resultados:** fora do MVP (sem login, sem backend)

## Modelo de conteúdo
Trilha (disciplina + nível) → Lições (em sequência, desbloqueio progressivo) → Exercícios

## Tipos de exercício (MVP)
- **Associar pares**
- **Múltipla escolha** (2 a 6 opções)
- **Complete a frase** — lacunas com `[colchetes]` + banco de palavras com distratores
- **Ordenar palavras**
- **Verdadeiro ou falso**
- **Digitar resposta** — ignora maiúsculas, acentos e pontuação final

## Experiência do aluno
Mapa da trilha (lições desbloqueiam em sequência), vidas, XP, sequência de dias,
correção imediata e repetição dos erros no fim da lição.

## Experiência do professor
Criar trilha → lições → exercícios, com salvamento automático, "Testar lição",
compartilhar por link (a trilha vai compactada dentro do link) e exportar/importar arquivo.

## Fases
1. ✅ **MVP web sem backend** (entregue)
2. **Contas e turmas:** login do professor, código da turma, painel de resultados, links curtos, QR Code
3. **Engajamento:** ranking da turma, conquistas, revisão espaçada
4. **Produtividade:** importar planilha, gerar exercícios com IA, biblioteca pública de trilhas (por matéria/série/BNCC)
5. **Monetização (produto):** núcleo gratuito e sem limite de atividades; plano Escola (gestão, relatórios, IA)

## Prioridades após a análise do mural (ver REFERENCIAS.md)
1. ✅ **IA: gerar trilha a partir de texto, PDF ou "folhinha" (imagem)** — código pronto, **ativação adiada** (Supabase + chave da API); ⏳ planilha
2. **Modelo "público = grátis e ilimitado"**; privado, turmas e IA no plano pago
3. ✅ Novos tipos: imagem, linha do tempo, forca, ditado, ler em voz alta — ⏳ fórmulas, cruzadinha, clicar na imagem, vídeo
4. Lição do dia pelo WhatsApp (link + lembrete)
5. Modos de jogo sobre as mesmas questões (corrida, forca, desafio da turma)
6. Acessibilidade (leitura em voz alta, fonte para dislexia, alto contraste)
7. Programa de professores formadores/embaixadores

## Concorrentes
Ver `CONCORRENTES.md`.
