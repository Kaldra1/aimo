import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber } from './support';

export interface LogColumn<E> {
  header: string;
  cell: (entry: E) => string | number;
  /** Моноширинний шрифт (стрічки, команди). */
  mono?: boolean;
}

interface Props<E> {
  entries: readonly E[];
  /** Скільки кроків виконано всього (журнал зберігає лише останні). */
  total: number;
  columns: readonly LogColumn<E>[];
  rowKey: (entry: E) => string | number;
  defaultOpen?: boolean;
}

/** Журнал виконання: таблиця кроків у згортальному блоці. Рядки малюються, лише коли він відкритий. */
export function ExecutionLog<E>({
  entries,
  total,
  columns,
  rowKey,
  defaultOpen = false,
}: Props<E>) {
  const [open, setOpen] = useState(defaultOpen);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Під час виконання тримаємо в полі зору останній крок.
  useEffect(() => {
    const box = scrollRef.current;
    if (open && box) box.scrollTop = box.scrollHeight;
  }, [open, entries]);

  const hidden = total - entries.length;

  return (
    <details class="log" open={defaultOpen} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary class="log__summary">
        Журнал виконання <span class="log__count">({formatNumber(total)})</span>
      </summary>
      {open &&
        (entries.length === 0 ? (
          <p class="log__empty">Кроків ще не було.</p>
        ) : (
          <>
            {hidden > 0 && (
              <p class="log__note">
                Показано останні {formatNumber(entries.length)} з {formatNumber(total)} кроків.
              </p>
            )}
            <div class="log__scroll" ref={scrollRef}>
              <table class="log__table">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column.header} scope="col">
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={rowKey(entry)}>
                      {columns.map((column) => (
                        <td key={column.header} class={column.mono ? 'mono' : undefined}>
                          {column.cell(entry)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
    </details>
  );
}
