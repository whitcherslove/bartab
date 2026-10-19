import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configError, humanError, supabase } from './supabase';
import { clearCache, readCache, writeCache } from './cache';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ProfileStep } from '../screens/auth/ProfileStep';
import { CrewSetup } from '../screens/auth/CrewSetup';
import { Splash } from '../screens/auth/Splash';

export type Profile = { id: string; name: string; tg: string };
export type Crew = { id: string; name: string; invite_code: string };

type Account = {
  session: Session;
  profile: Profile;
  crews: Crew[];
  crew: Crew;
  setCrewId: (id: string) => void;
  reload: () => Promise<void>;
  saveProfile: (p: { name: string; tg: string }) => Promise<void>;
  signOut: () => Promise<void>;
  inviteLink: string;
};

const Ctx = createContext<Account | null>(null);

const CREW_KEY = 'bartab-crew';
const JOIN_KEY = 'bartab-join';

/** Код из ссылки-приглашения ?join=... запоминаем до входа и убираем из адреса */
function takeJoinCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('join');
  if (code) {
    try { localStorage.setItem(JOIN_KEY, code.trim().toLowerCase()); } catch { /* ignore */ }
    params.delete('join');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
  }
}
takeJoinCodeFromUrl();

// eslint-disable-next-line react-refresh/only-export-components
export function pendingJoinCode(): string {
  try { return localStorage.getItem(JOIN_KEY) || ''; } catch { return ''; }
}
function clearJoinCode() {
  try { localStorage.removeItem(JOIN_KEY); } catch { /* ignore */ }
}

export function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [crews, setCrews] = useState<Crew[] | null>(null);
  const [crewId, setCrewIdState] = useState<string>(() => {
    try { return localStorage.getItem(CREW_KEY) || ''; } catch { return ''; }
  });
  const [error, setError] = useState('');

  // Сессия: восстанавливаем при запуске и следим за входом/выходом
  useEffect(() => {
    if (configError) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const setCrewId = useCallback((id: string) => {
    setCrewIdState(id);
    try { localStorage.setItem(CREW_KEY, id); } catch { /* ignore */ }
  }, []);

  const reload = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;
    setError('');
    try {
      // Вступление по приглашению, если пришли по ссылке
      const code = pendingJoinCode();
      if (code) {
        const { data: joined, error: joinErr } = await supabase.rpc('join_crew', { code });
        clearJoinCode();
        if (joinErr) setError(humanError(joinErr));
        else if (joined) setCrewId(joined as string);
      }
      const [{ data: p, error: pErr }, { data: c, error: cErr }] = await Promise.all([
        supabase.from('profiles').select('id, name, tg').eq('id', user.id).maybeSingle(),
        supabase.from('crews').select('id, name, invite_code').order('created_at'),
      ]);
      if (pErr) throw pErr;
      if (cErr) throw cErr;
      const prof = p ?? { id: user.id, name: '', tg: '' };
      setProfile(prof);
      setCrews(c ?? []);
      writeCache('account:' + user.id, { profile: prof, crews: c ?? [] });
    } catch (e) {
      // нет связи — открываем с последними сохранёнными данными
      const cached = readCache<{ profile: Profile; crews: Crew[] }>('account:' + user.id);
      if (cached) {
        setProfile(cached.profile);
        setCrews(cached.crews);
      } else {
        setError(humanError(e));
      }
    }
  }, [setCrewId]);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setCrews(null);
      return;
    }
    reload();
  }, [userId, reload]);

  const saveProfile = useCallback(async ({ name, tg }: { name: string; tg: string }) => {
    if (!userId) return;
    const { error: e } = await supabase.from('profiles').update({ name, tg }).eq('id', userId);
    if (e) throw e;
    setProfile({ id: userId, name, tg });
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearCache();
    try { localStorage.removeItem(CREW_KEY); } catch { /* ignore */ }
  }, []);

  // ----- Что показать -----
  if (configError) return <Splash message={configError} />;
  if (session === undefined) return <Splash />;
  if (!session) return <LoginScreen />;
  if (!profile || !crews) return <Splash message={error} onRetry={error ? reload : undefined} />;
  if (!profile.name) return <ProfileStep profile={profile} email={session.user.email ?? ''} onSave={saveProfile} />;
  if (crews.length === 0) return <CrewSetup myName={profile.name} error={error} onDone={async (id) => { setCrewId(id); await reload(); }} onSignOut={signOut} />;

  const crew = crews.find((c) => c.id === crewId) ?? crews[0];
  const inviteLink = `${window.location.origin}/?join=${crew.invite_code}`;

  return (
    <Ctx.Provider value={{ session, profile, crews, crew, setCrewId, reload, saveProfile, signOut, inviteLink }}>
      {children}
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccount() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAccount вне AccountGate');
  return c;
}
