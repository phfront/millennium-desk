# Cenas e Controle de áudio

Módulo **Cenas**: um quadradinho com as cenas a um toque (Reunião, Dia a dia…), o mute da voz e
a engrenagem que abre o **Controle**, um modal com tudo de áudio do Windows. O mock aprovado está
em [`mock-controle.html`](./mock-controle.html).

## O que uma cena muda

Cada cena guarda o que ela muda (checkbox por item); o resto fica como está.

- **Ouvir em**: a saída padrão do Windows (fone, caixa…).
- **Minha voz**:
  - *Pelo cabo · voz + Sons*: o microfone padrão vira o cabo virtual e o "Escutar este
    dispositivo" do microfone toca nele. A reunião ouve a voz e os Sons do Desk.
  - *Microfone direto*: o microfone padrão vira o físico e o "Escutar" desliga. A reunião ouve
    só a voz.
- **Volumes**: saída, microfone, Sons no cabo e retorno no fone.
- **Apps**: volume de programas escolhidos (Spotify baixo na reunião, por exemplo).
- **Não perturbe** do Windows.

Para a troca valer na reunião, o Teams/Meet fica com o microfone em **"Padrão do sistema"**.

Na primeira vez o Desk cria duas cenas com os aparelhos do PC: **Reunião** (fone, voz + Sons,
Não perturbe ligado) e **Dia a dia** (caixa, microfone direto, Não perturbe desligado).

O quadradinho compara a cena ativa com o estado do Windows: mexeu à mão em algo que a cena
controla, ela perde o destaque e aparece "ajustado".

## Controle (modal)

Abre pela engrenagem do quadradinho ou por **Ctrl+Alt+A** (global). Abas:

- **Cenas**: lista, editor (nome, emoji, cor, ordem, o que muda), aplicar, copiar o que está
  valendo agora.
- **Áudio**: saída e voz agora; mute da voz (**Ctrl+Alt+M**, global: pelo cabo desliga o
  "Escutar", os Sons seguem; direto muta o microfone); medidores ao vivo do microfone e do que a
  reunião ouve; volumes do microfone, do cabo, dos Sons e do retorno; teste de 5 s gravando o
  que a reunião ouve; volume e mute por app; microfone físico (automático ou escolhido); os
  cabos (o da reunião e, se existir, um segundo cabo da VB-Audio para o ditado do Shello);
  proteções; teclas de atalho.
- **Não perturbe** (experimental).

Avisos no topo do modal (e "ver aviso" no quadradinho), com botão para consertar:

- a saída do Windows virou o cabo virtual (instalador de driver faz isso; o som dos apps iria
  para a reunião);
- o microfone ficou no cabo quando a cena ativa usa o direto (um ditado do Shello que não
  devolveu, por exemplo).

## Como funciona

- `src/main/audio/deskAudio.cs`: ajudante nativo, compilado na primeira vez (e quando o fonte
  muda) pelo `csc` do .NET 4 que vem no Windows, em `userData/bin/desk-audio.exe`. Fica aberto
  em `serve`, falando JSON por linha, e avisa quando aparelho, padrão ou "Escutar" mudam.
  - padrão e "Escutar": `IPolicyConfig` (interno, o mesmo do painel de Som);
  - volumes: `IAudioEndpointVolume`; apps: `IAudioSessionManager2` + `ISimpleAudioVolume`;
  - Não perturbe: `IQuietHoursSettings` (interno; perfil `PriorityOnly` liga,
    `Unrestricted` desliga);
  - "abaixar sons em chamadas": `HKCU\Software\Microsoft\Multimedia\Audio\UserDuckingPreference`
    (1 abaixa, 3 não faz nada).
- `src/main/audio/deskAudioHelper.ts`: compila, sobe, reinicia se cair, `callDeskAudio()`.
- `src/main/ipc/audioIpc.ts`: IPC `audio:*`, rota da voz, mute e atalhos globais.
- `src/shared/audioControl.ts`: tipos, ajustes (`AppSettings.audioControl`) e como achar os
  aparelhos. O cabo é achado pelo **driver** ("VB-Audio Virtual Cable"), não pelo nome: o cabo
  deste PC foi renomeado para "Reunião".
- `src/renderer/modules/scenes/`: quadradinho, modal, aplicar/comparar cenas, avisos,
  medidores (getUserMedia no aparelho achado pelo nome do painel de Som).
- `npm run renderer:dev` usa um áudio falso (`src/entrypoints/browserAudioMock.ts`); com
  `?demo` na URL, o Sons já vem com sons de exemplo.

## Fora por enquanto

- Saída por app (o Spotify na caixa e o resto no fone): no Windows isso é outra interface
  interna, que muda entre versões.
- Telas (brilho/entrada pelo DDC/CI), plano de energia, tema e Luz noturna: ficaram para depois.
- Atalho do módulo Atalhos abrindo o Controle: a engrenagem do quadradinho e o Ctrl+Alt+A
  cobrem; um tipo novo de atalho pede refazer a tabela `shortcuts` (o tipo tem CHECK no banco).

## Sons (no mesmo pacote)

- Ajustes → Sons: embaixo de colunas × linhas, a grade em miniatura. Arrastar troca de lugar;
  tocar sem arrastar abre o editor; slot vazio cria um som ali.
- Cada linha da lista: renomear direto, trocar a imagem, editar (abre o editor) e excluir.
- Imagem no botão do som (no lugar do emoji), até 2 MB: coluna `icon_data_url`, migração 13.
