import { useEffect, useRef, type FormEvent } from "react";
import { db } from "@/lib/db";
import type { Preset } from "@/lib/schemas";

// One saved preset per workspace: /research fills its title block and sections.
export function PresetDialog({ preset, onClose }: { preset: Preset; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const lines = (name: string, max: number) =>
      String(form.get(name))
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, max);
    await db.presets.put({
      id: preset.id,
      name: String(form.get("name")).trim().slice(0, 200) || preset.name,
      citationStyle: String(form.get("citationStyle")).trim().slice(0, 50) || "APA 7",
      fields: lines("fields", 30).map((line) => {
        const [label, ...rest] = line.split(":");
        return { label: label.trim().slice(0, 100), value: rest.join(":").trim().slice(0, 500) };
      }),
      sections: lines("sections", 40).map((s) => s.slice(0, 200)),
    });
    onClose();
  };

  const field = "mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm";
  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="preset-title" className="m-auto w-full max-w-lg rounded-card bg-paper p-6 text-ink backdrop:bg-ink/40">
      <form onSubmit={save} className="space-y-4">
        <div>
          <h2 id="preset-title" className="font-display text-xl font-semibold">
            Research preset
          </h2>
          <p className="text-sm text-muted">Type /research on a page to insert this title block and these sections.</p>
        </div>
        <label className="block text-xs text-muted">
          Name
          <input name="name" defaultValue={preset.name} maxLength={200} className={field} />
        </label>
        <label className="block text-xs text-muted">
          Title block, one &quot;Label: value&quot; per line (blank Title and Date fill in for you)
          <textarea name="fields" rows={5} defaultValue={preset.fields.map((f) => `${f.label}: ${f.value}`).join("\n")} className={field} />
        </label>
        <label className="block text-xs text-muted">
          Citation style
          <input name="citationStyle" defaultValue={preset.citationStyle} maxLength={50} className={field} />
        </label>
        <label className="block text-xs text-muted">
          Required sections, one per line
          <textarea name="sections" rows={7} defaultValue={preset.sections.join("\n")} className={field} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-hairline px-4 py-1.5 text-sm hover:bg-sand">
            Cancel
          </button>
          <button type="submit" className="rounded-full bg-ink px-4 py-1.5 text-sm text-paper">
            Save preset
          </button>
        </div>
      </form>
    </dialog>
  );
}
