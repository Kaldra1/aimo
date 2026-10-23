/** Стан входу в островах кабінету й дашборду. */
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { loginToEmail } from '../../lib/cloud/accounts';
import {
  cloudEnabled,
  explain,
  getClient,
  loadProfile,
  type Profile,
} from '../../lib/cloud/client';

export type AuthState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session; profile: Profile };

export function useAuth() {
  const [state, setState] = useState<AuthState>(
    cloudEnabled ? { status: 'loading' } : { status: 'disabled' },
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloudEnabled) return undefined;
    let alive = true;
    let unsubscribe = () => {};
    const apply = async (session: Session | null) => {
      if (!session) {
        if (alive) setState({ status: 'signed-out' });
        return;
      }
      try {
        const profile = await loadProfile(session);
        if (alive) setState({ status: 'signed-in', session, profile });
      } catch (e) {
        if (alive) {
          setError(explain(e as Error));
          setState({ status: 'signed-out' });
        }
      }
    };
    getClient().then(
      async (client) => {
        const { data } = await client.auth.getSession();
        await apply(data.session);
        const sub = client.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void apply(session);
        });
        unsubscribe = () => sub.data.subscription.unsubscribe();
      },
      (e: Error) => {
        if (alive) {
          setError(e.message);
          setState({ status: 'signed-out' });
        }
      },
    );
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (login: string, password: string) => {
    setError(null);
    const email = loginToEmail(login);
    if (!email) {
      setError('Логін має вигляд ki2406-07: група й номер у журналі.');
      return;
    }
    const client = await getClient();
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) setError(explain(signInError));
  }, []);

  const signOut = useCallback(async () => {
    const client = await getClient();
    await client.auth.signOut();
  }, []);

  return { state, error, signIn, signOut };
}
