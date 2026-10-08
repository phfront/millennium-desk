import {
  memo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useSnackbar } from "../../components/Snackbar";
import { SoundName, SoundWave } from "./SoundTileParts";
import { SoundTileMenu } from "./SoundTileMenu";
import { soundTileStyle } from "./soundLook";
import {
  forgetSoundAudio,
  getPlayingSnapshot,
  previewSavedSound,
  stopAllSounds,
  stopSound,
  subscribePlaying,
  toggleSound,
} from "./soundPlayer";
import type {
  SoundboardSettings,
  SoundItem,
} from "../../../shared/contracts";

/** Segurar este tempo parado abre o menu; mexer depois disso vira arraste. */
const HOLD_MS = 450;
/** Quanto o dedo pode tremer sem deixar de ser toque (ou de ser "segurar parado"). */
const MOVE_TOLERANCE = 10;

/** O gesto num botao, fora do estado do React (o ponteiro anda mais rapido que o render). */
interface Gesture {
  id: number;
  pointerId: number;
  tile: HTMLElement;
  startX: number;
  startY: number;
  /** Ultima posicao do ponteiro: o fantasma nasce nela. */
  x: number;
  y: number;
  /** Onde o ponteiro pegou o botao, para o fantasma nao pular. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  timer: number | null;
  /** Passou do tempo de segurar: o menu abriu. */
  held: boolean;
  /** Mexeu antes do tempo: nao e toque nem segurar, o gesto so termina. */
  cancelled: boolean;
  /** Mexeu depois de segurar: e arraste. */
  moved: boolean;
  /** Slot sob o ponteiro (onde o som cai). */
  overSlot: number;
}

