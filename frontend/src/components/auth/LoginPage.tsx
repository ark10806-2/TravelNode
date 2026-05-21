import { FormEvent, useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Loader2 } from 'lucide-react';
import { canUsePlatformPasskey } from '@/api/auth';
import { AppIcon } from '@/components/common/AppIcon';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/constants/travel';

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  onPasskeyLogin: () => Promise<void>;
};

export function LoginPage({ onLogin, onPasskeyLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasskeyAvailable, setIsPasskeyAvailable] = useState(false);

  useEffect(() => {
    void canUsePlatformPasskey().then(setIsPasskeyAvailable);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '로그인하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitPasskey() {
    setError('');
    setIsSubmitting(true);

    try {
      await onPasskeyLogin();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Face ID로 로그인하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-background grid min-h-[100dvh] place-items-center overflow-hidden px-4 py-8">
      <section className="toss-card w-[calc(100vw-2rem)] max-w-[26rem] rounded-3xl p-5 backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <AppIcon className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight">Japan Trip Planner</h1>
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={submit}>
          {isPasskeyAvailable ? (
            <Button className="h-11 rounded-full" type="button" disabled={isSubmitting} onClick={() => void submitPasskey()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              Face ID로 로그인
            </Button>
          ) : null}

          <label className="grid gap-2 text-sm font-semibold">
            ID
            <input
              className={inputClass}
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            비밀번호
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Button className="h-11 rounded-full" type="submit" disabled={isSubmitting || !username.trim() || !password}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            로그인
          </Button>
        </form>
      </section>
    </main>
  );
}
