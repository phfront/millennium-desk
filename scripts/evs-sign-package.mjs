import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const packageDir = process.argv[2];

if (!packageDir) {
  console.error(
    "Uso: node scripts/evs-sign-package.mjs <pasta-do-pacote-empacotado>",
  );
  process.exit(1);
}

const resolvedDir = path.resolve(packageDir);

if (!existsSync(resolvedDir)) {
  console.error(`[EVS] Pasta nao encontrada: ${resolvedDir}`);
  process.exit(1);
}

const moduleArgs = ["-m", "castlabs_evs.vmp", "sign-pkg", resolvedDir];

const pythonAttempts = [
  { cmd: "py", args: ["-3", ...moduleArgs] },
  { cmd: "python", args: moduleArgs },
  { cmd: "python3", args: moduleArgs },
];

let lastError = null;

for (const attempt of pythonAttempts) {
  const result = spawnSync(attempt.cmd, attempt.args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error?.code === "ENOENT") {
    lastError = result.error;
    continue;
  }

  if (result.status === 0) {
    console.info(`[EVS] Pacote assinado: ${resolvedDir}`);
    process.exit(0);
  }

  process.exit(result.status ?? 1);
}

console.error(
  "[EVS] Python nao encontrado. Instale Python 3.7+ e rode: py -3 -m pip install --upgrade castlabs-evs",
);
if (lastError) {
  console.error(lastError.message);
}
process.exit(1);
