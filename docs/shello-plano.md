# Shello no Millennium Desk — plano

O Desk só **exibe** o Shello (Claude Web, `C:\projects\claude-web-term`, em `http://127.0.0.1:7681`).
Toda visão nova é construída lá; aqui fica só onde ela aparece.

## Visões do Shello usadas

| Visão | Endereço | Uso no Desk |
| --- | --- | --- |
| Resumo | `/?embed#resumo` | módulo na grade (coluna esquerda ou onde for posto) |
| Só limites | `/?embed#limites-mini` | módulo na grade, pequeno num canto (só a tabela de limites) |
| App completo | `/` | gaveta lateral |

O Resumo mostra as sessões no alto (com rolagem) e os limites presos embaixo, em duas colunas.
Em altura menor que 300 px, vira faixa. O título da página traz `(n)` com quantas sessões
esperam resposta: é dali que o Desk tira o selo.

## Módulo no Desk (implementado)

O Pedro escolheu ter **os dois formatos, escolhidos nas configurações** (Ajustes → Shello, ou a
engrenagem do módulo em Editar grid). Usa um ou outro:

- **Módulo na grade:** o Resumo como um módulo comum. Entra pela bandeja de módulos ocultos
  em Editar grid e fica onde ele posicionar.
- **Gaveta lateral:** sai da grade; uma aba laranja na borda direita (com o número de sessões
  esperando) abre o app completo por cima da tela. Tocar fora da gaveta, no Desk, fecha.

Como ficou:

- `src/main/shelloView.ts`: uma WebContentsView (partição `persist:shello`) que carrega o Resumo
  ou o app completo conforme o modo; a aba é outra view nativa (página `data:` de um botão).
- O renderer manda `shello.sync({ mode, bounds, visible })`: na grade, o slot do módulo; na
  gaveta, a área da grade (o main encaixa a gaveta na borda direita).
- Esc vai para o Shello (interrompe o Claude), não sai da tela cheia; F11 continua valendo.
- Sem o keepalive de visibilidade dos players (`playbackKeepalive: false`).
- Fora do ar: a view some, o módulo mostra o aviso e tenta de novo a cada 10 s; a aba fica cinza.
- Contador de sessões esperando: lido do título da página (`(n) Claude Web`).
- A gaveta volta para a frente quando a Smart TV sobe (`onEmbeddedViewRaised` no embeddedWeb).
- No modo grade, Ajustes → Shello escolhe o que o módulo mostra: **Resumo** ou **Só limites**
  (`gridView`). A aba só de limites é a mesma tabela do Resumo, sem cabeçalho nem sessões.
- Configuração em `AppSettings.shello` (`mode`, `gridView`, `url`; só endereço deste PC).

## Testar sem o Desk

1. `data/config.json` do Shello com `"frameAncestors": ["http://127.0.0.1:5280"]` (e reiniciar o Shello).
2. `npm run docs:serve` e abrir `http://127.0.0.1:5280/shello-casca.html`.
3. Mudança no front do Shello aparece com "Recarregar quadros"; no servidor dele, só reiniciando.
