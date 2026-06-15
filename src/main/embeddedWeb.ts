import { app, session, WebContentsView } from "electron";
import type { SpotifyLayoutMode } from "../shared/spotifyLayout";

export type EmbeddedWebLayout = SpotifyLayoutMode;

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

export const buildChromeDesktopUserAgent = (
  chromeVersion = process.versions.chrome,
) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

export const buildChromeMobileUserAgent = (
  chromeVersion = process.versions.chrome,
) =>
  `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;

export const getSpotifyUserAgent = (layout: EmbeddedWebLayout) =>
  layout === "mobile"
    ? buildChromeMobileUserAgent()
    : buildChromeDesktopUserAgent();

// Spotify bloqueia UA com "Electron" no nome do app e na string do navegador.
export const SPOTIFY_USER_AGENT = getSpotifyUserAgent("desktop");

export const EMBEDDED_USER_AGENTS = {
  mobile: MOBILE_USER_AGENT,
  spotify: SPOTIFY_USER_AGENT,
} as const;

const buildSecChUa = (chromeVersion = process.versions.chrome) => {
  const major = chromeVersion.split(".")[0];
  return `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not-A)Brand";v="99"`;
};

const buildBrowserIdentityInjection = (
  userAgent: string,
  mobile: boolean,
) => {
  const chromeMajor = userAgent.match(/Chrome\/([\d.]+)/)?.[1]?.split(".")[0] ?? "148";
  const platform = mobile ? "Android" : "Windows";
  const platformVersion = mobile ? "14.0.0" : "15.0.0";
  const architecture = mobile ? "" : "x86";
  const bitness = mobile ? "" : "64";

  return `(() => {
    const ua = ${JSON.stringify(userAgent)};
    const chromeMajor = ${JSON.stringify(chromeMajor)};
    const mobile = ${mobile ? "true" : "false"};
    const platform = ${JSON.stringify(platform)};
    try {
      Object.defineProperty(navigator, "userAgent", {
        get: () => ua,
        configurable: true,
      });
      Object.defineProperty(navigator, "appVersion", {
        get: () => ua.replace("Mozilla/", ""),
        configurable: true,
      });
      Object.defineProperty(navigator, "vendor", {
        get: () => "Google Inc.",
        configurable: true,
      });
      Object.defineProperty(navigator, "maxTouchPoints", {
        get: () => (mobile ? 5 : 0),
        configurable: true,
      });
      Object.defineProperty(navigator, "platform", {
        get: () => (mobile ? "Linux armv81" : "Win32"),
        configurable: true,
      });
      if (navigator.userAgentData) {
        const brands = [
          { brand: "Chromium", version: chromeMajor },
          { brand: "Google Chrome", version: chromeMajor },
          { brand: "Not-A)Brand", version: "99" },
        ];
        Object.defineProperty(navigator, "userAgentData", {
          get: () => ({
            brands,
            mobile,
            platform,
            getHighEntropyValues: async () => ({
              brands,
              mobile,
              platform,
              platformVersion: ${JSON.stringify(platformVersion)},
              architecture: ${JSON.stringify(architecture)},
              bitness: ${JSON.stringify(bitness)},
              model: mobile ? "Pixel 8" : "",
              uaFullVersion: ua.match(/Chrome\\/([\\d.]+)/)?.[1] ?? chromeMajor + ".0.0.0",
            }),
          }),
          configurable: true,
        });
      }
      window.chrome = window.chrome ?? { runtime: {} };
    } catch {}
  })();`;
};

// Players web pausam quando a pagina fica oculta ou perde foco; forcamos ativo.
const buildPlaybackKeepaliveInjection = () => `(() => {
  try {
    const apply = () => {
      Object.defineProperty(document, "hidden", {
        get: () => false,
        configurable: true,
      });
      Object.defineProperty(document, "visibilityState", {
        get: () => "visible",
        configurable: true,
      });
      document.hasFocus = () => true;
    };
    apply();
    document.addEventListener("visibilitychange", (event) => {
      event.stopImmediatePropagation();
      apply();
    }, true);
    window.addEventListener("blur", (event) => {
      event.stopImmediatePropagation();
    }, true);
    window.addEventListener("focus", (event) => {
      event.stopImmediatePropagation();
    }, true);
  } catch {}
})();`;

export const injectPlaybackKeepalive = (view: WebContentsView) => {
  void view.webContents
    .executeJavaScript(buildPlaybackKeepaliveInjection())
    .catch(() => {});
};

