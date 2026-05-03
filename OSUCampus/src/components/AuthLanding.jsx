import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { isOregonStateEmail } from '../lib/auth';
import { isSupabaseConfigured, signInWithGoogle } from '../lib/supabase';

export default function AuthLanding({ authError, onClearAuthError }) {
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  const domainOk = isOregonStateEmail(email);
  const showError = authError || localError;

  const handleGoogleClick = async () => {
    setLocalError('');
    onClearAuthError?.();
    if (!isSupabaseConfigured) {
      setLocalError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    if (!domainOk) {
      setLocalError('Invalid school email');
      return;
    }
    setOauthLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setLocalError(e.message || 'Sign-in failed');
      setOauthLoading(false);
    }
  };

  return (
    <div className="auth-landing">
      <div className="auth-card">
        <h1 className="auth-title">OSU Campus Study</h1>
        <p className="auth-subtitle">Sign in with your Oregon State email via Google.</p>

        {showError && <div className="auth-error">{authError || localError}</div>}

        {!isSupabaseConfigured && (
          <div className="auth-error">
            Missing Supabase environment variables. Copy .env.example to .env and add your project keys.
          </div>
        )}

        <label className="auth-label" htmlFor="school-email">
          School email
        </label>
        <input
          id="school-email"
          type="email"
          autoComplete="email"
          className="auth-input"
          placeholder="you@oregonstate.edu"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setLocalError('');
            onClearAuthError?.();
          }}
        />
        {!domainOk && email.trim().length > 0 && (
          <p className="auth-hint-invalid">Invalid school email</p>
        )}

        <button
          type="button"
          className="auth-google-btn"
          disabled={!domainOk || oauthLoading || !isSupabaseConfigured}
          onClick={handleGoogleClick}
        >
          {oauthLoading ? (
            <>
              <Loader2 size={18} className="spinning" />
              <span>Redirecting…</span>
            </>
          ) : (
            <>
              <svg className="auth-google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
