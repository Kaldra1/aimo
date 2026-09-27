import { useRef } from 'preact/hooks';
import { IconOpen, IconSave, IconShare } from './icons';

export interface Notice {
  kind: 'info' | 'error';
  text: string;
}

interface Props {
  idPrefix: string;
  examples: readonly { id: string; title: string }[];
  onExample: (id: string) => void;
  onSave: () => void;
  onOpenFile: (text: string) => void;
  onShare: () => void;
  notice: Notice | null;
}

/** Приклади, збереження у файл, завантаження з файлу й посилання «Поділитися». */
export function ProgramActions({
  idPrefix,
  examples,
  onExample,
  onSave,
  onOpenFile,
  onShare,
  notice,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (file) onOpenFile(await file.text());
  };

  return (
    <div class="program-actions">
      <label class="field field--inline" for={`${idPrefix}-example`}>
        <span class="field__label">Приклади</span>
        <select
          id={`${idPrefix}-example`}
          class="input"
          value=""
          onChange={(event) => {
            const id = event.currentTarget.value;
            event.currentTarget.value = '';
            if (id) onExample(id);
          }}
        >
          <option value="">Оберіть приклад…</option>
          {examples.map((example) => (
            <option key={example.id} value={example.id}>
              {example.title}
            </option>
          ))}
        </select>
      </label>

      <div class="program-actions__buttons">
        <button type="button" class="button button--secondary" onClick={onSave}>
          <IconSave />
          Зберегти
        </button>
        <button
          type="button"
          class="button button--secondary"
          onClick={() => fileRef.current?.click()}
        >
          <IconOpen />
          Завантажити
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          class="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void readFile(event.currentTarget)}
        />
        <button type="button" class="button button--secondary" onClick={onShare}>
          <IconShare />
          Поділитися
        </button>
      </div>

      <p class={`program-actions__notice${notice ? ` is-${notice.kind}` : ''}`} role="status">
        {notice?.text}
      </p>
    </div>
  );
}
