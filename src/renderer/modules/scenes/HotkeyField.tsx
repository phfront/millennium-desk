import { useEffect, useState } from "react";

// Campo de atalho global: clicar, apertar a combinacao. Esc cancela, Backspace desliga.
// O valor e um accelerator do Electron ("Control+Alt+M").

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph"]);

const keyName = (event: KeyboardEvent) => {
  const { code, key } = event;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}`;
  const named: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    Tab: "Tab",
    Insert: "Insert",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Pause: "Pause",
    ScrollLock: "Scrolllock",
  };
  return named[code] ?? (key.length === 1 ? key.toUpperCase() : null);
};

export const formatAccelerator = (accelerator: string) =>
  accelerator
    ? accelerator
        .split("+")
        .map((part) => (part === "Control" ? "Ctrl" : part === "Super" ? "Win" : part))
        .join(" + ")
    : "Desligado";

export function HotkeyField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (accelerator: string) => void;
  label: string;
}) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const handle = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setListening(false);
        return;
      }
      if (event.key === "Backspace" && !event.ctrlKey && !event.altKey) {
        setListening(false);
        onChange("");
        return;
      }
      if (MODIFIER_KEYS.has(event.key)) return;
      const key = keyName(event);
      if (!key) return;
      const parts: string[] = [];
      if (event.ctrlKey) parts.push("Control");
      if (event.altKey) parts.push("Alt");
      if (event.shiftKey) parts.push("Shift");
      if (event.metaKey) parts.push("Super");
      // Atalho global sem Ctrl/Alt/Win roubaria a tecla de todo programa (F-keys passam)
      if (!parts.some((part) => part !== "Shift") && !/^F\d+$/.test(key)) return;
      parts.push(key);
      setListening(false);
      onChange(parts.join("+"));
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [listening, onChange]);

  return (
    <button
      type="button"
      className={["control-hotkey", listening ? "control-hotkey--listening" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${label}: ${formatAccelerator(value)}. Clique para trocar.`}
      onClick={() => setListening((current) => !current)}
      onBlur={() => setListening(false)}
    >
      {listening ? "Aperte a combinação… (Esc cancela, ⌫ desliga)" : <kbd>{formatAccelerator(value)}</kbd>}
    </button>
  );
}
