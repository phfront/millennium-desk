import { ipcMain, shell, WebContentsView } from "electron";
import {
  captureEmbeddedWebPreview,
  createEmbeddedWebView,
  onEmbeddedViewRaised,
} from "./embeddedWeb";
import { getSettings } from "./settings/store";
import { shelloViewUrl } from "../shared/shello";
import type {
  ShelloState,
  ShelloSurface,
  ViewBounds,
} from "../shared/contracts";

// Shello (Claude Web) no Desk: uma view so, que carrega o Resumo (modo grade) ou o app
// completo (modo gaveta). A gaveta e a aba da borda sao views nativas porque precisam ficar
// por cima da Smart TV, que tambem e nativa (o DOM fica sempre embaixo delas).

type ShelloContext = {
  getMainWindow: () => Electron.BrowserWindow | null;
  onBeforeInputEvent?: (event: Electron.Event, input: Electron.Input) => void;
};

const DRAWER_MIN_WIDTH = 420;
const DRAWER_MAX_WIDTH = 760;
const DRAWER_RATIO = 0.42;
const HANDLE_WIDTH = 34;
const HANDLE_HEIGHT = 112;
const RETRY_MS = 10_000;

let context: ShelloContext | null = null;
let view: WebContentsView | null = null;
let handle: WebContentsView | null = null;
let loadedUrl: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let surface: ShelloSurface = { mode: "grid", bounds: null, visible: false };
let state: ShelloState = { waiting: 0, offline: false, drawerOpen: false };
const attached = new Set<WebContentsView>();

const getParent = () => context?.getMainWindow()?.contentView ?? null;
const baseUrl = () => getSettings().shello.url;
const targetUrl = () => shelloViewUrl(baseUrl(), surface.mode);

const isTrusted = (rawUrl: string) => {
  try {
    return new URL(rawUrl).origin === baseUrl();
  } catch {
    return false;
  }
};

const normalizeBounds = (bounds: ViewBounds): Electron.Rectangle => ({
  x: Math.max(0, Math.round(bounds.x)),
  y: Math.max(0, Math.round(bounds.y)),
  width: Math.max(1, Math.round(bounds.width)),
  height: Math.max(1, Math.round(bounds.height)),
});

const setState = (patch: Partial<ShelloState>) => {
  state = { ...state, ...patch };
  const window = context?.getMainWindow();
  if (window && !window.webContents.isDestroyed()) {
    window.webContents.send("shello:state", state);
  }
  updateHandle();
};

// ---------- view do Shello ----------

const clearRetry = () => {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
};

const retryNow = () => {
  clearRetry();
  if (!view || view.webContents.isDestroyed()) return;
  loadedUrl = targetUrl();
  void view.webContents.loadURL(loadedUrl).catch(() => {});
};

const markOffline = () => {
  setState({ offline: true, waiting: 0 });
  clearRetry();
  retryTimer = setTimeout(retryNow, RETRY_MS);
  apply();
};

const ensureView = () => {
  if (view && !view.webContents.isDestroyed()) return view;
  loadedUrl = targetUrl();
  const created = createEmbeddedWebView({
    partition: "persist:shello",
    homeUrl: loadedUrl,
    isTrustedNavigation: isTrusted,
    label: "Shello",
    playbackKeepalive: false,
    onBeforeInputEvent: context?.onBeforeInputEvent,
  });
  created.setBackgroundColor("#0f1115");
  const contents = created.webContents;

  // Janela pedida pelo Shello (o botao de painel completo do Resumo) vira o modal; links de
  // fora (docs, PR, preview de porta) abrem no navegador do sistema
  contents.setWindowOpenHandler(({ url }) => {
    if (isTrusted(url)) openModal(url);
    else openExternalLink(url);
    return { action: "deny" };
  });
  contents.on("did-fail-load", (_event, errorCode, _description, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    markOffline();
  });
  contents.on("dom-ready", () => {
    if (!isTrusted(contents.getURL())) return;
    clearRetry();
    if (state.offline) {
      setState({ offline: false });
      apply();
    }
  });
  // O Shello poe "(n) Claude Web" no titulo quando ha sessao esperando resposta
  contents.on("page-title-updated", (_event, title) => {
    const match = title.match(/^\((\d+)\)/);
    const waiting = match ? Number(match[1]) : 0;
    if (waiting !== state.waiting) setState({ waiting });
  });

  view = created;
  return created;
};

const openExternalLink = (url: string) => {
  if (/^https?:\/\//i.test(url) && !isTrusted(url)) void shell.openExternal(url);
};

// ---------- modal: o app completo por cima de tudo ----------
// Aberto pelo Resumo (window.open). Mesma particao, entao ja entra logado. O fundo escuro e
// uma view nativa (cobre a Smart TV): tocar nele ou no x fecha. Esc continua indo para o Shello.

const MODAL_MARGIN = 40;
const MODAL_MAX_WIDTH = 1320;

let modal: WebContentsView | null = null;
let backdrop: WebContentsView | null = null;
let modalOpen = false;
const resizeHooked = new WeakSet<Electron.BrowserWindow>();

const BACKDROP_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; height: 100%; overflow: hidden; background: rgba(6, 7, 10, .64); cursor: pointer; }
button { position: fixed; top: 14px; right: 18px; width: 44px; height: 44px; border-radius: 12px; cursor: pointer;
  border: 1px solid rgba(255, 255, 255, .16); background: rgba(24, 27, 34, .92); color: #e6e8ec;
  font: 500 24px/1 system-ui, sans-serif; }
