import { useEffect, useRef, useState, type ReactNode } from "react";

// Pecas pequenas do Controle: interruptor, segmentado e slider que nao briga com o estado
// que chega do Windows enquanto o dedo ainda esta nele.

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="control-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T | null;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="control-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * value/onChange de 0 a 1. Enquanto arrasta, mostra o valor local e manda as mudancas com um
 * respiro (o ajudante aguenta, mas nao precisa de 60 por segundo); o valor de fora so volta a
 * valer quando solta.
 */
export function VolumeSlider({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const shown = draft ?? value;
  const send = (next: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      latest.current(next);
    }, 60);
  };

  return (
    <div className="control-slider">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(shown * 100)}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value) / 100;
          setDraft(next);
          send(next);
        }}
        onPointerUp={() => window.setTimeout(() => setDraft(null), 400)}
        onKeyUp={() => window.setTimeout(() => setDraft(null), 400)}
      />
      <output>{Math.round(shown * 100)}%</output>
    </div>
  );
}

export function ControlRow({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="control-row">
      <span className="control-row-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <div className="control-row-value">{children}</div>
    </div>
  );
}

export function ControlSection({
  title,
  description,
  tag,
  children,
}: {
  title: string;
  description?: ReactNode;
  tag?: string;
  children: ReactNode;
}) {
  return (
    <section className="control-section">
      <div className="control-section-head">
        <h3>{title}</h3>
        {tag && <span className="control-tag">{tag}</span>}
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
