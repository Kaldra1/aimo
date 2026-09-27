/** Табличний режим програми Поста: Номер | Команда | Перехід | Коментар, синхронно з текстом. */
import { ROW_OPS, type PostRow } from '../../lib/machines/post';

interface Props {
  rows: readonly PostRow[];
  onChange: (rows: PostRow[]) => void;
  /** Рядки з помилками (номер рядка таблиці = номер рядка тексту). */
  errorLines: ReadonlySet<number>;
  currentLine: number | null;
  readOnly: boolean;
}

const OP_LABELS: Record<string, string> = {
  '→': '→ крок праворуч',
  '←': '← крок ліворуч',
  V: 'V поставити мітку',
  X: 'X стерти мітку',
  '?': '? перевірити комірку',
  '!': '! зупинка',
};

export function PostTableEditor({ rows, onChange, errorLines, currentLine, readOnly }: Props) {
  const update = (index: number, changes: Partial<PostRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  };

  const addRow = () => {
    const numbers = rows.map((row) => Number(row.number)).filter(Number.isInteger);
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    onChange([...rows, { number: String(next), op: '!', target: '', comment: '' }]);
  };

  return (
    <div class="program-table">
      <div class="program-table__scroll">
        <table>
          <caption class="visually-hidden">Програма у вигляді таблиці</caption>
          <thead>
            <tr>
              <th scope="col">Номер</th>
              <th scope="col">Команда</th>
              <th scope="col">Перехід</th>
              <th scope="col">Коментар</th>
              <th scope="col">
                <span class="visually-hidden">Дії</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const line = index + 1;
              const classes = [
                errorLines.has(line) ? 'is-error' : '',
                currentLine === line ? 'is-current' : '',
              ].join(' ');
              const noTarget = row.op === '!' || row.op === '';
              return (
                <tr key={index} class={classes.trim() || undefined}>
                  <td>
                    <input
                      class="input input--number"
                      inputMode="numeric"
                      value={row.number}
                      readOnly={readOnly}
                      aria-label={`Рядок ${line}: номер команди`}
                      onInput={(event) => update(index, { number: event.currentTarget.value })}
                    />
                  </td>
                  <td>
                    <select
                      class="input"
                      value={row.op}
                      disabled={readOnly}
                      aria-label={`Рядок ${line}: команда`}
                      onChange={(event) => {
                        const op = event.currentTarget.value;
                        update(index, op === '!' || op === '' ? { op, target: '' } : { op });
                      }}
                    >
                      <option value="">— лише коментар</option>
                      {ROW_OPS.map((op) => (
                        <option key={op} value={op}>
                          {OP_LABELS[op]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      class="input input--target"
                      value={row.target}
                      readOnly={readOnly}
                      disabled={noTarget}
                      placeholder={row.op === '?' ? 'a, b' : noTarget ? '' : 'm'}
                      aria-label={`Рядок ${line}: перехід`}
                      onInput={(event) => update(index, { target: event.currentTarget.value })}
                    />
                  </td>
                  <td>
                    <input
                      class="input"
                      value={row.comment}
                      readOnly={readOnly}
                      aria-label={`Рядок ${line}: коментар`}
                      onInput={(event) => update(index, { comment: event.currentTarget.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="button button--ghost"
                      disabled={readOnly}
                      aria-label={`Видалити рядок ${line}`}
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" class="button button--secondary" onClick={addRow} disabled={readOnly}>
        Додати рядок
      </button>
    </div>
  );
}