const buildSpotifyMobileViewportInjection = () => `(() => {
  try {
    const width = Math.max(320, Math.round(window.innerWidth || document.documentElement.clientWidth || 360));
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      document.head.prepend(meta);
    }
    meta.setAttribute(
      "content",
      "width=" + width + ", initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
    );
    document.documentElement.style.width = "100%";
    document.documentElement.style.maxWidth = width + "px";
    document.body.style.width = "100%";
    document.body.style.maxWidth = width + "px";
    document.body.style.overflowX = "hidden";
  } catch {}
})();`;

export type SpotifyIdentityController = {
  getLayout: () => EmbeddedWebLayout;
  setLayout: (layout: EmbeddedWebLayout) => boolean;
  getUserAgent: () => string;
  injectInto: (view: WebContentsView) => void;
};

export const createSpotifyIdentityController = (
  partition: string,
): SpotifyIdentityController => {
  const embeddedSession = configureEmbeddedSession(partition);
  let layout: EmbeddedWebLayout = "desktop";
  let userAgent = getSpotifyUserAgent(layout);

  const buildRequestHeaders = (requestHeaders: Record<string, string>) => {
    const chromeMajor =
      userAgent.match(/Chrome\/([\d.]+)/)?.[1]?.split(".")[0] ?? "148";
    const mobile = layout === "mobile";

    return {
      ...requestHeaders,
      "User-Agent": userAgent,
      "sec-ch-ua": `"Chromium";v="${chromeMajor}", "Google Chrome";v="${chromeMajor}", "Not-A)Brand";v="99"`,
      "sec-ch-ua-mobile": mobile ? "?1" : "?0",
      "sec-ch-ua-platform": mobile ? '"Android"' : '"Windows"',
    };
  };

  embeddedSession.webRequest.onBeforeSendHeaders(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      callback({
        requestHeaders: buildRequestHeaders(
          details.requestHeaders as Record<string, string>,
        ),
      });
    },
  );

  embeddedSession.setUserAgent(userAgent);

  return {
    getLayout: () => layout,
    setLayout: (next) => {
      if (next === layout) return false;
      layout = next;
      userAgent = getSpotifyUserAgent(layout);
      embeddedSession.setUserAgent(userAgent);
      return true;
    },
    getUserAgent: () => userAgent,
    injectInto: (view) => {
      view.webContents.setUserAgent(userAgent);
      const scripts = [
        buildPlaybackKeepaliveInjection(),
        buildBrowserIdentityInjection(userAgent, layout === "mobile"),
        ...(layout === "mobile" ? [buildSpotifyMobileViewportInjection()] : []),
      ];
      void view.webContents
        .executeJavaScript(scripts.join("\n"))
        .catch((error) =>
          console.error("Falha ao aplicar identidade do Spotify:", error),
        );
    },
  };
};

export const applySpotifyLayoutMode = (
  view: WebContentsView | null,
  controller: SpotifyIdentityController | null,
  layout: EmbeddedWebLayout,
) => {
  if (!view || !controller) return;
  const changed = controller.setLayout(layout);
  if (!changed) return;

  controller.injectInto(view);
  notifyEmbeddedWebViewResize(view, true);
};

export const probeWidevineSupport = async (
  webContents: Electron.WebContents,
) => {
  try {
    return await webContents.executeJavaScript(`
      navigator.requestMediaKeySystemAccess("com.widevine.alpha", [{
        initDataTypes: ["cenc"],
        audioCapabilities: [{
          contentType: 'audio/mp4; codecs="mp4a.40.2"',
          robustness: "SW_SECURE_CRYPTO",
        }],
        videoCapabilities: [{
          contentType: 'video/mp4; codecs="avc1.42E01E"',
          robustness: "SW_SECURE_CRYPTO",
        }],
      }]).then(() => true).catch(() => false)
    `);
  } catch {
    return false;
  }
};

const EMBEDDED_HOME_URLS = {
  youtube: {
    mobile: "https://m.youtube.com/",
    desktop: "https://www.youtube.com/",
  },
  spotify: {
    mobile: "https://open.spotify.com/",
    desktop: "https://open.spotify.com/",
  },
} as const;

export const getEmbeddedWebHomeUrl = (
  service: keyof typeof EMBEDDED_HOME_URLS,
  layout: EmbeddedWebLayout = "mobile",
) => EMBEDDED_HOME_URLS[service][layout];

const EMBEDDED_MEDIA_PERMISSIONS = new Set([
  "media",
  "mediaKeySystem",
  "fullscreen",
  "pointerLock",
]);

const AUTH_POPUP_HOSTS = [
  "accounts.spotify.com",
  "google.com",
  "facebook.com",
  "apple.com",
] as const;

const isAuthPopupNavigation = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    return AUTH_POPUP_HOSTS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
};

