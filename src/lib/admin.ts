import { supabase } from './supabase';

// Админка: все данные отдаёт база, и только администратору (проверка внутри функций)

export type AdminStats = {
  users: number; users_7d: number; users_30d: number;
  crews: number; events: number; events_7d: number; events_30d: number;
  places: number; people: number;
};
export type AdminUser = { id: string; email: string; name: string; created_at: string; last_sign_in_at: string | null; crews: number; events: number };
export type AdminCrew = { id: string; name: string; created_at: string; owner_email: string | null; members: number; people: number; events: number; last_event: string | null };

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const isAdmin = () => rpc<boolean>('is_admin').catch(() => false);
export const adminStats = () => rpc<AdminStats>('admin_stats');
export const adminUsers = () => rpc<AdminUser[]>('admin_users');
export const adminCrews = () => rpc<AdminCrew[]>('admin_crews');
export const adminDeleteUser = (u: string) => rpc<void>('admin_delete_user', { u });
export const adminDeleteCrew = (c: string) => rpc<void>('admin_delete_crew', { c });