export const SoundboardModule = memo(function SoundboardModule({
  sounds,
  settings,
  onConfigure,
  onAddAtSlot,
  onEdit,
  onDelete,
  onPlace,
}: {
  sounds: SoundItem[];
  settings: SoundboardSettings;
  onConfigure: () => void;
  onAddAtSlot: (slot: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => Promise<void>;
  onPlace: (id: number, slot: number) => Promise<void>;
}) {
  const { showSnackbar } = useSnackbar();
  const playing = useSyncExternalStore(subscribePlaying, getPlayingSnapshot);
  const { columns, rows } = settings.grid;
  const slotCount = columns * rows;

  const [menu, setMenu] = useState<{ id: number; anchor: DOMRect } | null>(null);
  const [heldId, setHeldId] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: number; overSlot: number } | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  // O click vem depois do pointerup: segurar, arrastar ou tocar fora do menu nao tocam o som
  const clickBlocked = useRef(false);

  const latest = useRef({ sounds, onPlace, showSnackbar });
  latest.current = { sounds, onPlace, showSnackbar };

  const toggle = async (sound: SoundItem) => {
    try {
      await toggleSound(sound, settings);
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : "Falha ao tocar o som.",
      );
    }
  };

  const slotFromPoint = (clientX: number, clientY: number) => {
    const element = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-sound-slot]");
    if (!element || !gridRef.current?.contains(element)) return null;
    const slot = Number(element.dataset.soundSlot);
    return Number.isInteger(slot) && slot >= 0 ? slot : null;
  };

  const moveGhost = (x: number, y: number) => {
    const gesture = gestureRef.current;
    const ghost = ghostRef.current;
    if (!gesture || !ghost) return;
    ghost.style.transform = `translate(${x - gesture.offsetX}px, ${y - gesture.offsetY}px) scale(1.04)`;
  };

  const handleTilePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    sound: SoundItem,
  ) => {
    if (event.button !== 0 || gestureRef.current) return;
    // Sem selecionar texto nem focar o botao (o anel de foco fica so para o teclado)
    event.preventDefault();
    const tile = event.currentTarget;
    const box = tile.getBoundingClientRect();
    const gesture: Gesture = {
      id: sound.id,
      pointerId: event.pointerId,
      tile,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - box.left,
      offsetY: event.clientY - box.top,
      width: box.width,
      height: box.height,
      timer: null,
      held: false,
      cancelled: false,
      moved: false,
      overSlot: sound.gridSlot,
    };
    gesture.timer = window.setTimeout(() => {
      gesture.timer = null;
      if (gestureRef.current !== gesture || gesture.cancelled) return;
      gesture.held = true;
      setHeldId(gesture.id);
      setMenu({ id: gesture.id, anchor: gesture.tile.getBoundingClientRect() });
    }, HOLD_MS);
    gestureRef.current = gesture;
  };

  // Ponteiro ouvido na janela, nao no botao: no arraste a grade redesenha a troca e o ponteiro
  // sai do botao que foi pego
  useEffect(() => {
    const end = (gesture: Gesture) => {
      if (gesture.timer !== null) window.clearTimeout(gesture.timer);
      gestureRef.current = null;
      setHeldId(null);
      setDrag(null);
    };
    const handleMove = (event: globalThis.PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId || gesture.cancelled) return;
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      const far =
        Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >
        MOVE_TOLERANCE;
      if (!gesture.held) {
        if (far) {
          gesture.cancelled = true;
          if (gesture.timer !== null) window.clearTimeout(gesture.timer);
          gesture.timer = null;
        }
        return;
      }
      if (!gesture.moved) {
        if (!far) return;
        gesture.moved = true;
        setMenu(null);
      }
      gesture.overSlot = slotFromPoint(event.clientX, event.clientY) ?? gesture.overSlot;
      moveGhost(event.clientX, event.clientY);
      setDrag((current) =>
        current && current.overSlot === gesture.overSlot
          ? current
          : { id: gesture.id, overSlot: gesture.overSlot },
      );
    };
    const handleUp = (event: globalThis.PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (gesture.held || gesture.cancelled) clickBlocked.current = true;
      const { sounds: current, onPlace: place, showSnackbar: notify } = latest.current;
      const sound = gesture.moved
        ? current.find((item) => item.id === gesture.id)
        : undefined;
      const slot = slotFromPoint(event.clientX, event.clientY) ?? gesture.overSlot;
      if (!sound || slot === sound.gridSlot) {
        end(gesture);
        return;
      }
      // A previa da troca fica na grade ate a lista nova chegar: sem piscar a ordem antiga
      if (gesture.timer !== null) window.clearTimeout(gesture.timer);
      gestureRef.current = null;
      setHeldId(null);
      setDrag({ id: sound.id, overSlot: slot });
      void place(sound.id, slot)
        .catch((error: unknown) =>
          notify(error instanceof Error ? error.message : "Falha ao mover o som."),
        )
        .finally(() => setDrag(null));
    };
    const handleCancel = (event: globalThis.PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      end(gesture);
      // Segurou e o Chromium cancelou o ponteiro (menu de contexto do toque): o menu fica
      if (gesture.held) clickBlocked.current = true;
    };
    const handleKey = (event: KeyboardEvent) => {
      const gesture = gestureRef.current;
      if (event.key === "Escape" && gesture?.moved) end(gesture);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKey);
      const gesture = gestureRef.current;
      if (gesture?.timer != null) window.clearTimeout(gesture.timer);
    };
  }, []);

  // Cada toque novo comeca liberado; com o menu aberto, tocar fora so fecha o menu
  useEffect(() => {
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Element | null;
      clickBlocked.current = Boolean(menu && !target?.closest(".sound-tile-menu"));
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [menu]);

  const handleTileClick = (event: MouseEvent<HTMLButtonElement>, sound: SoundItem) => {
    // detail 0: Enter/Espaco pelo teclado, que nunca e bloqueado
    if (event.detail !== 0 && clickBlocked.current) {
      clickBlocked.current = false;
      return;
    }
    void toggle(sound);
  };

  const handleTileContextMenu = (
    event: MouseEvent<HTMLButtonElement>,
    sound: SoundItem,
  ) => {
    event.preventDefault();
    // No toque o Chromium tambem dispara o contextmenu ao segurar: o temporizador ja cuida
    if (gestureRef.current) return;
    setMenu({ id: sound.id, anchor: event.currentTarget.getBoundingClientRect() });
  };

  const menuSound = menu ? sounds.find((sound) => sound.id === menu.id) : undefined;

  const removeSound = async (sound: SoundItem) => {
    setMenu(null);
    stopSound(sound.id);
    forgetSoundAudio(sound.id);
    try {
      await onDelete(sound.id);
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : "Falha ao remover o som.");
    }
  };

  const previewSound = async (sound: SoundItem) => {
    setMenu(null);
    try {
      await previewSavedSound(sound, sound.volume, settings);
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : "Falha ao tocar o som.");
    }
  };

  const draggedSound = drag ? sounds.find((sound) => sound.id === drag.id) : undefined;

  // Durante o arraste a grade mostra o resultado: o som (apagado) no slot de destino e o
  // ocupante dele no slot de origem; o som de verdade vai no fantasma, com o ponteiro
  const soundShownAt = (slot: number): SoundItem | undefined => {
    const occupant = sounds.find((sound) => sound.gridSlot === slot);
    if (!draggedSound || !drag) return occupant;
    if (slot === drag.overSlot) return draggedSound;
    if (slot === draggedSound.gridSlot) {
      return sounds.find(
        (sound) => sound.gridSlot === drag.overSlot && sound.id !== draggedSound.id,
      );
    }
    return occupant;
  };

  // Soltou e a troca esta indo para o banco: o fantasma some e o som deixa de ficar apagado
  const gesture = gestureRef.current;
  const dragActive = Boolean(drag && gesture?.moved);
  const dragGhost =
    dragActive &&
    draggedSound &&
    gesture &&
    createPortal(
      <div
        ref={(node) => {
          ghostRef.current = node;
          if (node && !node.style.transform) {
            node.style.transform = `translate(${gesture.x - gesture.offsetX}px, ${gesture.y - gesture.offsetY}px) scale(1.04)`;
          }
        }}
        className="sound-tile sound-tile-ghost"
        style={{
          ...soundTileStyle(draggedSound.color, draggedSound.color2),
          width: gesture.width,
          height: gesture.height,
        }}
        aria-hidden="true"
      >
        <SoundName name={draggedSound.name} />
        <SoundWave sound={draggedSound} />
      </div>,
      document.querySelector<HTMLElement>(".app") ?? document.body,
    );

  return (
    <div className="module-content shortcuts-module soundboard-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">NO MICROFONE</span>
          <h2>Sons</h2>
        </div>
        <div className="module-actions">
          {playing.size > 0 && (
            <button
              className="module-action-icon sound-stop-button"
              aria-label="Parar todos os sons"
              title="Parar tudo"
              onClick={stopAllSounds}
            />
          )}
          <button
            className="module-action-icon module-config-button"
            aria-label="Configurar sons"
            onClick={onConfigure}
          />
        </div>
      </div>
      <div className="module-body shortcuts-body">
        <div
          ref={gridRef}
          className={dragActive ? "shortcuts-grid sound-grid--dragging" : "shortcuts-grid"}
          style={{
            "--shortcut-columns": columns,
            "--shortcut-rows": rows,
          } as React.CSSProperties}
        >
          {Array.from({ length: slotCount }, (_, slot) => {
            const position = {
              gridColumn: (slot % columns) + 1,
              gridRow: Math.floor(slot / columns) + 1,
            };
            const sound = soundShownAt(slot);
            if (!sound) {
              return (
                <button
                  key={`empty-${slot}`}
                  type="button"
                  data-sound-slot={slot}
                  className="shortcut-tile shortcut-tile--empty"
                  style={position}
                  aria-label={`Adicionar som no slot ${slot + 1}`}
                  title="Adicionar som"
                  onClick={() => onAddAtSlot(slot)}
                >
                  <span className="shortcut-tile-add-icon" aria-hidden="true">
                    +
                  </span>
                </button>
              );
            }

            const state = playing.get(sound.id);
            return (
              <button
                key={sound.id}
                type="button"
                data-sound-slot={slot}
                className={[
                  "sound-tile",
                  state ? "sound-tile--playing" : "",
                  state?.duration ? "sound-tile--timed" : "",
                  heldId === sound.id || menu?.id === sound.id ? "sound-tile--held" : "",
                  dragActive && drag?.id === sound.id ? "sound-tile--drop" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={
                  {
                    ...position,
                    ...soundTileStyle(sound.color, sound.color2),
                    ...(state?.duration
                      ? {
                          "--sound-duration": `${state.duration}s`,
                          // A duracao chega depois do play: o progresso comeca do ponto certo
                          "--sound-delay": `-${(Date.now() - state.startedAt) / 1000}s`,
                        }
                      : {}),
                  } as React.CSSProperties
                }
                aria-label={state ? `${sound.name}, tocando: toque para parar` : sound.name}
                aria-pressed={Boolean(state)}
                aria-haspopup="menu"
                title={
                  state
                    ? "Toque para parar"
                    : `Tocar ${sound.name} · segure para mais opções`
                }
                onPointerDown={(event) => handleTilePointerDown(event, sound)}
                onClick={(event) => handleTileClick(event, sound)}
                onContextMenu={(event) => handleTileContextMenu(event, sound)}
              >
                <SoundName name={sound.name} />
                <SoundWave sound={sound} />
              </button>
            );
          })}
        </div>
      </div>
      {menu && menuSound && (
        <SoundTileMenu
          key={menu.id}
          sound={menuSound}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setMenu(null);
            onEdit(menuSound.id);
          }}
          onPreview={() => void previewSound(menuSound)}
          onDelete={() => void removeSound(menuSound)}
        />
      )}
      {dragGhost}
    </div>
  );
});
