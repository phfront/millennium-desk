# Sons no microfone — plano

Módulo **Sons**: uma grade de botões que tocam efeitos como se saíssem do microfone do Pedro
(para soltar na daily). O Desk não mexe no microfone físico; o som vai para um cabo virtual
que os apps de reunião enxergam como microfone.

## Como o áudio chega na reunião

```
ME6S (voz) ── "Escutar este dispositivo" ──┐
                                           ├──► CABLE Input ──► CABLE Output ──► Teams/Meet
Desk (sons) ── setSinkId(CABLE Input) ─────┘
```

- **Cabo virtual:** VB-Audio Virtual Cable (já instalado neste PC). `CABLE Input` é uma saída;
  o que toca nela sai em `CABLE Output`, que o Windows trata como microfone.
- **Voz (opção B, escolhida):** o Windows mistura. Em Som → ME6S → Propriedades → Escutar,
  marcar "Escutar este dispositivo" com reprodução em `CABLE Input`. A voz passa mesmo com o
  Desk fechado; o Desk só toca os sons.
- **Na reunião:** escolher `CABLE Output` como microfone e baixar/desligar a supressão de ruído
  (ela corta efeitos achando que é barulho).
- **Nomes amigáveis:** os dois lados do cabo podem ser renomeados em Configurações → Sistema →
  Som. O texto entre parênteses `(VB-Audio Virtual Cable)` fica, e a detecção automática usa ele.

## Módulo (implementado)

- Grade de botões só com o nome, grande, em Anton maiúscula (o maior tamanho que cabe sem
  quebrar palavra), e a forma de onda do próprio áudio no pé. Parado: fundo do tema tingido e o
  nome no degradê das duas cores; tocando, o botão vira a cor 1 e as letras enchem da esquerda
  para a direita junto com a onda (o nome é a barra de progresso). Tocar de novo para; com algo
  tocando, aparece o botão de parar tudo no cabeçalho. Mock em `docs/mocks/sons-poster.html`
  (opção "D + E").
- **Segurar um botão** (450 ms parado, ou botão direito) abre um menu logo acima dele: Editar
  (abre os ajustes já no editor do som), Ouvir no fone (só no retorno, nunca no microfone), Tirar
  da grade (vai para o catálogo), Excluir (confirma no próprio menu) e um X para fechar. Segurar
  e mexer fecha o menu e arrasta: o botão vira um fantasma no dedo, a grade mostra a troca e
  soltar troca os dois de lugar. Deslizar antes do tempo não toca nem mexe; com o menu aberto,
  tocar fora só fecha o menu.
- **Catálogo:** todo som cadastrado fica no catálogo; a grade mostra só os ligados (`active`,
  migração 15). Desligado, o som guarda o último lugar e volta para ele ao ligar, se estiver
  livre (senão vai para o primeiro livre; grade cheia avisa). O "+" de um lugar vazio, com sons
  fora da grade, abre a lista do catálogo acima dele (escolher põe o som ali) e "Novo som".
- Cada som toca em duas saídas: o cabo (volume do som × volume no microfone) e, se ligado, o
  retorno no fone (volume do som × volume no fone), para o Pedro ouvir o que os outros ouvem.
- **Ajustes → Sons:** saída do cabo (sem escolha, pega o `CABLE Input`), volume no microfone,
  retorno liga/desliga, saída e volume do retorno, colunas × linhas e o catálogo: cada som com
  o interruptor "na grade", renomear, editar e excluir.
- **Editor de som:** arquivo (mp3, wav, ogg, m4a, aac, flac, webm; até 20 MB), nome (vem do
  arquivo), volume próprio, posição na grade (escolher um slot ocupado troca os dois; vindo do catálogo, tira o ocupante;
  "Fora da grade" deixa só no catálogo) e uma cor
  só: as 14 da paleta (`SOUND_PALETTE`, com a segunda cor escolhida a dedo) ou outra qualquer, que
  ganha a segunda por `soundSecondColor`. Emoji e imagem saíram (as colunas ficaram no banco, sem
  uso). "Ouvir" toca só no retorno, nunca no microfone.

Como ficou:

- `src/main/repositories/soundRepository.ts`: tabela `sounds` (migração 12; a 11 é de Passagens); o áudio é copiado
  para `userData/sounds/<uuid>.<ext>` e apagado junto com o som ou ao trocar o arquivo.
- `src/main/ipc/soundsIpc.ts`: `sounds:list|save|delete|place|read-audio`. O renderer manda os
  bytes do arquivo no save e recebe os bytes no read (vira blob URL, em cache por arquivo).
- `src/renderer/modules/soundboard/soundPlayer.ts`: tocador fora do React (não para quando a
  grade remonta o módulo). Acha o dispositivo pelo id e, se o Windows trocou o id, pelo nome.
- Configuração em `AppSettings.soundboard` (global, não por perfil).

## Testado

Num Electron isolado (sem o banco real): tocar no `CABLE Input` aparece no `CABLE Output`
(silêncio 0 → RMS 0,355 com um tom de 440 Hz), e o fluxo completo pelo mock do renderer —
cadastrar, tocar, parar com o segundo toque — gravando o `CABLE Output`.

## Depois

- Busca de sons no MyInstants (sem API oficial: raspagem, pode quebrar).
- Arrastar para organizar a grade, como no organizador dos Atalhos.
- Atalho de teclado global para tocar sem olhar o Desk.
