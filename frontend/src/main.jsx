import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import Auth from './Auth';
import LockScreen from './components/LockScreen';
import { supabase } from './supabase';

function Root() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [locked, setLocked]   = useState(false);

  useEffect(() => {
    // Initial session check — lock if a pre-existing session is found
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) setLocked(true); // returning user → show lock screen
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setLocked(false);
      } else {
        // TOKEN_REFRESHED, USER_UPDATED, etc. — just keep session fresh
        setSession(s);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="app-init"><div className="spinner" /></div>;
  }

  if (!session) return <Auth />;

  if (locked) {
    return <LockScreen session={session} onUnlock={() => setLocked(false)} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
