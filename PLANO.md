# Painel Touchscreen Modular

## 1. Visao do produto

Criar um aplicativo desktop para transformar um monitor touchscreen em um painel
pessoal configuravel. A tela sera composta por uma grid de modulos que podem ser
adicionados, posicionados, redimensionados e configurados.

O aplicativo deve funcionar bem sem teclado ou mouse, permanecer aberto por
longos periodos e servir como base para novos modulos no futuro.

## 2. Objetivos

- Centralizar tarefas e atalhos de uso diario em uma tela dedicada.
- Permitir que a disposicao dos modulos seja configurada pelo usuario.
- Oferecer interacao confortavel por toque.
- Integrar recursos web e, futuramente, recursos do computador e da casa.
- Manter uma arquitetura simples para adicionar novos modulos.
- Funcionar localmente mesmo sem conexao, exceto nos modulos que dependem da web.

## 3. Fora do escopo inicial

- Sincronizacao entre varios computadores.
- Aplicativos para celular.
- Marketplace ou instalacao de modulos de terceiros.
- Execucao de codigo arbitrario fornecido por modulos.
- Contas de varios usuarios no mesmo painel.
- Edicao remota do painel.
- Integracoes com automacao residencial.

Esses itens podem ser avaliados depois que o uso real do MVP estiver claro.

## 4. Experiencia principal

### Modo de uso

- O painel abre em um monitor por vez e pode ser movido facilmente para qualquer
  monitor conectado.
- O aplicativo lembra o ultimo monitor utilizado.
- O layout se adapta a diferentes resolucoes, escalas e orientacoes.
- A janela opera em tela cheia comum no MVP, com controles discretos para mover,
  minimizar ou fechar o painel.
- Os modulos exibem apenas os controles necessarios para o uso diario.
- Gestos acidentais nao movem nem redimensionam os modulos.
- Um controle persistente permite voltar ao painel quando outro conteudo estiver
  aberto.

### Modo de edicao

- Ativado por um botao de configuracao ou toque longo em uma area vazia.
- Permite adicionar, remover, mover e redimensionar modulos.
- Exibe os limites da grid, uma alca grande para mover e alcas de
  redimensionamento adequadas para toque.
- Encaixa os modulos automaticamente nas celulas e reorganiza os espacos vazios.
- Permite desfazer e refazer alteracoes durante a sessao de edicao.
- Oferece acoes para alinhar modulos e restaurar o layout.
- Salva automaticamente a disposicao.
- Permite sair sem salvar as alteracoes feitas desde a entrada no modo de edicao.

### Diretrizes de entrada

- Areas tocaveis com pelo menos 48 x 48 px.
- Todas as acoes essenciais devem funcionar tanto por toque quanto por mouse.
- A interface usara Pointer Events para unificar mouse, toque e caneta.
- Nenhuma acao deve depender exclusivamente de `hover` ou de gesto multitoque.
- Gestos multitoque poderao oferecer atalhos, mas sempre terao um controle
  equivalente visivel.
- Arrastar e redimensionar devem exigir uma alca explicita no toque e funcionar
  com o botao principal do mouse.
- O mouse pode exibir dicas por `hover`, cursores e controles mais compactos sem
  prejudicar a experiencia por toque.
- Espacamento suficiente entre acoes destrutivas e acoes frequentes.
- Feedback visual imediato ao toque.
- Confirmacao para exclusoes importantes.
- Teclado virtual apenas quando houver entrada de texto.
- Contraste e tamanho de texto adequados para leitura a distancia.

## 5. Modulos do MVP

### 5.1 Tarefas do dia

O modulo representa uma lista de atividades de trabalho para cada data. Ao abrir,
ele mostra o dia atual, mas permite navegar por um calendario para consultar dias
passados e preparar listas de dias futuros.

Funcionalidades essenciais:

- Exibir uma lista independente para cada data.
- Navegar para o dia anterior, proximo dia ou uma data escolhida no calendario.
- Criar tarefas para hoje ou para qualquer data futura.
- Editar o texto de tarefas de hoje ou de datas futuras.
- Marcar, desmarcar e excluir tarefas de hoje ou de datas futuras.
- Exibir datas passadas em modo somente leitura.
- Impedir no backend qualquer alteracao de tarefa pertencente a uma data passada.
- Exibir primeiro as tarefas pendentes.
- Manter os dados apos fechar ou reiniciar o aplicativo.
- Identificar a data a que cada tarefa pertence.
- Usar a data local do computador para determinar hoje, passado e futuro.

Funcionalidades candidatas para depois do MVP:

- Tarefas recorrentes.
- Reordenacao manual.
- Prioridades ou categorias.
- Copiar tarefas de um dia para outro.
- Usar uma lista como modelo para dias futuros.
- Integracao com outro servico de tarefas.

