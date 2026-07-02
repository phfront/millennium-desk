import { spawn, type ChildProcessByStdio } from "node:child_process";
import os from "node:os";
import readline from "node:readline";
import type { Readable } from "node:stream";
import type { SystemStatus } from "../shared/contracts";

const clampPercent = (value: number) =>
  Math.min(100, Math.max(0, Math.round(value)));

// --- CPU: delta de os.cpus(), sem processos externos -----------------------

let lastCpuTimes: { idle: number; total: number } | null = null;

const sampleCpuTimes = () => {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.idle +
      cpu.times.irq;
  }
  return { idle, total };
};

const readCpuPercent = () => {
  const current = sampleCpuTimes();
  const previous = lastCpuTimes;
  lastCpuTimes = current;

  if (!previous || current.total <= previous.total) return 0;

  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;
  return clampPercent(100 * (1 - idleDelta / totalDelta));
};

// Semeia a base para que a primeira leitura ja tenha um delta valido.
lastCpuTimes = sampleCpuTimes();

// --- Memoria: os.totalmem/freemem (freemem = fisica disponivel no Windows) --

const readMemory = () => {
  const totalBytes = os.totalmem();
  const usedBytes = Math.max(0, totalBytes - os.freemem());
  return {
    totalBytes,
    usedBytes,
    usedPercent: clampPercent((usedBytes / totalBytes) * 100),
  };
};

// --- GPU / disco / rede: worker PowerShell persistente (apenas Windows) -----
//
// Um unico processo PowerShell fica em loop emitindo uma linha JSON a cada
// ~2s. Isso substitui os varios spawns de PowerShell/WMI por poll que o
// systeminformation fazia. O worker so roda enquanto o modulo Sistema esta
// consumindo status (auto-desliga apos ficar ocioso) e usa:
//   - GPU: contador "\GPU Engine(*engtype_3D)\Utilization Percentage"
//     (provider V2, nome nao localizado).
//   - Disco: contadores PhysicalDisk resolvidos pelo registro Perflib
//     (IDs estaveis 234/200/220/222), com fallback para nomes em ingles.
//   - Rede: System.Net.NetworkInformation (API .NET, independente de idioma).

type WorkerSample = Pick<SystemStatus, "gpu" | "disk" | "network">;

const EMPTY_WORKER_SAMPLE: WorkerSample = {
  gpu: { available: false, utilizationPercent: null, label: null },
  disk: { activePercent: null, readBytesPerSec: 0, writeBytesPerSec: 0 },
  network: { downloadBytesPerSec: 0, uploadBytesPerSec: 0 },
};

const WORKER_IDLE_TIMEOUT_MS = 15_000;
const WORKER_RESPAWN_COOLDOWN_MS = 5_000;

const WORKER_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'

