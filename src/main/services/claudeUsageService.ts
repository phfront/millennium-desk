import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  ClaudeAccountUsage,
  ClaudeUsageLimit,
  ClaudeUsageSnapshot,
} from "../../shared/contracts";

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const FETCH_TIMEOUT_MS = 8_000;
/** Evita bater na API a cada refresh do renderer. */
const CACHE_TTL_MS = 55_000;

interface UsageCacheEntry {
  fetchedAt: number;
  usage: ClaudeAccountUsage;
}

const usageCache = new Map<string, UsageCacheEntry>();

const listClaudeConfigDirs = async (): Promise<
  Array<{ account: string; dir: string }>
> => {
  const home = os.homedir();
  const entries = await fs.readdir(home, { withFileTypes: true });
  const dirs: Array<{ account: string; dir: string }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = /^\.claude(?:-(.+))?$/.exec(entry.name);
    if (!match) continue;
    dirs.push({
      account: match[1] ?? "padrao",
      dir: path.join(home, entry.name),
    });
  }
  return dirs;
};

interface OauthCredentials {
  accessToken: string;
  expiresAt: number;
  subscriptionType: string | null;
}

const readCredentials = async (
  configDir: string,
): Promise<OauthCredentials | null> => {
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(configDir, ".credentials.json"), "utf8"),
    ) as {
      claudeAiOauth?: {
        accessToken?: string;
        expiresAt?: number;
        subscriptionType?: string;
      };
    };
    const oauth = raw.claudeAiOauth;
    if (!oauth?.accessToken || typeof oauth.expiresAt !== "number") {
      return null;
    }
    return {
      accessToken: oauth.accessToken,
      expiresAt: oauth.expiresAt,
      subscriptionType: oauth.subscriptionType ?? null,
    };
  } catch {
    return null;
  }
};

interface ApiLimit {
  kind?: string;
  percent?: number;
  resets_at?: string;
  scope?: { model?: { display_name?: string | null } | null } | null;
}

const LIMIT_LABELS: Record<string, string> = {
  session: "Sessao",
  weekly_all: "Semana",
};

const parseLimits = (limits: unknown): ClaudeUsageLimit[] => {
  if (!Array.isArray(limits)) return [];
  const parsed: ClaudeUsageLimit[] = [];
  for (const raw of limits as ApiLimit[]) {
    if (
      (raw.kind !== "session" &&
        raw.kind !== "weekly_all" &&
        raw.kind !== "weekly_scoped") ||
      typeof raw.percent !== "number"
    ) {
      continue;
    }
    parsed.push({
      kind: raw.kind,
      label:
        raw.kind === "weekly_scoped"
          ? (raw.scope?.model?.display_name ?? "Modelo")
          : LIMIT_LABELS[raw.kind],
      percent: Math.min(100, Math.max(0, Math.round(raw.percent))),
      resetsAt: typeof raw.resets_at === "string" ? raw.resets_at : null,
    });
  }
  return parsed;
};

const fetchAccountUsage = async (
  account: string,
  configDir: string,
): Promise<ClaudeAccountUsage | null> => {
  const credentials = await readCredentials(configDir);
  if (!credentials) return null;

  const base: ClaudeAccountUsage = {
    account,
    subscriptionType: credentials.subscriptionType,
    error: null,
    limits: [],
  };

  // Renovar o token daqui invalidaria o refresh token do Claude Code;
  // quando expirar, basta abrir o claude dessa conta que ele renova.
  if (credentials.expiresAt <= Date.now()) {
    return { ...base, error: "Token expirado — abra o claude dessa conta." };
  }

  try {
    const response = await fetch(USAGE_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ...base, error: `Falha na API (HTTP ${response.status}).` };
    }
    const body = (await response.json()) as { limits?: unknown };
    const limits = parseLimits(body.limits);
    if (limits.length === 0) {
      return { ...base, error: "Resposta sem limites de uso." };
    }
    return { ...base, limits };
  } catch {
    return { ...base, error: "Sem conexao com a API." };
  }
};

const getAccountUsageCached = async (
  account: string,
  configDir: string,
): Promise<ClaudeAccountUsage | null> => {
  const cached = usageCache.get(configDir);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.usage;
  }
  const usage = await fetchAccountUsage(account, configDir);
  if (usage) {
    // Falha de rede nao derruba o dado anterior; tenta de novo no proximo tick.
    if (usage.error && cached) return cached.usage;
    usageCache.set(configDir, { fetchedAt: Date.now(), usage });
  }
  return usage;
};

export const getClaudeUsage = async (): Promise<ClaudeUsageSnapshot> => {
  const configDirs = await listClaudeConfigDirs();
  const accounts = await Promise.all(
    configDirs.map(({ account, dir }) => getAccountUsageCached(account, dir)),
  );
  return {
    accounts: accounts
      .filter((usage): usage is ClaudeAccountUsage => usage !== null)
      .sort((a, b) => a.account.localeCompare(b.account)),
  };
};