Na virada do dia, a lista anterior passa automaticamente para somente leitura.
Tarefas pendentes permanecem registradas no dia original e nao sao migradas.

### 5.2 YouTube

Funcionalidades essenciais:

- Um modulo na grid que exibe e controla o proprio navegador do YouTube.
- Navegar, pesquisar e reproduzir videos dentro da area do modulo.
- Manter cookies e sessao entre execucoes, quando permitido pelo Google.
- Disponibilizar controles do painel fora da area remota para recarregar, voltar
  ao inicio do YouTube e fechar ou reiniciar a sessao.
- Tratar abertura de novas janelas e links externos de forma controlada.
- Continuar reproduzindo audio e video quando o modulo estiver oculto.
- Parar a reproducao apenas por acao explicita do usuario, encerramento do
  aplicativo ou configuracao especifica do modulo.

Direcao tecnica inicial:

- Nao usar `iframe`.
- Nao habilitar a tag `<webview>` sem necessidade.
- Usar `WebContentsView` com particao persistente para exibir o YouTube
  visualmente dentro dos limites do modulo.
- Sincronizar os limites da `WebContentsView` com a posicao e o tamanho do card
  sempre que a grid mover, redimensionar ou adaptar o layout.
- Tratar os limites da `WebContentsView` no sistema de coordenadas relativo a sua
  view pai e validar explicitamente o comportamento em monitores com fatores de
  escala diferentes.
- Usar conversoes entre pixels fisicos e DIP apenas nos pontos em que houver
  coordenadas de tela, evitando aplicar escala duas vezes a coordenadas que ja
  estejam em DIP.
- Ocultar a `WebContentsView` durante a edicao da grid para que suas alcas e
  controles nao fiquem bloqueados pelo conteudo remoto.
- Manter o conteudo remoto isolado, sem Node.js, preload privilegiado ou acesso
  as APIs do dashboard.
- Manter como alternativa a abertura no navegador padrao caso o login do Google
  bloqueie ou limite o navegador incorporado.
- Nao falsificar `User-Agent` nem alterar cabecalhos para contornar bloqueios de
  autenticacao do Google.

Limitacao conhecida:

- Autenticacao do Google em navegadores incorporados pode ser recusada. O fluxo
  precisa ser validado em um prototipo antes de considerarmos o modulo concluido.
- A `WebContentsView` nao e um elemento React: ela fica sobre a interface e exige
  coordenacao explicita de posicao, visibilidade, foco e ciclo de vida.

### 5.3 Clima

Funcionalidades essenciais:

- Exibir condicao atual, temperatura, sensacao termica e umidade.
- Exibir previsao resumida para as proximas horas e dias.
- Permitir configurar uma localizacao manual.
- Oferecer opcionalmente deteccao de localizacao mediante consentimento.
- Exibir horario da ultima atualizacao e estado de carregamento ou falha.
- Manter em cache a ultima previsao para continuar apresentando dados quando a
  conexao estiver indisponivel.
- Atualizar os dados em intervalo configuravel, evitando requisicoes excessivas.
- Permitir escolher unidades metricas ou imperiais.

Direcao tecnica inicial:

- Consumir uma API meteorologica por meio do processo main.
- Nao expor chaves de API no renderer.
- Preferir um provedor que permita uso sem chave ou configurar a chave por
  variavel de ambiente e armazenamento seguro.
- Normalizar a resposta externa em um contrato interno para permitir trocar de
  provedor futuramente.
- Tratar limites de requisicao, indisponibilidade do provedor e dados antigos.

### 5.4 Browser

Funcionalidades essenciais:

- Abrir qualquer endereco HTTPS informado pelo usuario dentro de um modulo.
- Disponibilizar controles de voltar, avancar, recarregar, inicio e endereco.
- Manter cookies, cache, armazenamento local e sessoes entre execucoes.
- Permitir que o usuario continue autenticado nos sites quando o provedor
  permitir navegadores incorporados.
- Salvar e restaurar a ultima pagina aberta por instancia do modulo.
- Tratar novas janelas, downloads, permissoes e links externos de forma
  controlada.
- Exibir erros de navegacao e oferecer uma acao de recuperacao.
- Permitir limpar os dados da sessao por acao explicita nas configuracoes.

Direcao tecnica inicial:

- Usar uma `WebContentsView` isolada, sem Node.js e sem APIs privilegiadas do
  dashboard.
- Usar particao persistente dedicada ao browser para preservar autenticacao e
  demais dados da sessao.
- Avaliar particoes compartilhadas ou separadas por instancia antes de definir o
  comportamento final.
- Restringir protocolos inseguros e validar URLs antes da navegacao.
- Solicitar confirmacao para permissoes sensiveis, downloads e abertura de
  aplicativos externos.
- Sincronizar posicao, tamanho, foco e visibilidade da `WebContentsView` com a
  grid, reutilizando a infraestrutura validada pelo modulo do YouTube.
