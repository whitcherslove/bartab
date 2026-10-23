import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configError, humanError, supabase } from './supabase';
import { clearCache, readCache, writeCache } from './cache';
import { setCurrency } from './format';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ProfileStep } from '../screens/auth/ProfileStep';
import { CrewSetup } from '../screens/auth/CrewSetup';
import { Splash } from '../screens/auth/Splash';
import { forgetView, startOn } from './ui';

export type Profile = { id: string; name: string; tg: string; avatar_url: string; currency: string };
export type Invite = { id: string; crew_id: string; crew_name: string; crew_avatar: string; inviter_name: string };
export type Crew = { id: string; name: string; invite_code: string; tg_chat_id: string | null; tg_chat_name: string; tg_chat_by: string; avatar_url: string };

type Account = {
  session: Session;
  profile: Profile;
  crews: Crew[];
  crew: Crew;
  setCrewId: (id: string) => void;
  reload: () => Promise<void>;
  saveProfile: (p: { name: string; tg: string; avatar_url?: string }) => Promise<void>;
  leaveCrew: (id: string) => Promise<void>;
  saveCurrency: (code: string) => Promise<void>;
  invites: Invite[];
  respondInvite: (id: string, accept: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  inviteLink: string;
};

const Ctx = createContext<Account | null>(null);

const CREW_KEY = 'bartab-crew';
const JOIN_KEY = 'bartab-join';

/** Код из ссылки-приглашения ?join=... запоминаем до входа и убираем из адреса */
function takeJoinCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  // ссылка «Позвать в BarTab»: сначала предложим установить приложение
  if (params.has('install')) {
    try { localStorage.setItem('bartab-install-intro', '1'); } catch { /* ignore */ }
    params.delete('install');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
  }
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
  const [invites, setInvites] = useState<Invite[]>([]);

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
        else if (joined) {
          startOn({ screen: 'crew' }); // вступил по ссылке или QR — сразу на экран компании
          setCrewId(joined as string);
          try { localStorage.setItem('bartab-welcome', '1'); } catch { /* ignore */ }
        }
      }
      const [{ data: p, error: pErr }, { data: c, error: cErr }] = await Promise.all([
        supabase.from('profiles').select('id, name, tg, avatar_url, currency').eq('id', user.id).maybeSingle(),
        supabase.from('crews').select('id, name, invite_code, tg_chat_id, tg_chat_name, tg_chat_by, avatar_url').order('created_at'),
      ]);
      if (pErr) throw pErr;
      if (cErr) throw cErr;
      supabase.rpc('my_invites').then(({ data }) => setInvites((data ?? []) as Invite[]));
      const prof = p ?? { id: user.id, name: '', tg: '', avatar_url: '', currency: 'RUB' };
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

  useEffect(() => {
    if (!userId) return;
    const onVis = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [userId, reload]);

  const saveProfile = useCallback(async ({ name, tg, avatar_url }: { name: string; tg: string; avatar_url?: string }) => {
    if (!userId) return;
    const avatar = avatar_url ?? profile?.avatar_url ?? '';
    const { error: e } = await supabase.rpc('update_my_profile', { p_name: name, p_tg: tg, p_avatar: avatar });
    if (e) throw e;
    setProfile((pr) => ({ id: userId, name, tg, avatar_url: avatar, currency: pr?.currency ?? 'RUB' }));
  }, [userId, profile?.avatar_url]);

  const saveCurrency = useCallback(async (currency: string) => {
    if (!userId) return;
    const { error: e } = await supabase.from('profiles').update({ currency }).eq('id', userId);
    if (e) throw e;
    setProfile((pr) => (pr ? { ...pr, currency } : pr));
  }, [userId]);

  const respondInvite = useCallback(async (id: string, accept: boolean) => {
    const { data, error: e } = await supabase.rpc('respond_invite', { invite: id, accept });
    if (e) throw e;
    setInvites((list) => list.filter((x) => x.id !== id));
    if (accept && data) {
      startOn({ screen: 'crew' }); // принял приглашение — тоже на экран компании
      setCrewId(data as string);
    }
    await reload();
  }, [reload, setCrewId]);

  const leaveCrew = useCallback(async (id: string) => {
    const { error: e } = await supabase.rpc('leave_crew', { c: id });
    if (e) throw e;
    try { localStorage.removeItem(CREW_KEY); } catch { /* ignore */ }
    setCrewIdState('');
    await reload();
  }, [reload]);

  // вышли из аккаунта — после входа начинаем с главного экрана
  useEffect(() => { if (session === null) forgetView(); }, [session]);

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

  setCurrency(profile.currency || 'RUB');
  const crew = crews.find((c) => c.id === crewId) ?? crews[0];
  const inviteLink = `${window.location.origin}/?join=${crew.invite_code}`;

  return (
    <Ctx.Provider value={{ session, profile, crews, crew, setCrewId, reload, saveProfile, leaveCrew, saveCurrency, invites, respondInvite, signOut, inviteLink }}>
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
