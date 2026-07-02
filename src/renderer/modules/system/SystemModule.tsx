import { memo, useCallback, useEffect, useState } from "react";
import type { SystemStatus } from "../../../shared/contracts";

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
};

const formatRate = (bytesPerSec: number) => {
  if (bytesPerSec >= 1024 ** 3) {
    return `${(bytesPerSec / 1024 ** 3).toFixed(1)} GB/s`;
  }
  if (bytesPerSec >= 1024 ** 2) {
    return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  return `${Math.round(bytesPerSec)} B/s`;
};

function MetricCell({
  label,
  value,
  detail,
  unavailable = false,
}: {
  label: string;
  value: number;
  detail?: string;
  unavailable?: boolean;
}) {
  const tone = !unavailable && value >= 85 ? "warn" : "accent";

  return (
    <div
      className={`system-row system-row--metric system-row--${unavailable ? "muted" : tone}`}
    >
      <div className="system-row-top">
        <span>{label}</span>
        <strong>{unavailable ? "—" : `${value}%`}</strong>
      </div>
      {!unavailable && (
        <div className="system-row-track" aria-hidden>
          <span style={{ transform: `scaleX(${value / 100})` }} />
        </div>
      )}
      {detail && <small>{detail}</small>}
    </div>
  );
}

function ThroughputCell({
  label,
  download,
  upload,
}: {
  label: string;
  download: number;
  upload: number;
}) {
  return (
    <div className="system-row system-row--throughput">
      <span>{label}</span>
      <div className="system-row-values">
        <strong title="Download">↓ {formatRate(download)}</strong>
        <strong title="Upload">↑ {formatRate(upload)}</strong>
      </div>
    </div>
  );
}

export const SystemModule = memo(function SystemModule() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await window.electronControl.system.getStatus());
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel ler o status do sistema.",
      );
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), 2000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  return (
    <div className="module-content system-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">PERFORMANCE</span>
          <h2>Sistema</h2>
        </div>
        <div className="module-actions">
          <button
            className="module-action-icon weather-refresh-button"
            aria-label="Atualizar status do sistema"
            title="Atualizar"
            onClick={() => void loadStatus()}
          />
        </div>
      </div>

      <div className="module-body system-body">
        {error && !status && (
          <div className="system-empty">
            <strong>Status indisponivel</strong>
            <span>{error}</span>
          </div>
        )}

        {status && (
          <div className="system-stack">
            <div className="system-grid">
              <MetricCell label="CPU" value={status.cpuPercent} />
              <MetricCell
                label="RAM"
                value={status.memory.usedPercent}
                detail={`${formatBytes(status.memory.usedBytes)} / ${formatBytes(status.memory.totalBytes)}`}
              />
              <MetricCell
                label="GPU"
                value={status.gpu.utilizationPercent ?? 0}
                unavailable={!status.gpu.available}
                detail={status.gpu.label ?? "Sem sensor"}
              />
              <MetricCell
                label="Disco"
                value={status.disk.activePercent ?? 0}
                unavailable={status.disk.activePercent === null}
                detail={`↓ ${formatRate(status.disk.readBytesPerSec)} · ↑ ${formatRate(status.disk.writeBytesPerSec)}`}
              />
            </div>
            <ThroughputCell
              label="Rede"
              download={status.network.downloadBytesPerSec}
              upload={status.network.uploadBytesPerSec}
            />
          </div>
        )}
      </div>
    </div>
  );
});