export const configureEmbeddedSession = (partitionName: string) => {
  const embeddedSession = session.fromPartition(partitionName);

  embeddedSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === "media" || permission === "mediaKeySystem") {
      callback(true);
      return;
    }
    callback(EMBEDDED_MEDIA_PERMISSIONS.has(permission));
  });

  embeddedSession.setPermissionCheckHandler((_wc, permission) => {
    if (permission === "media" || permission === "mediaKeySystem") {
      return true;
    }
    return EMBEDDED_MEDIA_PERMISSIONS.has(permission);
  });

  return embeddedSession;
};

export type EmbeddedWebViewConfig = {
  partition: string;
  homeUrl: string;
  layout?: EmbeddedWebLayout;
  userAgent?: string;
  spotifyIdentity?: SpotifyIdentityController;
  isTrustedNavigation: (url: string) => boolean;
  label: string;
  onBeforeInputEvent?: (
    event: Electron.Event,
    input: Electron.Input,
  ) => void;
};

const applyUserAgent = (
  embeddedSession: Electron.Session,
  view: WebContentsView,
  userAgent: string,
) => {
  embeddedSession.setUserAgent(userAgent);
  view.webContents.setUserAgent(userAgent);
};

export const createEmbeddedWebView = (config: EmbeddedWebViewConfig) => {
  const layout = config.layout ?? "desktop";
  const userAgent =
    config.spotifyIdentity?.getUserAgent() ??
    config.userAgent ??
    (layout === "mobile" ? MOBILE_USER_AGENT : undefined);
  const embeddedSession = configureEmbeddedSession(config.partition);
  const view = new WebContentsView({
    webPreferences: {
      session: embeddedSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  view.setBackgroundColor("#090b10");
  view.webContents.setAudioMuted(false);
  if (userAgent) {
    applyUserAgent(embeddedSession, view, userAgent);
  }

  view.webContents.setWindowOpenHandler(({ url }) => {
    if (
      config.isTrustedNavigation(url) &&
      isAuthPopupNavigation(url)
    ) {
      void view.webContents.loadURL(url);
    }
    return { action: "deny" };
  });

  view.webContents.on("will-navigate", (event, url) => {
    if (!config.isTrustedNavigation(url)) {
      event.preventDefault();
    }
  });

  view.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) {
        console.error(`Falha de navegacao do ${config.label}:`, {
          errorCode,
          errorDescription,
          validatedUrl,
        });
      }
    },
  );

  if (config.onBeforeInputEvent) {
    view.webContents.on("before-input-event", config.onBeforeInputEvent);
  }

  const injectPageScripts = () => {
    injectPlaybackKeepalive(view);
    config.spotifyIdentity?.injectInto(view);
  };

  view.webContents.on("dom-ready", injectPageScripts);
  view.webContents.on("did-navigate", injectPageScripts);
  view.webContents.on("did-finish-load", () => {
    injectPageScripts();
    notifyEmbeddedWebViewResize(view, true);
  });

  if (!app.isPackaged && config.spotifyIdentity) {
    if (config.label === "Spotify") {
      view.webContents.on(
        "console-message",
        (_event, level, message, line, sourceId) => {
          console.log(`[Spotify console:${level}] ${message} (${sourceId}:${line})`);
        },
      );
    }

    view.webContents.on("dom-ready", () => {
      void probeWidevineSupport(view.webContents).then((supported) => {
        console.info(
          supported
            ? `[${config.label}] Widevine/EME disponivel no webview.`
            : `[${config.label}] Widevine/EME indisponivel — playback protegido pode falhar (ex.: Netflix E100).`,
        );
      });
    });
  }

  void view.webContents
    .loadURL(config.homeUrl)
    .catch((error) =>
      console.error(`Falha ao carregar ${config.label}:`, error),
    );

  return view;
};

let lastFrontEmbeddedView: WebContentsView | null = null;
const lastEmbeddedWebBounds = new WeakMap<
  WebContentsView,
  Electron.Rectangle
>();

const PAUSE_EMBEDDED_MEDIA_SCRIPT = `(() => {
  try {
    for (const element of document.querySelectorAll("video, audio")) {
      element.pause();
      element.muted = true;
      element.removeAttribute("src");
      element.load?.();
    }
  } catch {}
})();`;

export const pauseEmbeddedWebMedia = async (
  view: WebContentsView | null,
  options?: { stripMediaElements?: boolean },
) => {
  if (!view || view.webContents.isDestroyed()) return;
  view.webContents.setAudioMuted(true);
  if (options?.stripMediaElements === false) return;
  try {
    await view.webContents.executeJavaScript(PAUSE_EMBEDDED_MEDIA_SCRIPT);
  } catch {
    // A pagina pode estar descarregando.
  }
};

