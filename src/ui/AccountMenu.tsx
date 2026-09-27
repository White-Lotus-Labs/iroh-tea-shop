'use client';
import { useState } from 'react';
import type { PublicUser } from '../auth/service';

export function AccountMenu({ user }: { user: PublicUser | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not log out. Please try again.');
      // Full navigation clears client station state and guest chrome reliably.
      window.location.assign('/');
    } catch {
      setError('Could not log out. Please try again.');
      setBusy(false);
    }
  };
  if (!user) {
    return (
      <a className="account-entry" data-testid="account-entry" href="/account">
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="5.5"
            r="3"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M2.5 13.2c0-2.9 2.5-4.6 5.5-4.6s5.5 1.7 5.5 4.6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span>Log in</span>
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
