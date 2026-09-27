/** Коментар до програми: опис ідеї розв'язання. Зберігається разом із програмою. */

interface Props {
  id: string;
  value: string;
  onInput: (value: string) => void;
}

export function CommentPanel({ id, value, onInput }: Props) {
  return (
    <section class="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} class="panel__title">
        Коментар
      </h2>
      <textarea
        id={id}
        class="input comment-panel__input"
        value={value}
        rows={7}
        placeholder="Опишіть ідею розв’язання: що робить кожна частина програми."
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-help`}
        onInput={(event) => onInput(event.currentTarget.value)}
      />
      <p id={`${id}-help`} class="panel__hint">
        Коментар зберігається разом із програмою — у файлі, у посиланні «Поділитися» й у цьому
        браузері. У вбудованих прикладах тут пояснено логіку розв’язання.
      </p>
    </section>
  );
}
