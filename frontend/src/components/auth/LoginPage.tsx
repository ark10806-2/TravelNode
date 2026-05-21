import { FormEvent, useState } from 'react';
import { KeyRound, Loader2, LockKeyhole } from 'lucide-react';
import { AppIcon } from '@/components/common/AppIcon';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/constants/travel';

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <main className="app-background grid min-h-[100dvh] place-items-center overflow-hidden px-4 py-8">
      <section className="toss-card w-full max-w-[26rem] rounded-3xl p-5 backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <AppIcon className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight">Japan Trip Planner</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">여행 페이지에 로그인하세요.</p>
          </div>
        </div>

        <div className="toss-muted-texture mt-5 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
              <LockKeyhole className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-bold">로그인이 필요합니다.</div>
              <p className="mt-1 leading-5 text-muted-foreground">여행 정보를 안전하게 보관하고 있어요.</p>
            </div>
          </div>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={submit}>
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
