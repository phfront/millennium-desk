# Millennium Desk

Painel touchscreen modular para Windows: grid de módulos configurável, persistência local e uso sem teclado.

## Funcionalidades

- **Grid modular** — arrastar, dividir, ocultar módulos; layout persistido
- **Tarefas** — listas por data, tags, filtros
- **Clima** — forecast via [Open-Meteo](https://open-meteo.com/) (sem API key)
- **YouTube** — player embutido na grid
- **Hub de mídia** — YouTube, Netflix, Spotify, Twitch e outros (Widevine quando build assinado)
- **Sistema** — CPU, memória, rede e disco
- **Atalhos** — apps, arquivos, URLs, BAT e PowerShell; grid com ícones e cores

Roadmap e visão de produto: [`PLANO.md`](./PLANO.md).

## Stack

- Electron (Castlabs build com Widevine)
- React 19 + TypeScript
- Vite + Electron Forge
- SQLite (`node:sqlite`)
- Motion (animações)

## Requisitos

- **Windows** (plataforma principal)
- **Node.js** 20+ e npm
- **Python 3.7+** — apenas para build com DRM (`castlabs-evs`)

## Desenvolvimento

```bash
npm install
npm start
```

```bash
npm run typecheck
npm run build
```

## Build e instalador

Sem Widevine (Spotify/Netflix limitados):

```powershell
npm run release:unsigned
```

Com DRM (conta Castlabs EVS):

```powershell
npm run evs:install
npm run evs:login
npm run release
```

Instalador: `dist/Millennium-Desk-Setup.exe`

## Dados locais

Configurações, tarefas e layout ficam em:

```text
%APPDATA%\electron-control\
  dashboard.sqlite
```

O nome do produto é Millennium Desk, mas a pasta de dados permanece `electron-control` para não perder dados de instalações anteriores.

## Variáveis de ambiente

Opcionais — ver [`.env.example`](./.env.example).

## Estrutura

```text
src/
  entrypoints/     # main, preload, renderer
  main/            # processo principal, IPC, SQLite
  renderer/        # UI React
  shared/          # contratos TypeScript
scripts/           # release e instalador Windows
```

## Licença

MIT
