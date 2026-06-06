import { useState } from 'react';
import { supabase } from './supabase';

export default function Auth() {
  const [mode, setMode]       = useState('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Conta criada! Verifique seu e-mail para confirmar e depois faça login.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo-wrap">
          <div className="auth-logo">DV</div>
        </div>
        <h1 className="auth-title">DocVault</h1>
        <p className="auth-sub">
          {mode === 'login' ? 'Entre para acessar seus documentos' : 'Crie sua conta gratuita'}
        </p>

        <form className="auth-form" onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="error-banner" style={{ borderRadius: 8, marginTop: 2 }}>
              ⚠️ {error}
            </div>
          )}
          {info && (
            <div className="error-banner" style={{ borderRadius: 8, marginTop: 2, background: 'rgba(16,185,129,0.1)', borderColor: '#10b981', color: '#10b981' }}>
              ✓ {info}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: 8, padding: '12px 0', fontSize: 15 }}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>Ainda não tem conta?{' '}
              <button onClick={() => { setMode('signup'); setError(''); setInfo(''); }}>
                Criar conta
              </button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button onClick={() => { setMode('login'); setError(''); setInfo(''); }}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
