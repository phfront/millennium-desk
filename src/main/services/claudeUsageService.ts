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
const CACHE_TTL_MS = 150_000;
const ERROR_RETRY_MS = 90_000;
const RATE_LIMIT_RETRY_MS = 5 * 60_000;

interface UsageCacheEntry {
  nextFetchAt: number;
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

interface FetchResult {
  usage: ClaudeAccountUsage;
  retryInMs: number;
}

const fetchAccountUsage = async (
  account: string,
  configDir: string,
): Promise<FetchResult | null> => {
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
    return {
      usage: { ...base, error: "Token expirado — abra o claude dessa conta." },
      retryInMs: ERROR_RETRY_MS,
    };
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
      const retryAfterSec = Number(response.headers.get("retry-after"));
      return {
        usage: { ...base, error: `Falha na API (HTTP ${response.status}).` },
        retryInMs:
          Number.isFinite(retryAfterSec) && retryAfterSec > 0
            ? retryAfterSec * 1000
            : response.status === 429
              ? RATE_LIMIT_RETRY_MS
              : ERROR_RETRY_MS,
      };
    }
    const body = (await response.json()) as { limits?: unknown };
    const limits = parseLimits(body.limits);
    if (limits.length === 0) {
      return {
        usage: { ...base, error: "Resposta sem limites de uso." },
        retryInMs: ERROR_RETRY_MS,
      };
    }
    return { usage: { ...base, limits }, retryInMs: CACHE_TTL_MS };
  } catch {
    return {
      usage: { ...base, error: "Sem conexao com a API." },
      retryInMs: ERROR_RETRY_MS,
    };
  }
};

const getAccountUsageCached = async (
  account: string,
  configDir: string,
): Promise<ClaudeAccountUsage | null> => {
  const cached = usageCache.get(configDir);
  if (cached && Date.now() < cached.nextFetchAt) {
    return cached.usage;
  }
  const result = await fetchAccountUsage(account, configDir);
  if (!result) return null;
  // Falha nao derruba o dado anterior, mas agenda a proxima tentativa —
  // reconsultar a cada tick durante um 429 so prolonga o rate limit.
  const usage =
    result.usage.error && cached && !cached.usage.error
      ? cached.usage
      : result.usage;
  usageCache.set(configDir, {
    nextFetchAt: Date.now() + result.retryInMs,
    usage,
  });
  return usage;
};

export const getClaudeUsage = async (): Promise<ClaudeUsageSnapshot> => {
  const configDirs = await listClaudeConfigDirs();
  // Sequencial de proposito: rajada com todas as contas favorece 429.
  const accounts: ClaudeAccountUsage[] = [];
  for (const { account, dir } of configDirs) {
    const usage = await getAccountUsageCached(account, dir);
    if (usage) accounts.push(usage);
  }
  return {
    accounts: accounts.sort((a, b) => a.account.localeCompare(b.account)),
  };
};
