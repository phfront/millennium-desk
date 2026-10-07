import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getConfiguredUserDataPath } from "../appPaths";
import { logError } from "../logs/logger";
import source from "./deskAudio.cs?raw";

// O ajudante nativo de audio (deskAudio.cs): compilado na primeira vez, e de novo quando o
// fonte muda, com o csc do .NET 4 que vem no Windows; fica aberto em "serve" enquanto o Desk
// roda. Caiu: sobe de novo no proximo pedido.

const EXE_NAME = "desk-audio.exe";
const CALL_TIMEOUT_MS = 6000;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

let child: ChildProcessWithoutNullStreams | null = null;
let starting: Promise<ChildProcessWithoutNullStreams> | null = null;
let compiled: Promise<string> | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
const changeListeners = new Set<() => void>();
let changeTimer: NodeJS.Timeout | null = null;

const binDir = () => path.join(getConfiguredUserDataPath(), "bin");

const sourceHash = () => createHash("sha1").update(source).digest("hex");

const compile = (): Promise<string> => {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("O controle de áudio só funciona no Windows."));
  }
  if (compiled) return compiled;
  compiled = (async () => {
    const dir = binDir();
    const exe = path.join(dir, EXE_NAME);
    const stamp = path.join(dir, "desk-audio.sha1");
    const hash = sourceHash();
    const current = fs.existsSync(stamp) ? fs.readFileSync(stamp, "utf8").trim() : "";
    if (fs.existsSync(exe) && current === hash) return exe;

    fs.mkdirSync(dir, { recursive: true });
    const cs = path.join(dir, "desk-audio.cs");
    // Com BOM: o csc do .NET 4 le os acentos das mensagens certo
    fs.writeFileSync(cs, String.fromCharCode(0xfeff) + source, "utf8");
    const csc = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "Microsoft.NET",
      "Framework64",
      "v4.0.30319",
      "csc.exe",
    );
    await new Promise<void>((resolve, reject) => {
      execFile(
        csc,
        ["-nologo", "-optimize", "-r:System.Web.Extensions.dll", `-out:${exe}`, cs],
        { windowsHide: true },
        (error, stdout) => {
          if (error) {
            reject(new Error(`Falha ao compilar o ajudante de áudio: ${stdout || error.message}`));
            return;
          }
          resolve();
        },
      );
    });
    fs.writeFileSync(stamp, hash, "utf8");
    return exe;
  })();
  // Falhou: tenta de novo no proximo pedido
  compiled.catch(() => {
    compiled = null;
  });
  return compiled;
};

const emitChanged = () => {
  // O Windows avisa varias vezes seguidas (padrao console + multimidia + comunicacoes)
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    changeTimer = null;
    for (const listener of changeListeners) listener();
  }, 150);
};

const failAll = (error: Error) => {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(error);
    pending.delete(id);
  }
};

const start = (): Promise<ChildProcessWithoutNullStreams> => {
  if (child) return Promise.resolve(child);
  if (starting) return starting;
  starting = (async () => {
    const exe = await compile();
    const proc = spawn(exe, ["serve"], { windowsHide: true });
    proc.stdout.setEncoding("utf8");
    let buffer = "";
    proc.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        let message: { seq?: number; ok?: boolean; data?: unknown; error?: string; event?: string };
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.event === "changed") {
          emitChanged();
          continue;
        }
        if (typeof message.seq !== "number") continue;
        const entry = pending.get(message.seq);
        if (!entry) continue;
        pending.delete(message.seq);
        clearTimeout(entry.timer);
        if (message.ok) entry.resolve(message.data);
        else entry.reject(new Error(message.error || "Falha no ajudante de áudio."));
      }
    });
    proc.stderr.on("data", (chunk) => {
      logError("system", "Ajudante de áudio", String(chunk).trim());
    });
    proc.on("exit", () => {
      if (child === proc) child = null;
      failAll(new Error("O ajudante de áudio fechou."));
    });
    proc.on("error", (error) => {
      if (child === proc) child = null;
      failAll(error);
    });
    child = proc;
    return proc;
  })();
  starting
    .catch(() => undefined)
    .finally(() => {
      starting = null;
    });
  return starting;
};

export const callDeskAudio = async <T = unknown>(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<T> => {
  const proc = await start();
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("O ajudante de áudio não respondeu."));
    }, CALL_TIMEOUT_MS);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
    proc.stdin.write(`${JSON.stringify({ ...args, seq: id, cmd })}\n`);
  });
};

/** Aparelho ligado, padrao trocado, "Escutar" mudado: vale reler o estado. */
export const onDeskAudioChanged = (listener: () => void) => {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
};

export const stopDeskAudio = () => {
  failAll(new Error("O Desk está fechando."));
  child?.stdin.end();
  child?.kill();
  child = null;
};
