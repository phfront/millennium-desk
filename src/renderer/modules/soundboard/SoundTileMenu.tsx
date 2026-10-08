import { useState } from "react";
import type { SoundItem } from "../../../shared/contracts";
import { SoundPopover } from "./SoundPopover";
import { soundTileStyle } from "./soundLook";

const CloseItem = ({ onClose }: { onClose: () => void }) => (
  <>
    <span className="sound-tile-menu-divider" aria-hidden="true" />
    <button
      type="button"
      role="menuitem"
      className="sound-tile-menu-item sound-tile-menu-item--close"
      aria-label="Fechar"
      title="Fechar"
      onClick={onClose}
    />
  </>
);

/**
 * O menu do toque longo num som: Editar, Ouvir no fone, Tirar da grade (o som fica no
 * catalogo), Excluir e o X de fechar. Excluir pede confirmacao no proprio menu.
 */
export function SoundTileMenu({
  sound,
  anchor,
  onClose,
  onEdit,
  onPreview,
  onDeactivate,
  onDelete,
}: {
  sound: SoundItem;
  anchor: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <SoundPopover
      anchor={anchor}
      className={confirming ? "sound-tile-menu sound-tile-menu--confirm" : "sound-tile-menu"}
      label={`Ações de ${sound.name}`}
      onClose={onClose}
    >
      {confirming ? (
        <>
          <span className="sound-tile-menu-question">
            Excluir “{sound.name}” de vez?
          </span>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item"
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--danger sound-tile-menu-item--solid"
            autoFocus
            onClick={onDelete}
          >
            Excluir
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--edit"
            onClick={onEdit}
          >
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--preview"
            title="Toca só no fone, sem ir para o microfone"
            onClick={onPreview}
          >
            Ouvir no fone
          </button>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--hide"
            title="O som sai da grade e fica no catálogo"
            onClick={onDeactivate}
          >
            Tirar da grade
          </button>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--delete sound-tile-menu-item--danger"
            onClick={() => setConfirming(true)}
          >
            Excluir
          </button>
        </>
      )}
      <CloseItem onClose={onClose} />
    </SoundPopover>
  );
}

/**
 * O "+" de um lugar vazio, com sons fora da grade: escolher um do catalogo para por ali, ou
 * criar um novo.
 */
export function SoundSlotPicker({
  sounds,
  anchor,
  onClose,
  onPick,
  onCreate,
}: {
  /** Os sons do catalogo que estao fora da grade. */
  sounds: SoundItem[];
  anchor: DOMRect;
  onClose: () => void;
  onPick: (sound: SoundItem) => void;
  onCreate: () => void;
}) {
  return (
    <SoundPopover
      anchor={anchor}
      className="sound-slot-picker"
      label="Pôr um som aqui"
      onClose={onClose}
    >
      <div className="sound-slot-picker-heading">
        <span>Do catálogo</span>
        <button
          type="button"
          role="menuitem"
          className="sound-tile-menu-item sound-tile-menu-item--close"
          aria-label="Fechar"
          title="Fechar"
          onClick={onClose}
        />
      </div>
      <div className="sound-slot-picker-list">
        {sounds.map((sound) => (
          <button
            key={sound.id}
            type="button"
            role="menuitem"
            className="sound-slot-picker-item"
            style={soundTileStyle(sound.color, sound.color2)}
            onClick={() => onPick(sound)}
          >
            <span className="sound-slot-picker-face" aria-hidden="true" />
            <span className="sound-slot-picker-name">{sound.name}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        role="menuitem"
        className="sound-tile-menu-item sound-tile-menu-item--new"
        onClick={onCreate}
      >
        Novo som
      </button>
    </SoundPopover>
  );
}