button:hover { background: rgba(40, 44, 54, .95); }
p { position: fixed; left: 0; right: 0; bottom: 10px; margin: 0; text-align: center;
  color: rgba(230, 232, 236, .55); font: 13px system-ui, sans-serif; }
</style></head><body><button title="Fechar" aria-label="Fechar">&times;</button><p>Toque fora para fechar</p>
<script>document.body.onclick = () => { document.title = "close " + Date.now(); };</script></body></html>`;

const positionModal = () => {
  const window = context?.getMainWindow();
  if (!modalOpen || !window || !modal || !backdrop) return;
  const { width, height } = window.getContentBounds();
  const modalWidth = Math.min(MODAL_MAX_WIDTH, width - MODAL_MARGIN * 2);
  place(backdrop, { x: 0, y: 0, width, height }, { raise: true });
  place(
    modal,
    {
      x: Math.round((width - modalWidth) / 2),
      y: MODAL_MARGIN,
      width: Math.max(1, modalWidth),
      height: Math.max(1, height - MODAL_MARGIN * 2),
    },
    { raise: true },
  );
};

const closeModal = () => {
  modalOpen = false;
  detach(modal);
  detach(backdrop);
};

const openModal = (url: string) => {
  const window = context?.getMainWindow();
  if (!window) return;
  if (!modal || modal.webContents.isDestroyed()) {
    modal = createEmbeddedWebView({
      partition: "persist:shello",
      homeUrl: url,
      isTrustedNavigation: isTrusted,
      label: "Shello (modal)",
      playbackKeepalive: false,
      onBeforeInputEvent: context?.onBeforeInputEvent,
    });
    modal.setBackgroundColor("#0f1115");
    modal.webContents.setWindowOpenHandler(({ url: target }) => {
      openExternalLink(target);
      return { action: "deny" };
    });
  }
  if (!backdrop || backdrop.webContents.isDestroyed()) {
    backdrop = new WebContentsView({
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    backdrop.setBackgroundColor("#00000000");
    backdrop.webContents.on("page-title-updated", (_event, title) => {
      if (title.startsWith("close ")) closeModal();
    });
    backdrop.webContents.on("will-navigate", (event) => event.preventDefault());
    backdrop.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    void backdrop.webContents
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(BACKDROP_HTML)}`)
      .catch(() => {});
  }
  if (!resizeHooked.has(window)) {
    resizeHooked.add(window);
    window.on("resize", positionModal);
  }
  if (state.drawerOpen) setState({ drawerOpen: false });
  modalOpen = true;
  apply();
  positionModal();
  modal.webContents.focus();
};

const ensureUrl = () => {
  if (!view || view.webContents.isDestroyed()) return;
  const next = targetUrl();
  if (loadedUrl === next) return;
  loadedUrl = next;
  void view.webContents.loadURL(next).catch(() => {});
};

// ---------- aba da gaveta ----------

const HANDLE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
button { position: absolute; inset: 0; border: 0; border-radius: 12px 0 0 12px; background: #d97757; color: #1a0f0a;
  cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 0;
  font: 800 15px "Cascadia Code", Consolas, monospace; }