function Get-PerflibName([int]$id) {
  foreach ($key in 'CurrentLanguage', '009') {
    $table = $null
    try {
      $table = (Get-ItemProperty -Path ("HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Perflib\" + $key) -Name Counter -ErrorAction Stop).Counter
    } catch { continue }
    if (-not $table) { continue }
    for ($i = 0; $i -lt $table.Length - 1; $i += 2) {
      if ($table[$i] -eq [string]$id -and $table[$i + 1]) { return [string]$table[$i + 1] }
    }
  }
  return $null
}

$diskObject = Get-PerflibName 234
$diskTimeName = Get-PerflibName 200
$diskReadName = Get-PerflibName 220
$diskWriteName = Get-PerflibName 222
if (-not ($diskObject -and $diskTimeName -and $diskReadName -and $diskWriteName)) {
  $diskObject = 'PhysicalDisk'
  $diskTimeName = '% Disk Time'
  $diskReadName = 'Disk Read Bytes/sec'
  $diskWriteName = 'Disk Write Bytes/sec'
}
$diskCounters = @(
  ('\' + $diskObject + '(_Total)\' + $diskTimeName),
  ('\' + $diskObject + '(_Total)\' + $diskReadName),
  ('\' + $diskObject + '(_Total)\' + $diskWriteName)
)
$gpuCounter = '\GPU Engine(*engtype_3D)\Utilization Percentage'

$gpuLabel = $null
try {
  $gpuLabel = (Get-CimInstance -ClassName Win32_VideoController |
    Where-Object { $_.Name } | Select-Object -First 1).Name
} catch {}

$gpuSupported = $true
try { $null = Get-Counter -Counter $gpuCounter -ErrorAction Stop } catch { $gpuSupported = $false }
$diskSupported = $true
try { $null = Get-Counter -Counter $diskCounters -ErrorAction Stop } catch { $diskSupported = $false }

function Get-NetTotals {
  $rx = [long]0
  $tx = [long]0
  foreach ($nic in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($nic.NetworkInterfaceType -eq 'Loopback') { continue }
    if ($nic.OperationalStatus -ne 'Up') { continue }
    $stats = $nic.GetIPStatistics()
    $rx += $stats.BytesReceived
    $tx += $stats.BytesSent
  }
  return @($rx, $tx)
}

$diskTimeMatch = ('\' + $diskTimeName).ToLowerInvariant()
$diskReadMatch = ('\' + $diskReadName).ToLowerInvariant()
$diskWriteMatch = ('\' + $diskWriteName).ToLowerInvariant()

$prevNet = Get-NetTotals
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

while ($true) {
  $gpuValue = $null
  $diskTimeValue = $null
  $diskReadValue = 0
  $diskWriteValue = 0

  $counterSet = @()
  if ($gpuSupported) { $counterSet += $gpuCounter }
  if ($diskSupported) { $counterSet += $diskCounters }

  if ($counterSet.Count -gt 0) {
    $sample = $null
    try {
      $sample = Get-Counter -Counter $counterSet -SampleInterval 2 -MaxSamples 1 -ErrorAction Stop
    } catch {
      Start-Sleep -Seconds 2
    }
    if ($sample) {
      $gpuSum = $null
      foreach ($cs in $sample.CounterSamples) {
        $path = $cs.Path.ToLowerInvariant()
        if ($path.Contains('gpu engine')) {
          if ($null -eq $gpuSum) { $gpuSum = [double]0 }
          $gpuSum += $cs.CookedValue
        } elseif ($path.EndsWith($diskTimeMatch)) {
          $diskTimeValue = $cs.CookedValue
        } elseif ($path.EndsWith($diskReadMatch)) {
          $diskReadValue = $cs.CookedValue
        } elseif ($path.EndsWith($diskWriteMatch)) {
          $diskWriteValue = $cs.CookedValue
        }
      }
      if ($null -ne $gpuSum) { $gpuValue = [Math]::Min(100, [Math]::Round($gpuSum)) }
    }
  } else {
    Start-Sleep -Seconds 2
  }

  $elapsed = [Math]::Max(0.5, $stopwatch.Elapsed.TotalSeconds)
  $stopwatch.Restart()
  $net = Get-NetTotals
  $downloadRate = [Math]::Max(0, ($net[0] - $prevNet[0]) / $elapsed)
  $uploadRate = [Math]::Max(0, ($net[1] - $prevNet[1]) / $elapsed)
  $prevNet = $net

  $activePercent = $null
  if ($diskSupported -and $null -ne $diskTimeValue) {
    $activePercent = [Math]::Min(100, [Math]::Round($diskTimeValue))
  }

  $payload = @{
    gpu = @{
      available = ($null -ne $gpuValue)
      utilizationPercent = $gpuValue
      label = $gpuLabel
    }
    disk = @{
      activePercent = $activePercent
      readBytesPerSec = [Math]::Round([Math]::Max(0, $diskReadValue))
      writeBytesPerSec = [Math]::Round([Math]::Max(0, $diskWriteValue))
    }
    network = @{
      downloadBytesPerSec = [Math]::Round($downloadRate)
      uploadBytesPerSec = [Math]::Round($uploadRate)
    }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $payload -Compress -Depth 4))
  [Console]::Out.Flush()
}
`;

type StatusWorker = ChildProcessByStdio<null, Readable, Readable>;

let worker: StatusWorker | null = null;
let latestWorkerSample: WorkerSample | null = null;
let lastStatusRequestAt = 0;
let lastWorkerSpawnAt = 0;
let idleWatchTimer: NodeJS.Timeout | null = null;

const sanitizeWorkerSample = (raw: unknown): WorkerSample | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as {
    gpu?: {
      available?: unknown;
      utilizationPercent?: unknown;
      label?: unknown;
    };
    disk?: {
      activePercent?: unknown;
      readBytesPerSec?: unknown;
      writeBytesPerSec?: unknown;
    };
    network?: { downloadBytesPerSec?: unknown; uploadBytesPerSec?: unknown };
  };

  const asNumber = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input) ? input : 0;
  const asPercentOrNull = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input)
      ? clampPercent(input)
      : null;

  return {
    gpu: {
      available: value.gpu?.available === true,
      utilizationPercent: asPercentOrNull(value.gpu?.utilizationPercent),
      label: typeof value.gpu?.label === "string" ? value.gpu.label : null,
    },
    disk: {
      activePercent: asPercentOrNull(value.disk?.activePercent),
      readBytesPerSec: Math.max(0, asNumber(value.disk?.readBytesPerSec)),
      writeBytesPerSec: Math.max(0, asNumber(value.disk?.writeBytesPerSec)),
    },
    network: {
      downloadBytesPerSec: Math.max(
        0,
        asNumber(value.network?.downloadBytesPerSec),
      ),
      uploadBytesPerSec: Math.max(
        0,
        asNumber(value.network?.uploadBytesPerSec),
      ),
    },
  };
};

export const stopSystemStatusWorker = () => {
  if (idleWatchTimer) {
    clearInterval(idleWatchTimer);
    idleWatchTimer = null;
  }
  if (worker) {
    worker.removeAllListeners();
    worker.stdout.removeAllListeners();
    try {
      worker.kill();
    } catch {
      // Processo pode ja ter encerrado.
    }
    worker = null;
  }
  latestWorkerSample = null;
};

const startIdleWatch = () => {
  if (idleWatchTimer) return;
  idleWatchTimer = setInterval(() => {
    if (Date.now() - lastStatusRequestAt > WORKER_IDLE_TIMEOUT_MS) {
      stopSystemStatusWorker();
    }
  }, 5_000);
  idleWatchTimer.unref();
};

const ensureWorker = () => {
  if (process.platform !== "win32") return;
  if (worker) return;
  if (Date.now() - lastWorkerSpawnAt < WORKER_RESPAWN_COOLDOWN_MS) return;

  lastWorkerSpawnAt = Date.now();
  const encodedScript = Buffer.from(WORKER_SCRIPT, "utf16le").toString(
    "base64",
  );
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encodedScript,
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );

  worker = child;

  const lines = readline.createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const sample = sanitizeWorkerSample(JSON.parse(line));
      if (sample) latestWorkerSample = sample;
    } catch {
      // Linha de log/ruido do PowerShell: ignora.
    }
  });

  child.on("error", () => {
    if (worker === child) {
      worker = null;
      latestWorkerSample = null;
    }
  });
  child.on("exit", () => {
    if (worker === child) {
      worker = null;
      latestWorkerSample = null;
    }
  });

  startIdleWatch();
};

export const getSystemStatus = async (): Promise<SystemStatus> => {
  lastStatusRequestAt = Date.now();
  ensureWorker();

  const workerSample = latestWorkerSample ?? EMPTY_WORKER_SAMPLE;

  return {
    cpuPercent: readCpuPercent(),
    memory: readMemory(),
    gpu: workerSample.gpu,
    network: workerSample.network,
    disk: workerSample.disk,
  };
};
