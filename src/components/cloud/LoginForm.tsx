/** Форма входу: логін студента (ki2406-07) або пошта викладача й пароль. */
import { useState } from 'preact/hooks';

interface Props {
  onSubmit: (login: string, password: string) => Promise<void>;
  error: string | null;
  hint?: string;
}

export default function LoginForm({ onSubmit, error, hint }: Props) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(login, password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="panel cloud-login" onSubmit={submit}>
      <h2 class="panel__title">Вхід</h2>
      {hint && <p class="panel__hint">{hint}</p>}
      <label class="field">
        <span class="field__label">Логін</span>
        <input
          class="input"
          name="username"
          autocomplete="username"
          placeholder="ki2406-07"
          required
          value={login}
          onInput={(e) => setLogin(e.currentTarget.value)}
        />
      </label>
      <label class="field">
        <span class="field__label">Пароль</span>
        <input
          class="input"
          type="password"
          name="password"
          autocomplete="current-password"
          required
          value={password}
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
      </label>
      {error && (
        <p class="message message--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" class="button button--primary" disabled={busy}>
        {busy ? 'Входимо…' : 'Увійти'}
      </button>
    </form>
  );
}
