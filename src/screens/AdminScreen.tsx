import { useEffect, useState } from 'react';
import { useUI } from '../lib/ui';
import { useAccount } from '../lib/account';
import { humanError } from '../lib/supabase';
import { adminCrews, adminDeleteCrew, adminDeleteUser, adminStats, adminUsers, type AdminCrew, type AdminStats, type AdminUser } from '../lib/admin';
import { Icon } from '../components/Icons';

const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');

export function AdminScreen() {
  const ui = useUI();
  const acc = useAccount();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [crews, setCrews] = useState<AdminCrew[]>([]);
  const [tab, setTab] = useState<'users' | 'crews'>('users');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, u, c] = await Promise.all([adminStats(), adminUsers(), adminCrews()]);
      setStats(s); setUsers(u); setCrews(c); setError('');
    } catch (e) {
      setError(humanError(e));
    }
  };
  useEffect(() => { load(); }, []);

  const delUser = async (u: AdminUser) => {
    if (!confirm(`Удалить аккаунт ${u.email}? Человек останется в старых встречах как гость. Отменить нельзя.`)) return;
    try { await adminDeleteUser(u.id); ui.toast('Аккаунт удалён'); load(); } catch (e) { ui.toast(humanError(e)); }
  };
  const delCrew = async (c: AdminCrew) => {
    if (!confirm(`Удалить компанию «${c.name}» со всеми встречами (${c.events})? Отменить нельзя.`)) return;
    try { await adminDeleteCrew(c.id); ui.toast('Компания удалена'); load(); if (c.id === acc.crew.id) acc.reload(); } catch (e) { ui.toast(humanError(e)); }
  };

  const ql = q.trim().toLowerCase();
  const fu = users.filter((u) => !ql || u.email.toLowerCase().includes(ql) || u.name.toLowerCase().includes(ql));
  const fc = crews.filter((c) => !ql || c.name.toLowerCase().includes(ql) || (c.owner_email ?? '').toLowerCase().includes(ql));

  return (
    <>
      <header className="top">
        <button className="icon-btn" aria-label="Назад" onClick={() => ui.back()}>{Icon.back}</button>
        <h1>Админка</h1>
        <button className="icon-btn" aria-label="Обновить" onClick={load}>↻</button>
      </header>

      {error && <div className="warn">{error}</div>}

      {stats && (
        <div className="admin-stats">
          <div><b className="num">{stats.users}</b><span>пользователей</span><i>+{stats.users_7d} за 7 дн · +{stats.users_30d} за 30</i></div>
          <div><b className="num">{stats.events}</b><span>встреч</span><i>+{stats.events_7d} за 7 дн · +{stats.events_30d} за 30</i></div>
          <div><b className="num">{stats.crews}</b><span>компаний</span></div>
          <div><b className="num">{stats.places}</b><span>мест</span></div>
          <div><b className="num">{stats.people}</b><span>людей в компаниях</span></div>
        </div>
      )}

      <div className="seg" style={{ marginTop: 16 }}>
        <button type="button" aria-pressed={tab === 'users'} onClick={() => setTab('users')}>Пользователи · {users.length}</button>
        <button type="button" aria-pressed={tab === 'crews'} onClick={() => setTab('crews')}>Компании · {crews.length}</button>
      </div>
      <label className="field"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'users' ? 'Поиск по почте или имени' : 'Поиск по названию или почте'} /></label>

      <div className="list">
        {tab === 'users' && fu.map((u) => (
          <div key={u.id} className="row admin-row">
            <div className="grow">
              <div className="t">{u.name || '—'}</div>
              <div className="s">{u.email}</div>
              <div className="s">рег. {d(u.created_at)} · вход {d(u.last_sign_in_at)} · компаний {u.crews} · встреч {u.events}</div>
            </div>
            {u.id !== acc.session.user.id && <button className="btn undo sm" onClick={() => delUser(u)}>Удалить</button>}
          </div>
        ))}
        {tab === 'crews' && fc.map((c) => (
          <div key={c.id} className="row admin-row">
            <div className="grow">
              <div className="t">{c.name}</div>
              <div className="s">{c.owner_email ?? 'создатель удалён'} · с {d(c.created_at)}</div>
              <div className="s">в приложении {c.members} · людей {c.people} · встреч {c.events} · последняя {d(c.last_event)}</div>
            </div>
            <button className="btn undo sm" onClick={() => delCrew(c)}>Удалить</button>
          </div>
        ))}
        {((tab === 'users' && !fu.length) || (tab === 'crews' && !fc.length)) && <div className="empty">Ничего не найдено</div>}
      </div>
    </>
  );
}