button:hover { background: #e58a6b; }
.off button { background: #3a3d45; color: #9aa0ab; }
.badge { min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 10px; background: #e5c07b;
  color: #241c05; font: 700 12px/20px system-ui, sans-serif; text-align: center; }
.badge:empty { display: none; }
.arrow { font: 600 13px system-ui, sans-serif; opacity: .75; }
</style></head><body><button id="b" title="Shello"><span>&gt;_</span><span class="badge" id="c"></span><span class="arrow" id="a">&lsaquo;</span></button>
<script>
document.getElementById("b").onclick = () => { document.title = "toggle " + Date.now(); };
window.setState = (waiting, offline, open) => {
  document.getElementById("c").textContent = waiting > 0 ? String(waiting) : "";
  document.getElementById("a").innerHTML = open ? "&rsaquo;" : "&lsaquo;";
  document.body.className = offline ? "off" : "";
  document.getElementById("b").title = offline ? "Shello fora do ar (toque para tentar de novo)" : "Shello";
};
</script></body></html>`;

const updateHandle = () => {
  if (!handle || handle.webContents.isDestroyed()) return;
  void handle.webContents
    .executeJavaScript(
      `window.setState && window.setState(${state.waiting}, ${state.offline}, ${state.drawerOpen})`,
    )
    .catch(() => {});
};

const ensureHandle = () => {
  if (handle && !handle.webContents.isDestroyed()) return handle;
  const created = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  created.setBackgroundColor("#00000000");
  // O clique troca o titulo da pagina: sem preload nem IPC para uma pagina de um botao so
  created.webContents.on("page-title-updated", (_event, title) => {
    if (!title.startsWith("toggle ")) return;
    if (state.offline) {
      retryNow();
      return;
    }
    setState({ drawerOpen: !state.drawerOpen });
    apply();
  });
  created.webContents.on("will-navigate", (event) => event.preventDefault());
  created.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  created.webContents.on("did-finish-load", updateHandle);
  void created.webContents
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(HANDLE_HTML)}`)
    .catch(() => {});
  handle = created;
  return created;
};

// ---------- posicionamento ----------

const detach = (target: WebContentsView | null) => {
  if (!target || !attached.has(target)) return;
  const parent = getParent();
  try {
    parent?.removeChildView(target);
  } catch {
    // Ja fora da arvore de views.
  }
  if (!target.webContents.isDestroyed()) target.setVisible(false);
  attached.delete(target);
};

const place = (
  target: WebContentsView,
  bounds: Electron.Rectangle,
  { raise }: { raise: boolean },
) => {
  const parent = getParent();
  if (!parent) return;
  target.setBounds(bounds);
  // addChildView de uma view que ja esta na arvore so a traz para a frente
  if (raise || !attached.has(target)) parent.addChildView(target);
  target.setVisible(true);
  attached.add(target);
};

const apply = () => {
  const { mode, bounds, visible } = surface;
  if (!getParent() || !visible || !bounds || bounds.width < 2 || bounds.height < 2) {
    detach(view);
    detach(handle);
    return;
  }
  const area = normalizeBounds(bounds);
  const current = ensureView();
  ensureUrl();

  if (mode === "grid") {
    detach(handle);
    if (state.offline) detach(current);
    else place(current, area, { raise: false });
    return;
  }

  const width = Math.round(
    Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, area.width * DRAWER_RATIO)),
  );
  const drawer = {
    x: area.x + area.width - width,
    y: area.y,
    width,
    height: area.height,
  };
  const open = state.drawerOpen && !state.offline;
  if (open) place(current, drawer, { raise: true });
  else detach(current);
  place(
    ensureHandle(),
    {
      x: (open ? drawer.x : area.x + area.width) - HANDLE_WIDTH,
      y: area.y + Math.round((area.height - HANDLE_HEIGHT) / 2),
      width: HANDLE_WIDTH,
      height: HANDLE_HEIGHT,
    },
    { raise: true },
  );
  // A aba acabou de subir: o modal aberto volta para cima dela
  if (modalOpen) positionModal();
};

// A Smart TV sobe para a frente quando muda de tamanho: a gaveta (e o modal, acima de tudo)
// voltam para cima dela
const raiseDrawer = () => {
  const parent = getParent();
  if (!parent) return;
  const onTop = [
    ...(surface.mode === "drawer" ? [view, handle] : []),
    ...(modalOpen ? [backdrop, modal] : []),
  ];
  for (const target of onTop) {
    if (target && attached.has(target)) parent.addChildView(target);
  }
};

// ---------- API ----------

let raisedHooked = false;
export const initShello = (shelloContext: ShelloContext) => {
  context = shelloContext;
  if (raisedHooked) return; // janela recriada: o gancho continua valendo
  raisedHooked = true;
  onEmbeddedViewRaised(raiseDrawer);
};

/** Endereco mudou nas configuracoes: recarrega no novo. */
export const syncShelloSettings = () => {
  if (state.offline) retryNow();
  apply();
};

export const disposeShello = () => {
  clearRetry();
  closeModal();
  detach(view);
  detach(handle);
  for (const target of [view, handle, modal, backdrop]) {
    if (target && !target.webContents.isDestroyed()) target.webContents.close();
  }
  view = null;
  handle = null;
  modal = null;
  backdrop = null;
  loadedUrl = null;
  surface = { ...surface, visible: false };
  state = { waiting: 0, offline: false, drawerOpen: false };
};

export const registerShelloIpc = () => {
  ipcMain.handle("shello:sync", (_event, next: ShelloSurface) => {
    const modeChanged = next.mode !== surface.mode;
    surface = next;
    // Gaveta aberta fecha ao trocar de modo ou ao sumir (ajustes, edicao da grade...)
    if ((modeChanged || !next.visible) && state.drawerOpen) {
      setState({ drawerOpen: false });
    }
    apply();
  });

  ipcMain.handle("shello:set-drawer-open", (_event, open: boolean) => {
    if (open === state.drawerOpen) return;
    setState({ drawerOpen: open });
    apply();
  });

  ipcMain.handle("shello:reload", () => {
    if (state.offline || !view) retryNow();
    else view.webContents.reload();
  });

  ipcMain.handle("shello:capture-preview", () =>
    view && attached.has(view) ? captureEmbeddedWebPreview(view) : null,
  );

  ipcMain.handle("shello:get-state", () => state);
};
