import { execFile } from "node:child_process";
import { promisify } from "node:util";
import si from "systeminformation";
import type { SystemStatus } from "../shared/contracts";

const execFileAsync = promisify(execFile);

let networkPrimed = false;

const clampPercent = (value: number) =>
  Math.min(100, Math.max(0, Math.round(value)));

const readCpuPercent = async () => {
  const load = await si.currentLoad();
  return clampPercent(load.currentLoad);
};

const readMemory = async () => {
  const memory = await si.mem();
  return {
    totalBytes: memory.total,
    usedBytes: memory.used,
    usedPercent: clampPercent(memory.used / memory.total * 100),
  };
};

const readGpu = async () => {
  const { controllers } = await si.graphics();
  let utilizationPercent: number | null = null;
  let label: string | null = null;

  for (const controller of controllers) {
    if (typeof controller.utilizationGpu !== "number") continue;
    if (
      utilizationPercent === null ||
      controller.utilizationGpu > utilizationPercent
    ) {
      utilizationPercent = clampPercent(controller.utilizationGpu);
      label = controller.model ?? null;
    }
  }

  return {
    available: utilizationPercent !== null,
    utilizationPercent,
    label,
  };
};

const readNetwork = async () => {
  const stats = await si.networkStats();
  if (!networkPrimed) {
    networkPrimed = true;
    return { downloadBytesPerSec: 0, uploadBytesPerSec: 0 };
  }

  const active = stats.filter(
    (entry) =>
      entry.operstate === "up" &&
      !/^(lo|loopback)/i.test(entry.iface),
  );

  return {
    downloadBytesPerSec: active.reduce(
      (sum, entry) => sum + (entry.rx_sec ?? 0),
      0,
    ),
    uploadBytesPerSec: active.reduce(
      (sum, entry) => sum + (entry.tx_sec ?? 0),
      0,
    ),
  };
};

const parseWindowsPerfCounters = (stdout: string) => {
  let activePercent: number | null = null;
  let readBytesPerSec = 0;
  let writeBytesPerSec = 0;

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const separator = trimmed.lastIndexOf("=");
    if (separator === -1) continue;

    const path = trimmed.slice(0, separator).toLowerCase();
    const value = Number(trimmed.slice(separator + 1));
    if (!Number.isFinite(value)) continue;

    if (path.includes("% disk time")) {
      activePercent = clampPercent(value);
    } else if (path.includes("disk read bytes/sec")) {
      readBytesPerSec = Math.max(0, value);
    } else if (path.includes("disk write bytes/sec")) {
      writeBytesPerSec = Math.max(0, value);
    }
  }

  return { activePercent, readBytesPerSec, writeBytesPerSec };
};

const readDiskWindows = async () => {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "(Get-Counter '\\PhysicalDisk(_Total)\\% Disk Time','\\PhysicalDisk(_Total)\\Disk Read Bytes/sec','\\PhysicalDisk(_Total)\\Disk Write Bytes/sec' -ErrorAction Stop).CounterSamples | ForEach-Object { $_.Path + '=' + $_.CookedValue }",
  ]);

  return parseWindowsPerfCounters(stdout);
};

let diskIoPrimed = false;

const readDiskFallback = async () => {
  await si.disksIO();
  const disk = await si.disksIO();
  if (!diskIoPrimed) {
    diskIoPrimed = true;
    return {
      activePercent: null,
      readBytesPerSec: 0,
      writeBytesPerSec: 0,
    };
  }

  if (!disk) {
    return {
      activePercent: null,
      readBytesPerSec: 0,
      writeBytesPerSec: 0,
    };
  }

  return {
    activePercent: null,
    readBytesPerSec: Math.max(0, disk.rIO_sec ?? 0),
    writeBytesPerSec: Math.max(0, disk.wIO_sec ?? 0),
  };
};

const readDisk = async () => {
  if (process.platform === "win32") {
    try {
      return await readDiskWindows();
    } catch {
      return readDiskFallback();
    }
  }

  return readDiskFallback();
};

export const getSystemStatus = async (): Promise<SystemStatus> => {
  const [cpuPercent, memory, gpu, network, disk] = await Promise.all([
    readCpuPercent(),
    readMemory(),
    readGpu(),
    readNetwork(),
    readDisk(),
  ]);

  return {
    cpuPercent,
    memory,
    gpu,
    network,
    disk,
  };
};
