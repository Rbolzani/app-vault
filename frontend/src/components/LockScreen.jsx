import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const CRED_KEY = 'docvault-bio';

// ── WebAuthn helpers ──────────────────────────────────────

async function isBioSupported() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

function b64ToArr(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

function arrToB64(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  bytes.forEach(b => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getCredId(userId) {
  try { return JSON.parse(localStorage.getItem(`${CRED_KEY}-${userId}`))?.id ?? null; }
  catch { return null; }
}

export async function registerBiometric(userId, email) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'DocVault', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7,   type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  });
  const id = arrToB64(cred.rawId);
  localStorage.setItem(`${CRED_KEY}-${userId}`, JSON.stringify({ id }));
  return id;
}

async function verifyBiometric(userId) {
  const credId = getCredId(userId);
  if (!credId) throw new Error('not_registered');
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      allowCredentials: [{ id: b64ToArr(credId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
}

// ── Component ─────────────────────────────────────────────

export default function LockScreen({ session, onUnlock }) {
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError]           = useState('');
  const [bioSupported, setBioSupported] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(false);
  const [offerBio, setOfferBio]     = useState(false);
  const [registeringBio, setRegisteringBio] = useState(false);

  const userId = session?.user?.id ?? '';
  const email  = session?.user?.email ?? '';

  useEffect(() => {
    let cancelled = false;
    isBioSupported().then(ok => {
      if (cancelled) return;
      setBioSupported(ok);
      if (ok && userId) {
        const hasCredential = !!getCredId(userId);
        setBioRegistered(hasCredential);
        if (hasCredential) triggerBio();
      }
    });
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line

  const triggerBio = async () => {
    setBioLoading(true);
    setError('');
    try {
      await verifyBiometric(userId);
      onUnlock();
    } catch (e) {
      if (e.message === 'not_registered') {
        setBioRegistered(false);
      } else if (e.name !== 'NotAllowedError') {
        setError('Biometria falhou. Use sua senha.');
      }
    } finally {
      setBioLoading(false);
    }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (bioSupported && !bioRegistered) {
        setOfferBio(true);
      } else {
        onUnlock();
      }
    } catch {
      setError('Senha incorreta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableBio = async () => {
    setRegisteringBio(true);
    setError('');
    try {
      await registerBiometric(userId, email);
      onUnlock();
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        onUnlock();
      } else {
        setError('Não foi possível ativar a biometria: ' + e.message);
        setRegisteringBio(false);
      }
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Sair da conta? Você precisará fazer login novamente.')) {
      await supabase.auth.signOut();
    }
  };

  // ── Offer biometric after first password unlock ──────────
  if (offerBio) {
    return (
      <div className="lock-page">
        <div className="lock-card">
          <div className="lock-logo">DV</div>
          <h2 className="lock-title">Ativar biometria?</h2>
          <p className="lock-bio-desc">
            Use sua digital para desbloquear o app rapidamente na próxima vez.
          </p>
          <button
            className="btn-primary lock-btn"
            onClick={handleEnableBio}
            disabled={registeringBio}
          >
            {registeringBio ? 'Aguarde...' : <><FingerprintIcon size={18} /> Ativar digital</>}
          </button>
          <button className="btn-secondary lock-btn" onClick={onUnlock}>
            Agora não
          </button>
          {error && <div className="error-banner lock-error">⚠️ {error}</div>}
        </div>
      </div>
    );
  }

  // ── Main lock screen ─────────────────────────────────────
  return (
    <div className="lock-page">
      <div className="lock-card">
        <div className="lock-logo">DV</div>
        <h2 className="lock-title">Bem-vindo de volta</h2>
        <p className="lock-email">{email}</p>

        {/* Bio button — shown when registered */}
        {bioSupported && bioRegistered && (
          <button
            className={`lock-bio-btn${bioLoading ? ' lock-bio-loading' : ''}`}
            onClick={triggerBio}
            disabled={bioLoading}
            title="Desbloquear com biometria"
          >
            <FingerprintIcon size={36} />
            <span>{bioLoading ? 'Verificando...' : 'Usar digital'}</span>
          </button>
        )}

        {/* Divider */}
        {bioSupported && bioRegistered && (
          <div className="lock-divider">
            <span>ou use sua senha</span>
          </div>
        )}

        {/* Password form */}
        <form onSubmit={handlePassword} className="lock-form">
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Senha"
            autoFocus={!bioRegistered}
            autoComplete="current-password"
            required
          />
          {error && <div className="error-banner lock-error">⚠️ {error}</div>}
          <button
            type="submit"
            className="btn-primary lock-btn"
            disabled={loading || !password}
          >
            {loading ? 'Verificando...' : 'Desbloquear'}
          </button>
        </form>

        <button className="lock-logout" onClick={handleLogout}>
          Sair da conta
        </button>
      </div>
    </div>
  );
}

function FingerprintIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M17.657 11c0 4.243-1.636 8.093-4.313 10.97M6.343 11a5.657 5.657 0 1111.314 0c0 1.56-.315 3.046-.882 4.394M9.172 11a2.829 2.829 0 015.656 0c0 2.356-.72 4.544-1.958 6.357" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M12 4a7 7 0 00-7 7c0 1.214.19 2.384.543 3.48" />
    </svg>
  );
}