export type ParkEmbeddedWebViewOptions = {
  /** Mantem audio ao estacionar (ex.: Spotify tocando ao trocar de app). */
  keepAudio?: boolean;
};

export const parkEmbeddedWebView = (
  parent: Electron.View | null,
  view: WebContentsView | null,
  options?: ParkEmbeddedWebViewOptions,
) => {
  if (!view || view.webContents.isDestroyed()) return;

  if (parent) {
    try {
      parent.removeChildView(view);
    } catch {
      // Ja removido da arvore de views.
    }
  }

  view.setVisible(false);

  if (options?.keepAudio) {
    view.webContents.setAudioMuted(false);
  } else {
    view.webContents.setAudioMuted(true);
    void pauseEmbeddedWebMedia(view, { stripMediaElements: false });
  }

  if (lastFrontEmbeddedView === view) {
    lastFrontEmbeddedView = null;
  }
};

export const disposeEmbeddedWebView = async (
  parent: Electron.View | null,
  view: WebContentsView | null,
) => {
  if (!view || view.webContents.isDestroyed()) return;

  if (parent) {
    try {
      parent.removeChildView(view);
    } catch {
      // Ja removido da arvore de views.
    }
  }

  view.setVisible(false);

  if (lastFrontEmbeddedView === view) {
    lastFrontEmbeddedView = null;
  }

  await pauseEmbeddedWebMedia(view);

  try {
    if (!view.webContents.isDestroyed()) {
      await view.webContents.loadURL("about:blank");
    }
  } catch {
    // Ignora falha ao limpar a pagina.
  }

  if (!view.webContents.isDestroyed()) {
    view.webContents.close();
  }
};

export const setEmbeddedWebViewVisible = (
  parent: Electron.View | null,
  view: WebContentsView | null,
  visible: boolean,
) => {
  if (!view || !parent) return;

  if (visible) {
    parent.addChildView(view);
    view.setVisible(true);
    view.webContents.setAudioMuted(false);
    notifyEmbeddedWebViewResize(view);
    return;
  }

  view.setVisible(false);
  view.webContents.setAudioMuted(true);
  void pauseEmbeddedWebMedia(view);
  parent.removeChildView(view);

  if (lastFrontEmbeddedView === view) {
    lastFrontEmbeddedView = null;
  }
};

const resizeNotifyTimers = new WeakMap<
  WebContentsView,
  ReturnType<typeof setTimeout>
>();

const notifyEmbeddedWebViewResize = (
  view: WebContentsView,
  immediate = false,
) => {
  const existing = resizeNotifyTimers.get(view);
  if (existing) clearTimeout(existing);

  const fire = () => {
    resizeNotifyTimers.delete(view);
    void view.webContents
      .executeJavaScript(
        `requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        })`,
      )
      .catch(() => {});
  };

  if (immediate) {
    fire();
    return;
  }

  resizeNotifyTimers.set(view, setTimeout(fire, 150));
};

export const getFrontEmbeddedWebView = () => lastFrontEmbeddedView;

export const toggleEmbeddedWebDevTools = (
  view: WebContentsView | null,
): boolean => {
  if (!view) return false;

  if (view.webContents.isDevToolsOpened()) {
    view.webContents.closeDevTools();
  } else {
    view.webContents.openDevTools({ mode: "detach" });
  }

  return true;
};

export const syncEmbeddedWebViewBounds = (
  parent: Electron.View | null,
  view: WebContentsView | null,
  bounds: Electron.Rectangle,
  visible: boolean,
) => {
  if (!view || !parent || !visible) return;

  const previous = lastEmbeddedWebBounds.get(view);
  const sizeChanged =
    !previous ||
    previous.x !== bounds.x ||
    previous.y !== bounds.y ||
    previous.width !== bounds.width ||
    previous.height !== bounds.height;

  view.setBounds(bounds);
  view.setVisible(true);
  lastEmbeddedWebBounds.set(view, bounds);

  if (lastFrontEmbeddedView !== view) {
    parent.addChildView(view);
    lastFrontEmbeddedView = view;
  }

  if (sizeChanged) {
    notifyEmbeddedWebViewResize(view);
  }
};

export const captureEmbeddedWebPreview = async (
  view: WebContentsView | null,
) => {
  if (!view) return null;
  try {
    const image = await view.webContents.capturePage();
    return `data:image/png;base64,${image.toPNG().toString("base64")}`;
  } catch (error) {
    console.error("Falha ao capturar previa do navegador embutido:", error);
    return null;
  }
};
