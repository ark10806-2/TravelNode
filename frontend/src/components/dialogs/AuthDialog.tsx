import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/constants/travel';
import { ModalFrame } from './ModalFrame';

type AuthDialogProps = {
  mode: 'login' | 'change';
  onClose: () => void;
  onLogin: (password: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export function AuthDialog({ mode, onClose, onLogin, onChangePassword }: AuthDialogProps) {
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isLogin = mode === 'login';

  async function submit() {
    setFormError('');
    setIsSaving(true);

    try {
      if (isLogin) {
        await onLogin(password);
      } else {
        if (newPassword !== confirmPassword) throw new Error('새 비밀번호가 서로 다릅니다.');
        await onChangePassword(currentPassword, newPassword);
      }
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '인증에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalFrame title={isLogin ? '편집 잠금 해제' : '비밀번호 변경'} maxWidth="max-w-md" onClose={onClose}>
      <div className="grid gap-4 p-5">
        {isLogin ? (
          <label className="grid gap-2 text-sm font-semibold">
            비밀번호
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>
        ) : (
          <>
            <label className="grid gap-2 text-sm font-semibold">
              현재 비밀번호
              <input
                className={inputClass}
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoFocus
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              새 비밀번호
              <input
                className={inputClass}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              새 비밀번호 확인
              <input
                className={inputClass}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </>
        )}

        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={submit}
            disabled={
              isSaving ||
              (isLogin ? !password : !currentPassword || !newPassword || !confirmPassword || newPassword.length < 4)
            }
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {isLogin ? '해제' : '변경'}
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
