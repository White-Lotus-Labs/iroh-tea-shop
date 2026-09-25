'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PublicUser } from '../auth/service';

export function AccountMenu({ user }: { user: PublicUser | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not log out. Please try again.');
      router.refresh();
    } catch {
      setError('Could not log out. Please try again.');
      setBusy(false);
    }
  };
  if (!user) {
    return (
      <a className="account-entry" data-testid="account-entry" href="/account">
        Log in / Create account
      </a>
    );
  }
  return (
    <details className="account-menu">
      <summary
        data-testid="account-control"
        aria-label={`Account: ${user.nickname}`}
      >
        <span className="account-avatar" aria-hidden="true">
          ◒
        </span>
        <span>{user.nickname}</span>
        <span className="account-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="account-popover">
        <div className="account-popover-name">{user.nickname}</div>
        <button type="button" onClick={logout} disabled={busy}>
          {busy ? 'Logging out…' : 'Log out'}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
