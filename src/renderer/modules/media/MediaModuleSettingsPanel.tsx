import {
  MEDIA_APPS,
  type MediaAppId,
} from "../../../shared/mediaApps";

export function MediaModuleSettingsPanel({
  hiddenAppIds,
  onToggleApp,
}: {
  hiddenAppIds: MediaAppId[];
  onToggleApp: (appId: MediaAppId, visible: boolean) => void;
}) {
  const visibleCount = MEDIA_APPS.length - hiddenAppIds.length;

  return (
    <>
      <section className="setting-group">
        <h3>Apps no dock</h3>
        <p className="muted">
          Escolha quais apps aparecem no dock. Apps desativados sao descarregados
          da memoria e param de reproduzir, mas o login e mantido.
        </p>
      </section>
      <section className="setting-group module-setting-list">
        {MEDIA_APPS.map((app) => {
          const visible = !hiddenAppIds.includes(app.id);
          const isLastVisible = visible && visibleCount <= 1;

          return (
            <label key={app.id}>
              <span>{app.label}</span>
              <input
                type="checkbox"
                checked={visible}
                disabled={isLastVisible}
                title={
                  isLastVisible
                    ? "Pelo menos um app precisa ficar visivel no dock."
                    : undefined
                }
                onChange={(event) =>
                  onToggleApp(app.id, event.target.checked)
                }
              />
            </label>
          );
        })}
      </section>
    </>
  );
}