- Ocultar a superficie web durante edicao da grid e sobreposicoes do aplicativo.
- Nao tentar contornar bloqueios de autenticacao impostos pelos sites.

## 6. Arquitetura proposta

### Tecnologias

- Electron
- React
- TypeScript
- Vite
- Electron Forge com template Vite e TypeScript
- Biblioteca de grid compativel com toque, escolhida depois de um prototipo
- Motion for React para transicoes, entrada, saida e animacoes de layout
- SQLite para dados persistentes estruturados
- Zustand apenas se o estado da interface justificar uma biblioteca dedicada

As dependencias exatas serao escolhidas durante a fundacao do projeto. Evitaremos
adicionar bibliotecas antes de existir uma necessidade concreta.

### Processos do Electron

#### Main

Responsavel por:

- Ciclo de vida do aplicativo.
- Criacao e gerenciamento de janelas.
- Selecao do monitor.
- Modo tela cheia.
- Sessao do YouTube.
- Persistencia e acesso ao banco.
- Inicializacao com o sistema.
- Integracoes futuras com o computador.

#### Preload

Responsavel por expor ao frontend somente operacoes permitidas por uma API
tipada. O renderer nao tera acesso direto ao Node.js.

#### Renderer

Responsavel por:

- Interface React.
- Dashboard e grid.
- Renderizacao dos modulos.
- Modo de uso e modo de edicao.
- Formularios e feedback visual.

#### Shared

Responsavel por:

- Tipos compartilhados.
- Contratos de IPC.
- Schemas de validacao.
- Contrato dos modulos.

### Seguranca obrigatoria

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true` quando compativel com a funcionalidade
- API minima exposta pelo preload
- Validacao dos argumentos recebidos via IPC
- Nenhum acesso ao sistema baseado diretamente em dados de paginas remotas
- Navegacao e criacao de novas janelas remotas controladas
- Conteudo remoto isolado do renderer principal

## 7. Modelo de modulos

No MVP, modulos serao componentes internos registrados pelo aplicativo. Nao
serao plugins carregados dinamicamente.

Contrato conceitual inicial:

```ts
type ModuleType = "daily-tasks" | "youtube";

