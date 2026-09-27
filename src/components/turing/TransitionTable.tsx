/** Таблиця переходів машини Тюрінга: рядки — символи алфавіту й λ, стовпці — стани. */
import {
  cellKey,
  MAX_STATES,
  type TableMessage,
  type TuringPosition,
} from '../../lib/machines/turing';

interface Props {
  symbols: readonly string[];
  states: number;
  cells: Readonly<Record<string, string>>;
  onCell: (key: string, text: string) => void;
  onAddState: () => void;
  onRemoveState: () => void;
  errors: readonly TableMessage[];
  /** Клітинка, що виконується (або на якій сталася аварія). */
  active: TuringPosition | null;
  activeKind: 'current' | 'error';
  readOnly: boolean;
}

export function TransitionTable({
  symbols,
  states,
  cells,
  onCell,
  onAddState,
  onRemoveState,
  errors,
  active,
  activeKind,
  readOnly,
}: Props) {
  const errorCells = new Map(
    errors
      .filter((e) => e.state !== null && e.symbol !== null)
      .map((e) => [cellKey(e.state!, e.symbol!), e.message]),
  );
  const stateList = Array.from({ length: states }, (_, state) => state);

  return (
    <div class="turing-table">
      <div class="turing-table__toolbar">
        <button
          type="button"
          class="button button--secondary"
          onClick={onAddState}
          disabled={readOnly || states >= MAX_STATES}
        >
          + стан
        </button>
        <button
          type="button"
          class="button button--secondary"
          onClick={onRemoveState}
          disabled={readOnly || states <= 1}
        >
          − стан
        </button>
      </div>
      <div class="turing-table__scroll">
        <table>
          <caption class="visually-hidden">
            Таблиця переходів: рядки — символи, стовпці — стани
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span class="visually-hidden">Символ</span>
              </th>
              {stateList.map((state) => (
                <th key={state} scope="col">
                  q{state}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((symbol) => (
              <tr key={symbol}>
                <th scope="row" class="mono">
                  {symbol}
                </th>
                {stateList.map((state) => {
                  const key = cellKey(state, symbol);
                  const error = errorCells.get(key);
                  const isActive = active?.state === state && active.symbol === symbol;
                  const classes = [
                    error ? 'is-error' : '',
                    isActive ? (activeKind === 'error' ? 'is-crash' : 'is-current') : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <td key={state} class={classes || undefined}>
                      <input
                        class="turing-table__cell"
                        value={cells[key] ?? ''}
                        readOnly={readOnly}
                        spellcheck={false}
                        autocomplete="off"
                        aria-label={`Стан q${state}, символ ${symbol}`}
                        aria-invalid={error ? true : undefined}
                        title={error}
                        onInput={(event) => onCell(key, event.currentTarget.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
