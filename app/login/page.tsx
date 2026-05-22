'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

function getUserFriendlyError(error: unknown): string {
  const errorMessage = (error as Error)?.message || String(error) || '';

  if (errorMessage.includes('abort') || errorMessage.includes('cancel')) {
    return 'Passkey authentication was cancelled. Please try again.';
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'The passkey request timed out. Please try again.';
  }
  if (errorMessage.includes('not allowed') || errorMessage.includes('NotAllowedError')) {
    return 'Passkey authentication was not allowed. Please make sure you have a passkey set up for this device.';
  }
  if (errorMessage.includes('InvalidStateError')) {
    return 'A passkey is already registered for this account on this device. Try logging in instead.';
  }
  if (errorMessage.includes('NotFoundError') || errorMessage.includes('not found')) {
    return 'No passkey found for this account on this device. Please register first.';
  }
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (errorMessage.includes('session expired') || errorMessage.includes('Authentication session expired')) {
    return 'Your session expired. Please try again.';
  }
  if (errorMessage.includes('User not found')) {
    return 'No account found with this username. Please register first.';
  }
  if (errorMessage.includes('Verification failed')) {
    return 'Authentication failed. Please try again or re-register your passkey.';
  }
  return errorMessage || 'An error occurred. Please try again.';
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(true);
  const [devLoading, setDevLoading] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';
  const router = useRouter();

  useEffect(() => {
    const checkWebAuthn = async () => {
      if (!browserSupportsWebAuthn()) {
        setWebAuthnSupported(false);
        return;
      }
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setPlatformAuthAvailable(available);
      } catch {
        setPlatformAuthAvailable(false);
      }
    };
    checkWebAuthn();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || 'Failed to get registration options');
      }
      const options = await optionsRes.json();
      const registrationResponse = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationResponse),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || 'Registration failed');
      }
      router.push('/');
    } catch (err) {
      setError(getUserFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      const optionsRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || 'Failed to get authentication options');
      }
      const options = await optionsRes.json();
      const authResponse = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResponse),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || 'Authentication failed');
      }
      router.push('/');
    } catch (err) {
      setError(getUserFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Todo App</h1>
        <p className="text-gray-600 mb-6 text-center">Sign in with your passkey</p>

        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
              autoComplete="username webauthn"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors mb-3"
          >
            {loading ? 'Processing...' : isRegistering ? 'Register with Passkey' : 'Sign in with Passkey'}
          </button>

          <button
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            disabled={loading}
            className="w-full px-4 py-2 text-blue-600 hover:underline disabled:opacity-50"
          >
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </form>

        {!webAuthnSupported && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              <strong>Browser not supported.</strong> Please use Chrome, Edge, Firefox, or Safari.
            </p>
          </div>
        )}

        {webAuthnSupported && !platformAuthAvailable && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">
              <strong>Setup required.</strong> Enable Windows Hello or Touch ID on your device.
            </p>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Passkeys</strong> use your device's biometrics or PIN for secure, passwordless authentication.
          </p>
        </div>

        {isDev && (
          <div className="mt-6 pt-6 border-t border-dashed border-gray-300">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-3">
              🛠 Dev Mode
            </p>
            <button
              onClick={async () => {
                setDevLoading(true);
                try {
                  const res = await fetch('/api/auth/dev-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'dev' }),
                  });
                  if (!res.ok) throw new Error('Dev login failed');
                  router.push('/');
                } catch {
                  setError('Dev login failed');
                } finally {
                  setDevLoading(false);
                }
              }}
              disabled={devLoading}
              className="w-full px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {devLoading ? 'Logging in...' : '⚡ Quick Dev Login'}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Logs in as "dev" user. Not available in production.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