interface DashboardModuleInstance {
  id: string;
  type: ModuleType;
  title: string;
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  settings: Record<string, unknown>;
  enabled: boolean;
}
```

Cada tipo de modulo devera fornecer:

- Identificador unico de tipo.
- Componente React.
- Titulo e icone padrao.
- Tamanho minimo e tamanho inicial.
- Schema das configuracoes.
- Tela ou painel proprio de configuracoes.
- Migracao de configuracoes quando seu formato mudar.

As configuracoes pertencem a instancia do modulo, enquanto os dados operacionais,
como tarefas e datas, ficam em estruturas proprias no SQLite. A casca do
dashboard apenas carrega, posiciona e abre as configuracoes de cada modulo.

### Configuracoes gerais

O aplicativo tera uma tela propria de configuracoes gerais, acessivel por um
botao persistente da casca. Ela sera organizada por categorias:

- Aparencia: tema claro, escuro ou seguir o sistema.
- Comportamento: tela cheia, confirmacoes e preferencias da grid.
- Monitor: monitor atual e acao para mover o painel.
- Inicializacao: iniciar com o Windows e abrir diretamente em tela cheia.
- Acessibilidade: movimento reduzido, escala da interface e contraste.
- Dados: exportacao, importacao, backup e informacoes do armazenamento.
- Sobre: versao, logs e diagnostico.

Alteracoes visuais simples, como tema e movimento reduzido, terao previa e
aplicacao imediatas. Alteracoes destrutivas ou que afetem dados exigirao
confirmacao.

### Configuracoes por modulo

- Cada instancia exibira uma acao de configuracao no cabecalho do card ou no modo
  de edicao.
- As configuracoes abrirao em um painel lateral ou modal da casca, mantendo o
  contexto do dashboard.
- O conteudo do formulario sera fornecido pelo proprio tipo de modulo.
- Valores serao validados pelo schema do modulo antes de persistir.
- Configuracoes serao independentes por instancia, permitindo duas instancias do
  mesmo tipo com comportamentos diferentes no futuro.
- A casca fornecera acoes padrao para renomear, ativar, desativar, restaurar
  configuracoes, remover e consultar informacoes do modulo.
- O modulo de tarefas podera configurar preferencias de exibicao e ordenacao.
- O modulo do YouTube podera configurar pagina inicial, comportamento de audio e
  controles visiveis.

## 8. Direcao visual

### Principios

- Aparencia moderna, limpa e adequada para uso prolongado.
- Temas claro e escuro completos desde o MVP.
- Opcao de seguir automaticamente o tema claro ou escuro configurado no Windows.
- Tema do sistema como configuracao inicial.
- Uma cor de destaque principal e cores semanticas apenas para sucesso, aviso e
  erro.
- Cartoes com cantos arredondados, bordas sutis e sombras leves.
- Hierarquia criada por espacamento, tipografia e contraste, sem excesso de
  divisorias ou efeitos.
- Densidade adaptavel: controles grandes no toque e mais compactos quando houver
  espaco, sem criar duas interfaces diferentes.
- Icones consistentes acompanhados de texto quando a acao puder ser ambigua.
- Transparencia e desfoque usados com moderacao apenas em barras ou paineis
  sobrepostos.

### Movimento

- Animacoes devem explicar mudancas de estado, preservar contexto e confirmar
  interacoes; nao serao usadas apenas como decoracao.
- Feedback de toque ou clique entre 100 e 160 ms.
- Entradas, saidas e abertura de paineis entre 180 e 280 ms.
- Movimento e reorganizacao da grid com transicoes de mola curtas e controladas.
- Adicao, conclusao e remocao de tarefas com animacoes discretas de layout,
  opacidade e deslocamento.
- Evitar animacoes continuas, pulsacoes constantes, parallax e movimentos em
  muitos elementos ao mesmo tempo.
- Priorizar `transform` e `opacity` para manter fluidez.
- Respeitar `prefers-reduced-motion` e oferecer uma configuracao para reduzir ou
  desativar movimentos.
- Nao animar a `WebContentsView` quadro a quadro durante o arraste; usar uma
  representacao visual do modulo e sincronizar o navegador ao concluir.

### Design system

- Definir tokens para cores, espacamento, tipografia, raios, sombras, duracoes e
  curvas de animacao.
- Definir tokens semanticos equivalentes para os temas claro e escuro.
- Criar componentes compartilhados para botao, botao de icone, card, modal,
  painel lateral, campo, seletor de data, menu, tooltip e feedback de estado.
- Usar uma fonte variavel local com fallback para `Segoe UI`.
- Manter uma galeria interna dos componentes e estados visuais durante o
  desenvolvimento.
- Validar contraste, foco visivel, tamanho das areas interativas e legibilidade a
  distancia.

## 9. Persistencia

Todos os dados locais do aplicativo ficarao sob o diretorio retornado por
`app.getPath("userData")`. No Windows, o caminho esperado sera semelhante a:

```text
C:\Users\<usuario>\AppData\Roaming\electron-control
```

O caminho deve ser obtido pela API do Electron, sem ser fixado manualmente no
codigo.

### SQLite

O arquivo principal do banco sera:

```text
app.getPath("userData")/dashboard.sqlite
```

Dados armazenados no SQLite:

- Tarefas.
- Historico de tarefas.
- Instancias dos modulos.
- Posicoes e tamanhos dos modulos na grid.
- Configuracoes especificas dos modulos.
- Versao do schema.

O banco sera aberto somente pelo processo main. O renderer acessara os dados por
uma API de IPC tipada e validada, sem acesso direto ao arquivo ou ao driver
SQLite. O acesso ao banco sera organizado por repositorios e as alteracoes de
schema usarao migracoes versionadas.

### Arquivo de configuracao local

Preferencias simples ficarao em um arquivo JSON dentro de
`app.getPath("userData")`, possivelmente gerenciado por `electron-store`:

- Ultimo monitor utilizado e sua identificacao persistente.
- Tela cheia.
- Tema.
- Preferencias gerais da interface e acessibilidade.
- Iniciar com o sistema.
- Ultima versao executada.

Essas preferencias ficarao separadas do SQLite porque sao configuracoes pequenas
necessarias logo na inicializacao do aplicativo.

### Dados do navegador

Cookies, cache e autenticacao do YouTube ficarao em uma particao persistente do
Electron:

```ts
partition: "persist:youtube"
```

O Electron armazenara essa particao dentro do diretorio `userData`. Credenciais,
cookies ou tokens nao serao copiados para o SQLite nem para o arquivo de
configuracao.

### Backup e recuperacao

- O aplicativo oferecera exportacao dos dados do painel para uma pasta escolhida
  pelo usuario.
- O backup incluira o banco SQLite e as configuracoes do painel.
- A sessao do YouTube nao sera incluida por padrao, evitando copiar credenciais e
  cookies.
- O banco devera usar transacoes e ser fechado corretamente no encerramento.
- Antes de migracoes de schema, sera criado um backup de seguranca.
- A estrategia de backup automatico e sua frequencia serao definidas durante o
  refinamento do MVP.

Estrutura conceitual dentro de `userData`:

```text
electron-control/
  dashboard.sqlite
  config.json
  backups/
  partitions/
    youtube/
