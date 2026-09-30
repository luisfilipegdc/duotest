# ⛰ Trilha

Plataforma web para **qualquer professor, de qualquer matéria**, criar trilhas de exercícios
curtos no estilo Duolingo. O aluno estuda um pouco todo dia, no celular ou no computador.

## Como usar
Abra `index.html` no navegador (funciona sem servidor e sem instalar nada),
ou publique a pasta no GitHub Pages / Netlify / Vercel.

**Professor**
1. **+ Nova trilha** → dê nome, disciplina e nível.
2. Crie lições e adicione exercícios (salvamento automático).
3. **Testar lição** para jogar como aluno.
4. **Compartilhar** → envie o link. A trilha vai compactada dentro do link, sem cadastro.

**Aluno**
Abre o link, a trilha aparece em "Estou fazendo". As lições liberam em sequência,
com vidas, XP, sequência de dias e repetição dos exercícios errados.

## Tipos de exercício
| Tipo | Como o professor cria |
|---|---|
| 🔗 Associar pares | Lista de pares item ↔ par |
| 🔘 Múltipla escolha | Pergunta + 2 a 6 alternativas, marca a correta |
| ✏️ Complete a frase | Frase com as lacunas entre `[colchetes]` + palavras para confundir |
| 🧩 Ordenar palavras | Frase correta (+ palavras para confundir) |
| ⚖️ Verdadeiro ou falso | Afirmação + V/F |
| ⌨️ Digitar resposta | Pergunta + respostas aceitas (ignora maiúsculas e acentos) |
| 📅 Linha do tempo / sequência | Itens na ordem correta (datas, etapas, fases) — o aluno recebe embaralhado |
| 🔤 Forca | Dica + palavra secreta (acentos revelados junto com a letra) |
| 🎧 Ditado | Frase + idioma; o aluno ouve (voz do navegador) e escreve |

Em qualquer exercício: **🖼 imagem** (link ou enviada do computador, reduzida automaticamente) e
botão **🔊 Ouvir** (lê a pergunta em voz alta — acessibilidade).

Trilhas de exemplo: Ciências, Inglês, História, Língua Portuguesa, Matemática e Geografia.

## Estrutura
```
index.html
css/style.css
js/ui.js         utilitários (criação de elementos, toast, modal)
js/store.js      armazenamento local (trilhas, XP, sequência, progresso) + trilhas de exemplo
js/share.js      link compartilhável (compactado) e arquivo .json
js/exercises.js  tipos de exercício: validação e tela do aluno
js/home.js       tela inicial
js/course.js     mapa da trilha
js/editor.js     editor do professor
js/player.js     modo aluno (lição)
js/app.js        rotas
```

Sem dependências e sem etapa de build. Os dados ficam no navegador (localStorage).
Planejamento e próximos passos em [PLANO.md](PLANO.md); pesquisa em [CONCORRENTES.md](CONCORRENTES.md).

## Publicar (GitHub Pages)
Settings → Pages → *Deploy from a branch* → escolha a branch e a pasta `/ (root)` → Save.
O site fica em `https://<usuario>.github.io/<repositorio>/`. O arquivo `.nojekyll` faz o GitHub servir os arquivos como estão.
