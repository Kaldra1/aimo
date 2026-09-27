/**
 * Стрічка емулятора. Каретка стоїть по центру вікна, стрічка плавно зсувається під нею.
 * Редагування (до запуску): клік по комірці, перетягування каретки. З клавіатури фокус стає
 * на каретку: стрілки рухають її, інші клавіші машина обробляє сама (onCaretKey).
 */
import { useEffect, useRef, useState } from 'preact/hooks';

export interface TapeCell {
  /** Що показати в комірці. */
  text: string;
  /** Непорожня комірка (виділяється кольором). */
  filled: boolean;
  /** Опис комірки для екранних зчитувачів. */
  label: string;
  /** Стан перемикача (мітка в машині Поста). */
  pressed?: boolean;
}

interface Props {
  head: number;
  cellAt: (index: number) => TapeCell;
  editable: boolean;
  /** Тривалість анімації зсуву, мс; 0 — без анімації. */
  transitionMs: number;
  onCellClick: (index: number) => void;
  onHeadChange: (index: number) => void;
  /** Додаткові клавіші на каретці; true — клавішу оброблено. */
  onCaretKey?: (key: string) => boolean;
  /** Підпис над кареткою (стан машини Тюрінга). */
  caretBadge?: string;
  describedBy?: string;
}

const DEFAULT_WIDTH = 720;
const DEFAULT_CELL = 52;
/** Запас комірок за межами вікна, щоб під час зсуву не було порожнечі. */
const BUFFER = 3;

interface Drag {
  pointerId: number;
  /** Каретка на початку перетягування: вікно не зсувається, поки тягнемо. */
  origin: number;
  index: number;
}

export function Tape({
  head,
  cellAt,
  editable,
  transitionMs,
  onCellClick,
  onHeadChange,
  onCaretKey,
  caretBadge,
  describedBy,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, cell: DEFAULT_CELL });
  // Анімацію вмикаємо після першого вимірювання, інакше стрічка «доїжджає» після завантаження.
  const [settled, setSettled] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const cell = parseFloat(getComputedStyle(viewport).getPropertyValue('--tape-cell'));
      setSize({ width: viewport.clientWidth, cell: cell > 0 ? cell : DEFAULT_CELL });
    };
    measure();
    const frame = requestAnimationFrame(() => setSettled(true));
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const { width, cell } = size;
  const visible = Math.max(5, Math.floor(width / cell) | 1);
  const half = Math.floor(visible / 2);
  const center = drag ? drag.origin : head;
  const viewStart = center - half;
  const offset = (width - visible * cell) / 2;
  const caret = drag ? drag.index : head;

  const indices: number[] = [];
  for (let i = viewStart - BUFFER; i < viewStart + visible + BUFFER; i++) indices.push(i);

  const indexAt = (clientX: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return head;
    return viewStart + Math.floor((clientX - rect.left - offset) / cell);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!editable) return;
    if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      onHeadChange(head + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1));
    } else if (onCaretKey?.(event.key)) {
      event.preventDefault();
    }
  };

  return (
    <div
      class={`tape${editable ? ' is-editable' : ''}`}
      ref={viewportRef}
      role="group"
      aria-label="Стрічка"
    >
      <div
        class="tape__track"
        style={{
          transform: `translateX(${offset - viewStart * cell}px)`,
          transitionDuration: drag || !settled ? '0ms' : `${transitionMs}ms`,
        }}
      >
        {indices.map((index) => {
          const content = cellAt(index);
          const className = `tape__cell${content.filled ? ' is-filled' : ''}`;
          const style = { left: `${index * cell}px` };
          const inner = (
            <>
              <span class="tape__index" aria-hidden="true">
                {index}
              </span>
              {content.text}
            </>
          );
          return editable ? (
            <button
              key={index}
              type="button"
              class={className}
              style={style}
              tabIndex={-1}
              aria-pressed={content.pressed}
              aria-label={content.label}
              onClick={() => onCellClick(index)}
            >
              {inner}
            </button>
          ) : (
            <div key={index} class={className} style={style}>
              {inner}
            </div>
          );
        })}
      </div>

      <div
        class={`tape__caret${drag ? ' is-dragging' : ''}`}
        style={{ left: `${offset + (caret - viewStart) * cell}px` }}
        role="spinbutton"
        tabIndex={editable ? 0 : -1}
        aria-label="Каретка"
        aria-valuenow={head}
        aria-valuetext={cellAt(head).label}
        aria-readonly={!editable}
        aria-describedby={describedBy}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (!editable) return;
          event.preventDefault();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Без захоплення вказівника перетягування все одно працює в межах стрічки.
          }
          setDrag({ pointerId: event.pointerId, origin: head, index: head });
        }}
        onPointerMove={(event) => {
          if (drag && event.pointerId === drag.pointerId) {
            setDrag({ ...drag, index: indexAt(event.clientX) });
          }
        }}
        onPointerUp={(event) => {
          if (drag && event.pointerId === drag.pointerId) {
            setDrag(null);
            if (drag.index !== head) onHeadChange(drag.index);
          }
        }}
        onPointerCancel={() => setDrag(null)}
      >
        {caretBadge && <span class="tape__badge">{caretBadge}</span>}
        <span class="tape__frame" />
        <svg class="tape__pointer" viewBox="0 0 24 16" width="24" height="16" aria-hidden="true">
          <path d="M12 1L23 15H1z" />
        </svg>
      </div>
    </div>
  );
}
