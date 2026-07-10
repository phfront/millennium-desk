import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  ClaudeSession,
  ClaudeSessionsSnapshot,
} from "../../shared/contracts";

const MAX_SESSIONS = 12;
const HEADER_READ_BYTES = 128 * 1024;
const TAIL_READ_BYTES = 256 * 1024;
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
/** Sessoes sem atividade alem disso sao consideradas encerradas. */
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const CONTEXT_LIMIT_TOKENS = 200_000;
const CONTEXT_LIMIT_1M_TOKENS = 1_000_000;

/**
 * O JSONL nao registra a janela de contexto. Acima de 200k so pode ser uma
 * sessao com janela de 1M; abaixo disso assume a janela padrao (sessoes de
 * 1M ficam superestimadas ate cruzarem 200k).
 */
const resolveContextPercent = (tokens: number): number => {
  const limit =
    tokens > CONTEXT_LIMIT_TOKENS
      ? CONTEXT_LIMIT_1M_TOKENS
      : CONTEXT_LIMIT_TOKENS;
  return Math.min(100, Math.round((tokens / limit) * 100));
};

interface SessionDetails {
  title: string | null;
  projectPath: string | null;
  gitBranch: string | null;
  contextTokens: number | null;
}

interface DetailsCacheEntry {
  mtimeMs: number;
  size: number;
  details: SessionDetails;
}

const detailsCache = new Map<string, DetailsCacheEntry>();

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

const truncate = (value: string, max = 120) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/**
 * Mensagens injetadas pelo harness (caveats, system-reminders, comandos)
 * comecam com tag XML; nao servem de titulo.
 */
const extractUserText = (content: unknown): string | null => {
  if (typeof content === "string") {
    return content.trimStart().startsWith("<") ? null : content;
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      const raw = block as { type?: unknown; text?: unknown };
      if (raw.type === "text" && typeof raw.text === "string") {
        return extractUserText(raw.text);
      }
    }
  }
  return null;
};

const readSlice = async (
  handle: fs.FileHandle,
  position: number,
  length: number,
): Promise<string> => {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.toString("utf8", 0, bytesRead);
};

/**
 * Titulo/projeto ficam nas primeiras linhas do JSONL; o consumo de contexto
 * vem do usage da ultima mensagem do assistant, no fim do arquivo. Le so as
 * duas pontas para nao varrer sessoes inteiras (podem ter dezenas de MB).
 */
const parseSessionDetails = async (
  filePath: string,
  size: number,
): Promise<SessionDetails> => {
  const details: SessionDetails = {
    title: null,
    projectPath: null,
    gitBranch: null,
    contextTokens: null,
  };

  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(filePath, "r");

    let firstUserText: string | null = null;
    const headText = await readSlice(handle, 0, HEADER_READ_BYTES);
    for (const line of headText.split("\n")) {
      if (details.title && details.projectPath && details.gitBranch) break;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (parsed.type === "ai-title" && typeof parsed.aiTitle === "string") {
        details.title = parsed.aiTitle;
      } else if (
        parsed.type === "summary" &&
        typeof parsed.summary === "string" &&
        !details.title
      ) {
        details.title = parsed.summary;
      } else if (parsed.type === "user") {
        if (!details.projectPath && typeof parsed.cwd === "string") {
          details.projectPath = parsed.cwd;
        }
        if (!details.gitBranch && typeof parsed.gitBranch === "string") {
          details.gitBranch = parsed.gitBranch;
        }
        if (!firstUserText) {
          firstUserText = extractUserText(
            (parsed.message as { content?: unknown } | undefined)?.content,
          );
        }
      }
    }
    if (!details.title && firstUserText) {
      details.title = truncate(firstUserText.replace(/\s+/g, " ").trim());
    }

    const tailStart = Math.max(0, size - TAIL_READ_BYTES);
    const tailText =
      tailStart < HEADER_READ_BYTES
        ? headText
        : await readSlice(handle, tailStart, TAIL_READ_BYTES);
    const tailLines = tailText.split("\n");
    for (let index = tailLines.length - 1; index >= 0; index--) {
      const line = tailLines[index];
      if (
        !line.includes('"type":"assistant"') ||
        !line.includes('"usage"') ||
        line.includes('"isSidechain":true')
      ) {
        continue;
      }
      let parsed: {
        message?: {
          usage?: {
            input_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
            output_tokens?: number;
          };
        };
      };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const usage = parsed.message?.usage;
      if (!usage) continue;
      details.contextTokens =
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.output_tokens ?? 0);
      break;
    }
  } finally {
    await handle?.close();
  }

  return details;
};

const readSessionDetailsCached = async (
  filePath: string,
  mtimeMs: number,
  size: number,
): Promise<SessionDetails> => {
  const cached = detailsCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
    return cached.details;
  }
  const details = await parseSessionDetails(filePath, size);
  detailsCache.set(filePath, { mtimeMs, size, details });
  return details;
};

const collectAccountSessions = async (
  account: string,
  configDir: string,
): Promise<ClaudeSession[]> => {
  const projectsDir = path.join(configDir, "projects");
  let projectEntries;
  try {
    projectEntries = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const sessions: ClaudeSession[] = [];
  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory()) continue;
    const projectDir = path.join(projectsDir, projectEntry.name);
    let files;
    try {
      files = await fs.readdir(projectDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
      const filePath = path.join(projectDir, file.name);
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) continue;
        if (Date.now() - stats.mtimeMs > RECENT_WINDOW_MS) continue;
        const details = await readSessionDetailsCached(
          filePath,
          stats.mtimeMs,
          stats.size,
        );
        if (!details.title || details.contextTokens === null) continue;
        sessions.push({
          id: file.name.replace(/\.jsonl$/, ""),
          account,
          projectName: details.projectPath
            ? path.basename(details.projectPath)
            : projectEntry.name,
          projectPath: details.projectPath,
          title: details.title,
          gitBranch: details.gitBranch,
          lastActivityAt: stats.mtime.toISOString(),
          active: Date.now() - stats.mtimeMs < ACTIVE_WINDOW_MS,
          contextTokens: details.contextTokens,
          contextPercent: resolveContextPercent(details.contextTokens),
        });
      } catch {
        continue;
      }
    }
  }
  return sessions;
};

export const listClaudeSessions =
  async (): Promise<ClaudeSessionsSnapshot> => {
    const configDirs = await listClaudeConfigDirs();
    const perAccount = await Promise.all(
      configDirs.map(({ account, dir }) =>
        collectAccountSessions(account, dir),
      ),
    );
    const sessions = perAccount
      .flat()
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt);
      })
      .slice(0, MAX_SESSIONS);

    return { sessions };
  };
