import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, KeyRound, Loader2, Plus, RefreshCw, Search, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { api, AdminMember } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const field =
  'w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/40';

export const MembersManagement: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { language } = useLanguage();
  const th = language === 'th';
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'vip' | 'suspended'>('all');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', displayName: '', password: '', plan: 'free' as 'free' | 'vip' });
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await api.listMembers());
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e: any) {
      window.alert(e?.message || 'Error');
    }
  };

  const stats = useMemo(() => {
    const week = Date.now() - 7 * 86400_000;
    return {
      total: members.length,
      vip: members.filter((m) => m.plan === 'vip').length,
      suspended: members.filter((m) => m.status === 'suspended').length,
      fresh: members.filter((m) => new Date(m.createdAt).getTime() > week).length,
    };
  }, [members]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...members]
      .filter((m) => (filter === 'vip' ? m.plan === 'vip' : filter === 'suspended' ? m.status === 'suspended' : true))
      .filter((m) => !q || m.email.includes(q) || m.displayName.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [members, query, filter]);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(th ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.createMember(form);
      setForm({ email: '', displayName: '', password: '', plan: 'free' });
      setCreating(false);
      await load();
    } catch (err: any) {
      setFormError(err?.message || 'Error');
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-[#1A1A1A] rounded-xl p-8 text-center text-sm text-gray-400 border border-white/5">
        {th ? 'การจัดการสมาชิกทำได้เฉพาะผู้ดูแลระบบสูงสุด' : 'Member management is for administrators only.'}
      </div>
    );
  }

  const Stat = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
    <div className="bg-[#1A1A1A] rounded-xl p-4 border border-white/5">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className={`text-2xl font-black mt-1 ${tone || 'text-white'}`}>{value.toLocaleString()}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={th ? 'สมาชิกทั้งหมด' : 'Total members'} value={stats.total} />
        <Stat label={th ? 'สมัครใหม่ 7 วัน' : 'New (7 days)'} value={stats.fresh} tone="text-emerald-400" />
        <Stat label="VIP" value={stats.vip} tone="text-yellow-400" />
        <Stat label={th ? 'ถูกระงับ' : 'Suspended'} value={stats.suspended} tone="text-red-400" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${field} pl-8`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={th ? 'ค้นหาอีเมลหรือชื่อ...' : 'Search email or name...'}
          />
        </div>
        {(['all', 'vip', 'suspended'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${filter === f ? 'bg-[#E50914] text-white' : 'bg-[#1A1A1A] text-gray-300 hover:text-white'}`}
          >
            {f === 'all' ? (th ? 'ทั้งหมด' : 'All') : f === 'vip' ? 'VIP' : th ? 'ถูกระงับ' : 'Suspended'}
          </button>
        ))}
        <button onClick={() => void load()} className="p-2 rounded-lg bg-[#1A1A1A] text-gray-300 hover:text-white cursor-pointer" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setCreating(!creating)}
          className="px-3.5 py-2 rounded-lg bg-[#28A745] hover:bg-[#28A745]/90 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          {creating ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {th ? 'เพิ่มสมาชิก' : 'Add member'}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="bg-[#1A1A1A] rounded-xl p-4 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <input className={field} placeholder={th ? 'อีเมล' : 'Email'} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={field} placeholder={th ? 'ชื่อที่แสดง' : 'Display name'} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          <input className={field} type="password" autoComplete="new-password" placeholder={th ? 'รหัสผ่าน (อย่างน้อย 8 ตัว)' : 'Password (min 8)'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className={field} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as 'free' | 'vip' })}>
            <option value="free">{th ? 'สมาชิกทั่วไป' : 'Free'}</option>
            <option value="vip">VIP</option>
          </select>
          {formError && <p className="sm:col-span-2 text-red-300">{formError}</p>}
          <button className="sm:col-span-2 py-2 rounded-lg bg-[#28A745] text-white font-semibold cursor-pointer">{th ? 'สร้างสมาชิก' : 'Create member'}</button>
        </form>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="space-y-2">
        {loading && members.length === 0 && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
        {!loading && shown.length === 0 && (
          <div className="bg-[#1A1A1A] rounded-xl p-8 text-center text-sm text-gray-500 border border-white/5">
            {members.length === 0
              ? th ? 'ยังไม่มีสมาชิก เมื่อมีคนสมัครที่หน้าเว็บ จะแสดงที่นี่ทันที' : 'No members yet. Sign-ups from the website appear here.'
              : th ? 'ไม่พบสมาชิกที่ตรงเงื่อนไข' : 'No members match.'}
          </div>
        )}
        {shown.map((m) => (
          <div key={m.id} className={`bg-[#1A1A1A] rounded-xl p-3.5 border border-white/5 flex flex-col md:flex-row md:items-center gap-3 ${m.status === 'suspended' ? 'opacity-70' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-black text-white flex-shrink-0">
              {m.displayName.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-white truncate">{m.displayName}</span>
                {m.plan === 'vip' && (
                  <span className="bg-yellow-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Crown className="w-3 h-3" />VIP
                    {m.vipUntil && (
                      <span className="font-semibold">
                        {' '}{th ? 'ถึง' : 'to'} {new Date(m.vipUntil).toLocaleDateString(th ? 'th-TH' : 'en-US', { dateStyle: 'medium' })}
                      </span>
                    )}
                  </span>
                )}
                {m.status === 'suspended' && (
                  <span className="bg-red-500/20 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full">{th ? 'ถูกระงับ' : 'Suspended'}</span>
                )}
              </div>
              <div className="text-gray-400 truncate">{m.email}</div>
              <div className="text-gray-500 mt-0.5">
                {th ? 'สมัคร' : 'Joined'} {fmt(m.createdAt)} · {th ? 'เข้าล่าสุด' : 'Last seen'} {fmt(m.lastLoginAt)} · {th ? 'รายการโปรด' : 'My List'} {m.myListCount}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => run(() => api.updateMember(m.id, { plan: m.plan === 'vip' ? 'free' : 'vip' }))}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1 ${m.plan === 'vip' ? 'bg-yellow-400/20 text-yellow-300' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
              >
                <Crown className="w-3.5 h-3.5" />
                {m.plan === 'vip' ? (th ? 'ยกเลิก VIP' : 'Remove VIP') : th ? 'ตั้งเป็น VIP' : 'Make VIP'}
              </button>
              <button
                onClick={() => run(() => api.updateMember(m.id, { status: m.status === 'active' ? 'suspended' : 'active' }))}
                className="p-2 rounded-lg text-gray-300 hover:bg-white/10 cursor-pointer"
                title={m.status === 'active' ? (th ? 'ระงับบัญชี' : 'Suspend') : th ? 'เปิดใช้งานอีกครั้ง' : 'Re-activate'}
              >
                {m.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-emerald-400" />}
              </button>
              <button
                onClick={() => {
                  const pw = window.prompt(th ? `ตั้งรหัสผ่านใหม่ให้ ${m.email} (อย่างน้อย 8 ตัว)` : `New password for ${m.email} (min 8)`);
                  if (pw) void run(() => api.updateMember(m.id, { password: pw }));
                }}
                className="p-2 rounded-lg text-gray-300 hover:bg-white/10 cursor-pointer"
                title={th ? 'ตั้งรหัสผ่านใหม่' : 'Reset password'}
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={() => window.confirm(th ? `ลบสมาชิก ${m.email} ถาวร?` : `Delete ${m.email} permanently?`) && void run(() => api.deleteMember(m.id))}
                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                title={th ? 'ลบ' : 'Delete'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
