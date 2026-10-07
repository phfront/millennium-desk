import { useEffect, useRef, useState } from "react";
import {
  isVirtualCable,
  resolveDevices,
  shortDeviceName,
  toDeviceRef,
  visibleApps,
  voiceStatus,
  type AudioControlSettings,
  type AudioState,
} from "../../../shared/audioControl";
import type { AudioHotkeyAction, SoundboardSettings } from "../../../shared/contracts";
import { useSnackbar } from "../../components/Snackbar";
import { runAudio } from "./audioStore";
import { ControlRow, ControlSection, Segmented, Switch, VolumeSlider } from "./controls";
import { HotkeyField } from "./HotkeyField";
import { MicIcon, MuteSpeakerIcon } from "./icons";
import { LevelMeter, openInput } from "./LevelMeter";

const TEST_SECONDS = 5;

export function AudioTab({
  state,
  settings,
  soundboard,
  onSettingsChange,
  onSoundboardChange,
  onToggleMute,
}: {
  state: AudioState;
  settings: AudioControlSettings;
  soundboard: SoundboardSettings;
  onSettingsChange: (next: AudioControlSettings) => Promise<void> | void;
  onSoundboardChange: (patch: Partial<SoundboardSettings>) => Promise<void>;
  onToggleMute: () => void;
}) {
  const { showSnackbar } = useSnackbar();
  const devices = resolveDevices(state, settings);
  const voice = voiceStatus(devices);
  const api = window.electronControl.audio;
  const [hotkeyResult, setHotkeyResult] = useState<Record<AudioHotkeyAction, boolean> | null>(null);

  const run = (label: string, task: () => Promise<unknown>) =>
    void runAudio(task).catch((error) =>
      showSnackbar(`${label}: ${error instanceof Error ? error.message : String(error)}`),
    );

  const outputs = state.outputs;
  const physicalInputs = state.inputs.filter((device) => !isVirtualCable(device));
  const apps = visibleApps(state.apps);
  // Outro cabo da VB-Audio (o A/B): o do ditado do Shello, separado da reuniao
  const dictationCable = state.inputs.find(
    (device) => isVirtualCable(device) && device.driver !== devices.cableInput?.driver,
  );

  const changeHotkey = async (action: AudioHotkeyAction, accelerator: string) => {
    await onSettingsChange({
      ...settings,
      hotkeys: { ...settings.hotkeys, [action]: accelerator },
    });
    setHotkeyResult(await api.syncHotkeys());
  };

  return (
    <>
      <ControlSection
        title="Agora"
        description="Mexer aqui não muda a cena salva; o quadradinho mostra “ajustado” até você trocar de cena."
      >
        <ControlRow label="Ouvir em">
          <select
            className="control-select"
            value={devices.defaultOutput?.id ?? ""}
            aria-label="Saída padrão do Windows"
            onChange={(event) => run("Saída", () => api.setDefault(event.target.value))}
          >
            {!devices.defaultOutput && <option value="">Nenhuma</option>}
            {outputs.map((device) => (
              <option key={device.id} value={device.id}>
                {shortDeviceName(device)}
                {isVirtualCable(device) ? " · cabo virtual" : ""}
              </option>
            ))}
          </select>
        </ControlRow>
        {devices.defaultOutput && (
          <ControlRow label="Volume da saída">
            <VolumeSlider
              label="Volume da saída"
              value={devices.defaultOutput.volume}
              onChange={(value) => run("Volume", () => api.setVolume(devices.defaultOutput!.id, value))}
            />
          </ControlRow>
        )}
        <ControlRow label="Minha voz" hint="microfone padrão do Windows">
          <Segmented
            label="Rota da voz"
            value={voice.route}
            disabled={!devices.mic}
            options={[
              { value: "cable", label: "Pelo cabo · voz + Sons" },
              { value: "direct", label: "Microfone direto" },
            ]}
            onChange={(route) => run("Microfone", () => api.setVoice(route))}
          />
        </ControlRow>
      </ControlSection>

      <ControlSection
        title="Na reunião"
        description={
          voice.route === "cable"
            ? `A reunião ouve ${shortDeviceName(devices.cableInput)}: sua voz (pelo “Escutar” do microfone) e os Sons do Desk.`
            : `A reunião ouve ${shortDeviceName(devices.mic)} direto. Os Sons do Desk não chegam lá nesse modo.`
        }
      >
        <div className="control-voice-card">
          <button
            type="button"
            className={["control-mute", voice.muted ? "control-mute--off" : ""].filter(Boolean).join(" ")}
            aria-pressed={voice.muted}
            aria-label={voice.muted ? "Ligar minha voz" : "Mutar minha voz"}
            disabled={!devices.mic}
            onClick={onToggleMute}
          >
            <MicIcon muted={voice.muted} size={24} />
          </button>
          <div>
            <h4>{voice.muted ? "Minha voz está mutada na reunião" : "Minha voz está indo para a reunião"}</h4>
            <p>
              {voice.route === "cable"
                ? "Mutar desliga o “Escutar” do microfone. Os Sons continuam tocando."
                : "Mutar silencia o microfone em todos os apps."}
            </p>
          </div>
        </div>
        <LevelMeter deviceName={devices.mic?.name} label={shortDeviceName(devices.mic) || "Microfone"} />
        <LevelMeter
          deviceName={voice.route === "cable" ? devices.cableInput?.name : devices.mic?.name}
          label="O que a reunião ouve"
        />
        {devices.mic && (
          <ControlRow label={`Volume do ${shortDeviceName(devices.mic)}`} hint="vale para todos os apps">
            <VolumeSlider
              label="Volume do microfone"
              value={devices.mic.volume}
              onChange={(value) => run("Microfone", () => api.setVolume(devices.mic!.id, value))}
            />
          </ControlRow>
        )}
        {devices.cableInput && (
          <ControlRow label="Volume do cabo" hint="tudo o que entra pelo cabo">
            <VolumeSlider
              label="Volume do cabo"
              value={devices.cableInput.volume}
              onChange={(value) => run("Cabo", () => api.setVolume(devices.cableInput!.id, value))}
            />
          </ControlRow>
        )}
        <ControlRow label="Sons no cabo">
          <VolumeSlider
            label="Volume dos Sons no cabo"
            value={soundboard.volume}
            onChange={(value) => void onSoundboardChange({ volume: value })}
          />
        </ControlRow>
        <ControlRow label="Retorno no fone" hint="você ouvindo os Sons">
          <VolumeSlider
            label="Volume do retorno dos Sons"
            value={soundboard.monitorVolume}
            disabled={!soundboard.monitorEnabled}
            onChange={(value) => void onSoundboardChange({ monitorVolume: value })}
          />
        </ControlRow>
      </ControlSection>

      <ControlSection
        title="Teste rápido"
        description={`Grava ${TEST_SECONDS} segundos do que a reunião ouve e toca de volta na saída padrão.`}
      >
        <MeetingTest
          inputName={voice.route === "cable" ? devices.cableInput?.name : devices.mic?.name}
        />
      </ControlSection>

      <ControlSection title="Apps" description="Volume de cada programa com som aberto agora.">
        {apps.length === 0 ? (
          <p className="control-hint">Nenhum app com som aberto.</p>
        ) : (
          <div className="control-apps">
            {apps.map((app) => (
              <div key={app.key} className="control-app">
                <span className="control-app-logo" style={{ background: appColor(app.key) }}>
                  {app.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="control-app-name">
                  <strong>{app.name}</strong>
                  <small>{app.active ? "tocando" : "parado"}</small>
                </span>
                <VolumeSlider
                  label={`Volume do ${app.name}`}
                  value={app.volume}
                  disabled={app.muted}
                  onChange={(value) => run(app.name, () => api.setAppVolume(app.key, value))}
                />
                <button
                  type="button"
                  className="control-icon-button"
                  aria-pressed={app.muted}
                  aria-label={`${app.muted ? "Desmutar" : "Mutar"} ${app.name}`}
                  onClick={() => run(app.name, () => api.setAppMute(app.key, !app.muted))}
                >
                  <MuteSpeakerIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </ControlSection>

      <ControlSection title="Aparelhos" description="O Desk acha o cabo pelo driver da VB-Audio, mesmo renomeado.">
        <ControlRow label="Seu microfone">
          <select
            className="control-select"
            value={settings.mic ? (devices.mic?.id ?? "") : ""}
            aria-label="Seu microfone"
            onChange={(event) => {
              const device = physicalInputs.find((item) => item.id === event.target.value);
              void onSettingsChange({ ...settings, mic: device ? toDeviceRef(device) : null });
            }}
          >
            <option value="">Automático{!settings.mic && devices.mic ? ` (${shortDeviceName(devices.mic)})` : ""}</option>
            {physicalInputs.map((device) => (
              <option key={device.id} value={device.id}>
                {shortDeviceName(device)}
              </option>
            ))}
          </select>
        </ControlRow>
        <div className="control-cables">
          <div className={["control-cable", devices.cableInput ? "" : "control-cable--missing"].filter(Boolean).join(" ")}>
            <div className="control-cable-head">
              <strong>Reunião</strong>
              <span className={devices.cableInput ? "control-chip" : "control-chip control-chip--muted"}>
                {devices.cableInput ? "encontrado" : "não encontrado"}
              </span>
            </div>
            <p>
              <b>{shortDeviceName(devices.mic) || "microfone"}</b> (Escutar) + <b>Sons do Desk</b>
              <br />→ {shortDeviceName(devices.cableOutput) || "cabo"} (saída do cabo) →{" "}
              {shortDeviceName(devices.cableInput) || "cabo"} (microfone do cabo)
              <br />→ <b>Teams/Meet</b>
            </p>
          </div>
          <div className={["control-cable", dictationCable ? "" : "control-cable--missing"].filter(Boolean).join(" ")}>
            <div className="control-cable-head">
              <strong>Ditado do Shello</strong>
              <span className={dictationCable ? "control-chip" : "control-chip control-chip--muted"}>
                {dictationCable ? "cabo separado" : "usa o mesmo cabo"}
              </span>
            </div>
            <p>
              {dictationCable ? (
                <>
                  <b>celular</b> (mic-bridge) → <b>{shortDeviceName(dictationCable)}</b> → /voice do Claude
                </>
              ) : (
                <>Sem um segundo cabo (VB-CABLE A+B), um ditado pelo celular com reunião aberta cai na reunião.</>
              )}
            </p>
          </div>
        </div>
      </ControlSection>

      <ControlSection title="Proteções">
        <ControlRow label="Cabo como saída">
          <span className="control-inline">
            <Switch
              label="Avisar se o cabo virar a saída do Windows"
              checked={settings.warnings.cableOutput}
              onChange={(on) =>
                void onSettingsChange({ ...settings, warnings: { ...settings.warnings, cableOutput: on } })
              }
            />
            <small className="control-hint">Avisar se o cabo virar a saída do Windows</small>
          </span>
        </ControlRow>
        <ControlRow label="Microfone preso">
          <span className="control-inline">
            <Switch
              label="Avisar se o microfone ficar no cabo"
              checked={settings.warnings.micStuck}
              onChange={(on) =>
                void onSettingsChange({ ...settings, warnings: { ...settings.warnings, micStuck: on } })
              }
            />
            <small className="control-hint">Avisar se o microfone ficar no cabo quando a cena usa o direto</small>
          </span>
        </ControlRow>
        <ControlRow label="Abaixar sons em chamadas">
          <span className="control-inline">
            <Switch
              label="Abaixar outros sons durante chamadas"
              checked={state.ducking}
              disabled={!state.available}
              onChange={(on) => run("Comunicações", () => api.setDucking(on))}
            />
            <small className="control-hint">
              {state.ducking
                ? "Ligado: o Windows abaixa os outros sons quando uma chamada abre"
                : "Desligado: o Spotify não abaixa sozinho quando o Teams abre"}
            </small>
          </span>
        </ControlRow>
      </ControlSection>

      <ControlSection title="Teclas de atalho" description="Valem em qualquer programa, com o Desk aberto.">
        <ControlRow label="Abrir o controle">
          <HotkeyField
            label="Abrir o controle"
            value={settings.hotkeys.open}
            onChange={(accelerator) => void changeHotkey("open", accelerator)}
          />
        </ControlRow>
        <ControlRow label="Mutar a voz">
          <HotkeyField
            label="Mutar a voz"
            value={settings.hotkeys.mute}
            onChange={(accelerator) => void changeHotkey("mute", accelerator)}
          />
        </ControlRow>
        {hotkeyResult &&
          (["open", "mute"] as AudioHotkeyAction[])
            .filter((action) => settings.hotkeys[action] && !hotkeyResult[action])
            .map((action) => (
              <p key={action} className="control-error">
                Outro programa já usa {settings.hotkeys[action].replace("Control", "Ctrl")}: escolha outra
                combinação.
              </p>
            ))}
      </ControlSection>
    </>
  );
}

function MeetingTest({ inputName }: { inputName?: string }) {
  const [phase, setPhase] = useState<"idle" | "recording" | "ready" | "playing">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const record = async () => {
    if (!inputName) return;
    setError(null);
    try {
      const stream = await openInput(inputName);
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const done = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();
      setPhase("recording");
      const started = Date.now();
      const timer = window.setInterval(() => {
        const elapsed = (Date.now() - started) / 1000;
        setProgress(Math.min(1, elapsed / TEST_SECONDS));
        if (elapsed >= TEST_SECONDS) {
          window.clearInterval(timer);
          recorder.stop();
        }
      }, 100);
      await done;
      stream.getTracks().forEach((track) => track.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
      setPhase("ready");
    } catch (recordError) {
      setPhase("idle");
      setError(recordError instanceof Error ? recordError.message : "Não deu para gravar.");
    }
  };

  const play = () => {
    if (!urlRef.current) return;
    audioRef.current?.pause();
    const audio = new Audio(urlRef.current);
    audioRef.current = audio;
    audio.onended = () => setPhase("ready");
    setPhase("playing");
    void audio.play().catch(() => setPhase("ready"));
  };

  return (
    <div className="control-test">
      <button
        type="button"
        className="button"
        disabled={!inputName || phase === "recording"}
        onClick={() => void record()}
      >
        {phase === "recording" ? "Gravando…" : phase === "idle" ? `Gravar ${TEST_SECONDS} s` : "Gravar de novo"}
      </button>
      <span className="control-progress" aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </span>
      <button
        type="button"
        className="button"
        disabled={phase !== "ready" && phase !== "playing"}
        onClick={play}
      >
        {phase === "playing" ? "Tocando…" : "Ouvir"}
      </button>
      {error && <p className="control-error">{error}</p>}
    </div>
  );
}

const appColor = (key: string) => {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 55% 45%)`;
};
