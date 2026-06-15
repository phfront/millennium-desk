export function ModuleSettingsContent({
  title,
  description,
  options,
}: {
  title: string;
  description: string;
  options: string[];
}) {
  return (
    <>
      <section className="setting-group">
        <h3>{title}</h3>
        <p className="muted">{description}</p>
      </section>
      <section className="setting-group module-setting-list">
        {options.map((option) => (
          <label key={option}>
            <span>{option}</span>
            <input type="checkbox" defaultChecked />
          </label>
        ))}
      </section>
    </>
  );
}