```

Os nomes e caminhos internos gerados pelo Electron podem variar. Essa estrutura
representa a separacao logica dos dados, nao um contrato com os caminhos internos
da sessao do Chromium.

## 10. Estrutura inicial do projeto

O aplicativo sera um monolito modular: um unico repositorio, `package.json`,
processo de build e instalador. A separacao sera feita por responsabilidades e
dominios, sem transformar cada modulo em um pacote independente no MVP.

```text
src/
  core/
    main/
      app/
      database/
      ipc/
      windows/
    preload/
    renderer/
      app/
      settings/
      ui/
      styles/
    shared/
      ipc/
      modules/
      validation/
  dashboard/
    main/
    renderer/
      components/
      grid/
      edit-mode/
    shared/
  modules/
    registry.ts
    daily-tasks/
      main/
        repository/
        ipc/
      renderer/
        components/
        settings/
      shared/
        contracts.ts
        validation.ts
      tests/
    youtube/
      main/
        browser/
        ipc/
      renderer/
        components/
        settings/
      shared/
        contracts.ts
        validation.ts
      tests/
  entrypoints/
    main.ts
    preload.ts
    renderer.tsx
tests/
  integration/
  e2e/
```

Regras de dependencia:

- `core` nao conhece detalhes internos dos modulos.
- `dashboard` conhece apenas o contrato e o registro dos modulos.
- Cada modulo pode usar APIs publicas de `core` e `dashboard`, mas nao importar
  outro modulo diretamente.
- Contratos compartilhados nao importam Electron, React, banco ou codigo de UI.
- A comunicacao entre renderer e main sempre passa por contratos IPC tipados e
  validados.
- O registro central informa componente, configuracoes, tamanho inicial, limites
  da grid e inicializadores do processo main.

Estrutura conceitual do registro:

```ts
interface DashboardModuleDefinition<TSettings> {
  type: ModuleType;
  title: string;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  settingsSchema: Schema<TSettings>;
  renderer: React.ComponentType<ModuleProps<TSettings>>;
  settingsRenderer: React.ComponentType<SettingsProps<TSettings>>;
  registerMain?: (context: MainModuleContext) => void;
}
```

Essa estrutura permite adicionar um modulo criando uma pasta e registrando sua
definicao, sem alterar a logica interna da grid.

## 11. Fases de implementacao

### Fase 0 - Decisoes e prototipos de risco

- Criar uma prova visual da casca, grid, card e modo de edicao.
- Validar animacoes em 60 FPS no hardware alvo.
- Validar legibilidade e tamanho dos controles a distancia.
- Validar a estrategia de arraste da grid com toque e mouse.
- Validar o comportamento da `WebContentsView` durante redimensionamento.
- Validar coordenadas da `WebContentsView` ao mover a janela entre monitores com
  escalas diferentes, incluindo 100%, 125% e 150%.
- Validar quais coordenadas chegam do renderer em DIP e em quais operacoes do
  processo main sao necessarias conversoes com a API `screen`.
- Validar `touch-action`, captura de ponteiro e cancelamento de gestos do
  Chromium durante arraste e redimensionamento.
- Verificar separadamente os gestos de borda reservados pelo Windows, que podem
  nao ser cancelaveis pela aplicacao em tela cheia comum.

As demais validacoes tecnicas da Fase 0 permanecem:

- Validar a identificacao dos monitores e a troca da janela entre eles no
  Windows.
- Testar diferentes resolucoes, escalas e orientacoes.
- Prototipar a movimentacao da janela para qualquer monitor conectado.
- Testar toque, tela cheia e retorno ao dashboard.
- Testar login, reproducao e persistencia da sessao do YouTube.
- Prototipar a biblioteca de grid em um dispositivo touchscreen real.

Resultado esperado:

- Saber se YouTube, grid por toque e direcao visual funcionam de forma aceitavel
  antes de construir o restante.

### Fase 1 - Fundacao

- Criar o projeto Electron Forge, Vite, React e TypeScript.
- Configurar a estrutura `core`, `dashboard`, `modules` e `entrypoints`.
- Configurar desenvolvimento, build, lint e formatacao.
- Criar IPC tipado e validado.
- Configurar persistencia local e migracoes.
- Criar tratamento global de erros e logs locais.
- Criar tokens visuais, componentes fundamentais e configuracao de movimento.
- Criar tela de configuracoes gerais e infraestrutura de configuracoes por
  modulo.
- Implementar temas claro, escuro e sincronizado com o Windows.

Resultado esperado:

- Aplicativo vazio que abre de forma confiavel, apresenta a base visual e pode
  ser empacotado.

### Fase 2 - Dashboard

- Criar shell visual do painel.
- Implementar grid responsiva.
- Implementar modos de uso e edicao.
- Adicionar, mover, redimensionar e remover modulos.
- Implementar animacoes de entrada, saida, reorganizacao e feedback.
- Implementar encaixe automatico, desfazer, refazer e restauracao do layout.
- Usar um mosaico particionado que sempre ocupa 100% da area disponivel.
- Redimensionar widgets por divisorias compartilhadas: um widget cresce enquanto
  os vizinhos cedem espaco, sem criar areas vazias.
- Trocar widgets de posicao por arraste entre slots, preservando o preenchimento
  completo da grid.
- Persistir um unico layout adaptavel.
- Recalcular um layout valido quando resolucao, escala ou orientacao mudar.

Resultado esperado:

- Dashboard configuravel, fluido e visualmente consistente com modulos de
  demonstracao.

### Fase 3 - Tarefas do dia

- Criar schema e migracao das tarefas.
- Implementar listas separadas por data.
- Implementar navegacao por dia e selecao em calendario.
- Implementar operacoes de criar, editar, concluir e excluir para hoje e futuro.
- Implementar modo somente leitura para datas passadas.
- Validar no processo main que tarefas passadas nao podem ser alteradas.
- Manter tarefas pendentes no dia original durante a virada do dia.
- Criar interface otimizada para toque e mouse.
- Animar inclusao, conclusao, remocao e mudanca de data sem excesso visual.
- Adicionar testes de datas, virada do dia e bloqueio de alteracoes passadas.

Resultado esperado:

- Modulo de tarefas utilizavel diariamente, persistente e integrado ao design
  system.

### Fase 4 - YouTube

- Criar modulo de navegador incorporado na grid.
- Criar e posicionar uma `WebContentsView` sobre a area do modulo.
- Configurar particao persistente.
- Sincronizar posicao, tamanho e visibilidade com a grid.
- Controlar navegacao, pop-ups e links externos.
- Ocultar o navegador durante a edicao do layout.
- Implementar controles locais de inicio, recarga e recuperacao.
- Validar login e reproducao em instalacao empacotada.

Resultado esperado:

- Navegacao e reproducao do YouTube dentro do modulo sem comprometer o isolamento
  do dashboard.

### Fase 5 - Clima

- Definir o provedor meteorologico e o contrato interno de dados.
- Implementar configuracao de localizacao e unidades.
- Buscar condicao atual e previsao pelo processo main.
- Implementar cache da ultima resposta valida.
- Exibir estados de carregamento, dados antigos e indisponibilidade.
- Configurar atualizacao automatica com controle de frequencia.

Resultado esperado:

- Modulo de clima legivel a distancia, resiliente a falhas de rede e adequado ao
  uso continuo no painel.

### Fase 6 - Browser

- Criar modulo de navegador generico incorporado na grid.
- Implementar barra de endereco e controles essenciais de navegacao.
- Configurar particao persistente para cookies, cache e autenticacao.
- Restaurar a ultima URL aberta por instancia.
- Implementar tratamento seguro de pop-ups, permissoes, downloads e links
  externos.
- Permitir limpar os dados da sessao nas configuracoes do modulo.
- Validar login e restauracao de sessao em instalacao empacotada.
- Validar o comportamento de sites que bloqueiam navegadores incorporados.

Resultado esperado:

- Browser generico capaz de manter sessoes permitidas pelos sites e navegar sem
  comprometer o isolamento do aplicativo.

### Fase 7 - Operacao no dispositivo

- Selecionar e lembrar o monitor atual.
- Oferecer uma acao simples para mover o painel para outro monitor.
- Adicionar opcao de iniciar com o sistema.
- Implementar tela cheia comum com saida acessivel.
- Recuperar a janela quando um monitor for desconectado.
- Mover a janela para um monitor disponivel quando o monitor atual for
  desconectado.
- Testar suspensao, retomada e reinicializacao.

Resultado esperado:

- Painel capaz de permanecer instalado e operando no touchscreen ou com mouse.

### Fase 8 - Qualidade e distribuicao

- Criar instalador para o sistema alvo.
- Definir estrategia de atualizacao.
- Revisar seguranca do Electron.
- Testar instalacao limpa e atualizacao de banco.
- Documentar backup e recuperacao dos dados.
- Executar testes prolongados de uso.
- Medir fluidez, tempo de resposta e consumo de recursos com animacoes ativas.

Resultado esperado:

- Primeira versao instalavel e adequada para uso diario.

## 12. Estrategia de testes

- Testes unitarios para regras de tarefas, datas e migracoes.
- Testes de integracao para IPC e persistencia.
- Testes de componentes para interacoes essenciais da interface.
- Testes dos contratos e do registro de modulos.
- Testes manuais obrigatorios no touchscreen para gestos e dimensoes.
- Testes manuais com mouse para mover, redimensionar e configurar modulos.
- Testes com troca de dispositivo de entrada durante a mesma sessao.
- Teste empacotado para YouTube, cookies e login.
- Testes do modulo de clima com resposta valida, cache, rede indisponivel e
  limite do provedor.
- Teste empacotado do browser para cookies, login, restauracao da ultima URL,
  pop-ups, permissoes e limpeza da sessao.
- Testes de alteracao de monitor, escala e resolucao.
- Testes de alinhamento da `WebContentsView` ao cruzar monitores com DPI
  diferentes.
- Testes de `touch-action`, `pointercancel` e captura de ponteiro durante gestos
  da grid.
- Teste de recuperacao depois de encerramento inesperado.
- Testes de desempenho das animacoes e da reorganizacao da grid.
- Testes com movimento reduzido ativado no Windows.
- Testes dos temas claro, escuro e troca automatica pelo tema do Windows.
- Testes de validacao, persistencia e restauracao das configuracoes dos modulos.

## 13. Criterios de conclusao do MVP

O MVP estara concluido quando:

- O aplicativo iniciar no ultimo monitor utilizado ou em um monitor disponivel.
- O painel poder ser movido facilmente para outro monitor conectado.
- O dashboard funcionar por toque sem teclado ou mouse para as acoes comuns.
- As mesmas acoes essenciais funcionarem por mouse em monitores sem toque.
- O layout puder ser editado e persistir entre reinicializacoes.
- A reorganizacao dos modulos oferecer encaixe automatico, desfazer e restaurar.
- Uma mudanca de resolucao ou escala nao deixar modulos fora da area visivel.
- O modulo de tarefas preservar corretamente os dados.
- O modulo permitir preparar listas para datas futuras.
- Listas de datas passadas permanecerem consultaveis e nao aceitarem alteracoes,
  inclusive por chamadas diretas de IPC.
- O YouTube navegar e reproduzir videos dentro da area do modulo.
- O navegador acompanhar corretamente o movimento e redimensionamento do modulo.
- A estrategia de autenticacao do YouTube estiver validada ou houver um fallback
  documentado para o navegador padrao.
- O aplicativo puder ser instalado e iniciar com o sistema.
- Erros de um modulo nao inutilizarem todo o painel.
- Animacoes permanecerem fluidas e nao bloquearem interacoes.
- O modo de movimento reduzido remover animacoes nao essenciais.
- Os temas claro, escuro e sistema funcionarem sem perda de contraste ou
  legibilidade.
- A tela geral e as configuracoes de cada modulo persistirem corretamente.
- Existirem controles acessiveis, mas discretos, para sair da tela cheia,
  minimizar ou fechar o aplicativo.

## 14. Riscos principais

| Risco | Impacto | Mitigacao inicial |
| --- | --- | --- |
| Google bloquear login incorporado | Alto | Prototipar primeiro e manter fallback para navegador externo |
| Grid ter gestos ruins no touchscreen | Alto | Testar bibliotecas no hardware antes da implementacao final |
| Mudanca de resolucao quebrar o layout | Medio | Usar grid normalizada, recalcular posicoes e oferecer restauracao |
| Identificacao dos monitores mudar no Windows | Medio | Combinar identificadores disponiveis e permitir nova selecao |
| DPI diferente desalinha a WebContentsView | Alto | Trabalhar em DIP, converter apenas coordenadas de tela e testar entre monitores |
| Gestos do Windows interromperem a grid | Medio | Configurar touch-action e validar limites dos gestos reservados pelo sistema |
| Conteudo remoto acessar APIs locais | Alto | Isolamento, preload minimo e IPC validado |
| Banco ser corrompido por encerramento abrupto | Medio | Transacoes, migracoes e rotina de backup |
| Consumo de memoria do Electron e YouTube | Medio | Medir no dispositivo e limitar recursos sem interromper a reproducao |
| Excesso de animacoes prejudicar clareza ou desempenho | Medio | Usar tokens, limites de duracao e testes de fluidez |

## 15. Decisoes em aberto

Estas decisoes devem ser refinadas antes ou durante a Fase 0:

1. Versao minima do Windows suportada.
2. Se o computador sera dedicado ao painel ou usado para outras atividades.
3. Se audio e video sairao pelo proprio dispositivo do painel.
4. Necessidade de backup automatico.

## 16. Ideias posteriores ao MVP

- Calendario e proximos compromissos.
- Timer, cronometro e alarmes.
- Controles de volume e midia.
- Spotify ou outro servico de musica.
- Clima.
- Atalhos para abrir aplicativos.
- Monitoramento do computador.
- Integracao com Home Assistant.
- Cenas de iluminacao e automacao.
- Status de servicos locais.
- Sincronizacao opcional de configuracoes.
- Modo kiosk para computadores dedicados ao painel.

Essas ideias nao devem entrar no MVP antes que o painel basico esteja em uso.

## 17. Registro de decisoes

Usaremos esta secao para manter decisoes importantes e seus motivos.

| Data | Decisao | Motivo |
| --- | --- | --- |
| 2026-06-10 | Usar Electron como base inicial | Melhor integracao com desktop, janelas, monitores e conteudo web |
| 2026-06-10 | Usar React e TypeScript no renderer | Componentizacao dos modulos e contratos mais claros |
| 2026-06-10 | Comecar com tarefas e YouTube | Cobrem persistencia local e integracao web, os dois eixos do produto |
| 2026-06-10 | Modulos internos no MVP | Reduz complexidade e evita execucao de codigo nao confiavel |
| 2026-06-10 | Usar Windows como plataforma inicial | E o sistema dos computadores que executarao o painel |
| 2026-06-10 | Permitir mover o painel entre monitores | O ambiente possui seis monitores, mas apenas um exibira o painel por vez |
| 2026-06-10 | Manter um layout adaptavel | O mesmo painel deve se ajustar ao monitor escolhido |
| 2026-06-10 | Facilitar reorganizacao da grid | Edicao por toque tera encaixe automatico, desfazer e restaurar layout |
| 2026-06-10 | Suportar toque e mouse igualmente | Alguns monitores terao multitoque e outros serao operados por mouse |
| 2026-06-10 | Usar tela cheia comum no MVP | Permite uso imersivo sem dificultar o acesso ao Windows |
| 2026-06-10 | Ter uma lista de tarefas por data | Permite planejar atividades de trabalho de cada dia |
| 2026-06-10 | Permitir edicao somente em hoje e no futuro | O historico de trabalho deve permanecer imutavel |
| 2026-06-10 | Nao migrar tarefas na virada do dia | Pendencias continuam registradas na data a que pertencem |
| 2026-06-10 | Exibir o YouTube dentro do modulo | O video e a navegacao devem permanecer na propria grid |
| 2026-06-10 | Usar WebContentsView para o YouTube | Permite conteudo web remoto incorporado com isolamento do dashboard |
| 2026-06-10 | Manter o YouTube tocando em segundo plano | Ocultar o modulo nao deve interromper audio ou video |
| 2026-06-10 | Usar um monolito modular | Mantem build simples e separa cada modulo por dominio |
| 2026-06-10 | Oferecer temas claro, escuro e sistema | Permite adaptar o painel ao ambiente e ao Windows |
| 2026-06-10 | Usar animacoes funcionais e contidas | Mantem a interface moderna e fluida sem excesso visual |
| 2026-06-10 | Separar configuracoes gerais e por modulo | A casca controla o aplicativo e cada modulo controla suas preferencias |
| 2026-06-10 | Nao contornar bloqueios do Google por User-Agent | O fallback deve respeitar as politicas de autenticacao e seguranca |

## 18. Proximo refinamento

As principais decisoes funcionais da Fase 0 estao definidas. O plano pode ser
convertido em backlog tecnico com tarefas pequenas, ordem de execucao e criterios
de aceite.

## 19. Execucao da Fase 0

Status iniciado em 2026-06-10.

### Prototipo implementado

- Projeto Electron Forge com Vite, React e TypeScript.
- Separacao inicial entre main, preload, renderer e contratos compartilhados.
- Preload com API minima e tipada para janela e YouTube.
- Shell visual com temas claro, escuro e sistema.
- Painel lateral de configuracoes gerais.
- Grid experimental com Pointer Events, captura de ponteiro, encaixe de 24 px,
  movimento e redimensionamento.
- Modulos demonstrativos de tarefas e YouTube.
- `WebContentsView` isolada com particao persistente `persist:youtube`.
- Ocultacao visual da `WebContentsView` durante a edicao da grid.
- Acao para alternar tela cheia e mover a janela para o proximo monitor.
- Modo de diagnostico para capturar a janela, configuracoes, tema, edicao e
  conteudo da `WebContentsView`.

### Validado automaticamente

- TypeScript sem erros com `npm run typecheck`.
- Empacotamento Windows x64 concluido com `npm run build`.
- Executavel empacotado inicia e encerra corretamente no modo de diagnostico.
- YouTube carrega dentro da `WebContentsView`.
- Tema claro, tema escuro, painel de configuracoes e modo de edicao renderizam
  corretamente.
- Dependencias de producao sem vulnerabilidades conhecidas no `npm audit
  --omit=dev`.

### Pendente de validacao manual

- Arraste, redimensionamento e multitoque no touchscreen real.
- `pointercancel`, gestos de borda e comportamento do Windows durante uso
  prolongado.
- Movimento da janela entre os seis monitores.
- Alinhamento da `WebContentsView` entre monitores com DPI 100%, 125% e 150%.
- Login do Google, persistencia da sessao e reproducao prolongada do YouTube.
- Audio em segundo plano quando o modulo estiver oculto.
- Fluidez sustentada em 60 FPS e consumo de memoria no hardware final.

### Observacoes da toolchain

- O Forge empacota corretamente, mas sua cadeia de desenvolvimento possui
  avisos de dependencias transitivas antigas; as dependencias de producao nao
  foram afetadas.
- O plugin Vite do Forge emite um aviso de opcao depreciada durante o build. O
  aviso nao bloqueia o prototipo, mas deve ser acompanhado antes da versao de
  distribuicao.
