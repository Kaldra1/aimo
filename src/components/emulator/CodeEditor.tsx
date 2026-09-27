/**
 * Редактор програми: textarea з нумерацією рядків, підсвіткою рядків з помилками й поточної
 * команди. Підсвітка — шар позаду прозорої textarea, тож редагування лишається звичайним.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { ParseMessage } from '../../lib/machines/types';

interface Props {
  id: string;
  /** id заголовка, що підписує редактор. */
  labelledBy: string;
  value: string;
  onInput: (value: string) => void;
  errors: readonly ParseMessage[];
  warnings: readonly ParseMessage[];
  /** Рядок команди, що виконується (від 1). */
  currentLine: number | null;
  /** Прокручувати до поточного рядка (під час виконання). */
  follow: boolean;
  readOnly?: boolean;
}

const lineTop = (line: number) => ({
  top: `calc(var(--editor-pad) + ${line - 1} * var(--editor-line))`,
});

export function CodeEditor({
  id,
  labelledBy,
  value,
  onInput,
  errors,
  warnings,
  currentLine,
  follow,
  readOnly = false,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const lineCount = value.split('\n').length;
  const errorLines = new Set(errors.map((e) => e.line).filter((line) => line > 0));
  const warningLines = new Set(warnings.map((w) => w.line).filter((line) => line > 0));
  const messagesId = `${id}-messages`;
  const hasMessages = errors.length > 0 || warnings.length > 0;

  const syncScroll = () => {
    const input = inputRef.current;
    if (!input) return;
    const shift = `translateY(${-input.scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = shift;
    if (layerRef.current) layerRef.current.style.transform = shift;
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!follow || currentLine === null || !input) return;
    const style = getComputedStyle(input);
    const lineHeight = parseFloat(style.lineHeight) || 24;
    const top = (parseFloat(style.paddingTop) || 0) + (currentLine - 1) * lineHeight;
    if (top < input.scrollTop || top + lineHeight > input.scrollTop + input.clientHeight) {
      input.scrollTop = Math.max(0, top - input.clientHeight / 2);
      syncScroll();
    }
  }, [currentLine, follow]);

  /** Виділяє рядок із помилкою й переводить на нього фокус. */
  const goToLine = (line: number) => {
    const input = inputRef.current;
    if (!input) return;
    const lines = value.split('\n');
    const start = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0);
    input.focus();
    input.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
  };

  return (
    <div class="code-editor">
      <div class="code-editor__frame">
        <div class="code-editor__gutter" aria-hidden="true">
          <div ref={gutterRef}>
            {Array.from({ length: lineCount }, (_, index) => {
              const line = index + 1;
              const kind = errorLines.has(line)
                ? ' is-error'
                : warningLines.has(line)
                  ? ' is-warning'
                  : '';
              return (
                <div key={line} class={`code-editor__number${kind}`}>
                  {line}
                </div>
              );
            })}
          </div>
        </div>
        <div class="code-editor__body">
          <div class="code-editor__layer" aria-hidden="true" ref={layerRef}>
            {[...errorLines].map((line) => (
              <div key={`e${line}`} class="code-editor__mark is-error" style={lineTop(line)} />
            ))}
            {currentLine !== null && (
              <div class="code-editor__mark is-current" style={lineTop(currentLine)} />
            )}
          </div>
          <textarea
            id={id}
            ref={inputRef}
            class="code-editor__input"
            value={value}
            rows={Math.max(10, Math.min(lineCount + 1, 24))}
            wrap="off"
            spellcheck={false}
            autocapitalize="off"
            autocomplete="off"
            readOnly={readOnly}
            aria-labelledby={labelledBy}
            aria-invalid={errors.length > 0}
            aria-describedby={hasMessages ? messagesId : undefined}
            onInput={(event) => onInput(event.currentTarget.value)}
            onScroll={syncScroll}
          />
        </div>
      </div>

      {hasMessages && (
        <ul id={messagesId} class="code-editor__messages">
          {[
            ...errors.map((m) => ({ ...m, kind: 'error' as const })),
            ...warnings.map((m) => ({ ...m, kind: 'warning' as const })),
          ].map((message, index) => {
            const label = message.kind === 'error' ? 'Помилка' : 'Попередження';
            const text = `${message.line > 0 ? `Рядок ${message.line}: ` : ''}${message.message}`;
            return (
              <li key={index} class={`message message--${message.kind}`}>
                <span class="message__label">{label}.</span>{' '}
                {message.line > 0 ? (
                  <button
                    type="button"
                    class="message__link"
                    onClick={() => goToLine(message.line)}
                  >
                    {text}
                  </button>
                ) : (
                  text
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
