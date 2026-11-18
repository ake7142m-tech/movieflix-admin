import React, { useState } from 'react';
import { Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import { VideoAd } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  ads: VideoAd[];
  onChange: (ads: VideoAd[]) => void;
}

const blank = (): VideoAd => ({
  id: '',
  title: '',
  sponsorName: '',
  videoUrl: '',
  targetUrl: '',
  skipAfterSeconds: 5,
  placement: 'pre-roll',
  active: true,
  impressions: 0,
  clicks: 0,
});

const field =
  'w-full bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/40';

export const VideoAdsEditor: React.FC<Props> = ({ ads, onChange }) => {
  const { language } = useLanguage();
  const th = language === 'th';
  const [draft, setDraft] = useState<VideoAd | null>(null);
  const [error, setError] = useState('');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.title.trim()) return setError(th ? 'กรุณากรอกชื่อโฆษณา' : 'Title is required');
    if (draft.placement !== 'banner' && !/^https?:\/\//i.test(draft.videoUrl.trim()))
      return setError(th ? 'ลิงก์วิดีโอต้องขึ้นต้นด้วย http(s)://' : 'Video URL must start with http(s)://');
    if (draft.targetUrl.trim() && !/^https?:\/\//i.test(draft.targetUrl.trim()))
      return setError(th ? 'ลิงก์ปลายทางต้องขึ้นต้นด้วย http(s)://' : 'Target URL must start with http(s)://');
    const clean: VideoAd = {
      ...draft,
      title: draft.title.trim(),
      sponsorName: draft.sponsorName.trim(),
      videoUrl: draft.videoUrl.trim(),
      targetUrl: draft.targetUrl.trim(),
      skipAfterSeconds: Math.max(0, Math.min(60, Math.round(Number(draft.skipAfterSeconds) || 0))),
    };
    if (clean.id) onChange(ads.map((a) => (a.id === clean.id ? { ...a, ...clean } : a)));
    else onChange([...ads, { ...clean, id: `ad-${Date.now().toString(36)}` }]);
    setDraft(null);
    setError('');
  };

  const placementLabel = (p: VideoAd['placement']) =>
    p === 'pre-roll'
      ? th ? 'ก่อนเล่นหนัง (Pre-roll)' : 'Before the movie (Pre-roll)'
      : p === 'mid-roll'
      ? th ? 'กลางเรื่อง (เล่นก่อนหนังในระบบนี้)' : 'Mid-roll (plays before the movie here)'
      : th ? 'แบนเนอร์สปอนเซอร์ในหน้าเว็บ' : 'Sponsored banner on the page';

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-sm text-white">
          {th ? 'โฆษณาที่ติดตั้งในระบบ' : 'Installed advertisements'}
        </h3>
        {!draft && (
          <button
            onClick={() => setDraft(blank())}
            className="text-xs bg-[#E50914] hover:bg-[#E50914]/90 text-white px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            {th ? 'เพิ่มโฆษณา' : 'Add ad'}
          </button>
        )}
      </div>

      {draft && (
        <form onSubmit={save} className="bg-[#1A1A1A] rounded-xl p-4 border border-white/10 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm">
              {draft.id ? (th ? 'แก้ไขโฆษณา' : 'Edit ad') : th ? 'โฆษณาใหม่' : 'New ad'}
            </span>
            <button type="button" onClick={() => { setDraft(null); setError(''); }} className="text-gray-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-gray-300">{th ? 'ชื่อโฆษณา' : 'Title'}</span>
              <input className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="space-y-1 block">
              <span className="text-gray-300">{th ? 'ชื่อสปอนเซอร์' : 'Sponsor'}</span>
              <input className={field} value={draft.sponsorName} onChange={(e) => setDraft({ ...draft, sponsorName: e.target.value })} />
            </label>
            <label className="space-y-1 block sm:col-span-2">
              <span className="text-gray-300">
                {th ? 'ลิงก์ไฟล์วิดีโอโฆษณา (mp4 / webm)' : 'Ad video file URL (mp4 / webm)'}
              </span>
              <input className={`${field} font-mono`} value={draft.videoUrl} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} placeholder="https://.../ad.mp4" />
            </label>
            <label className="space-y-1 block sm:col-span-2">
              <span className="text-gray-300">{th ? 'ลิงก์ปลายทางเมื่อคลิก' : 'Click-through URL'}</span>
              <input className={`${field} font-mono`} value={draft.targetUrl} onChange={(e) => setDraft({ ...draft, targetUrl: e.target.value })} placeholder="https://..." />
            </label>
            <label className="space-y-1 block">
              <span className="text-gray-300">{th ? 'ตำแหน่งที่แสดง' : 'Placement'}</span>
              <select className={field} value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value as VideoAd['placement'] })}>
                <option value="pre-roll">{placementLabel('pre-roll')}</option>
                <option value="mid-roll">{placementLabel('mid-roll')}</option>
                <option value="banner">{placementLabel('banner')}</option>
              </select>
            </label>
            <label className="space-y-1 block">
              <span className="text-gray-300">{th ? 'ข้ามได้หลัง (วินาที)' : 'Skippable after (s)'}</span>
              <input type="number" min={0} max={60} className={field} value={draft.skipAfterSeconds} onChange={(e) => setDraft({ ...draft, skipAfterSeconds: Number(e.target.value) })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            {th ? 'เปิดใช้งานทันที' : 'Active'}
          </label>
          {error && <p className="text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#28A745] hover:bg-[#28A745]/90 text-white font-semibold cursor-pointer">
              {th ? 'บันทึก' : 'Save'}
            </button>
            <button type="button" onClick={() => { setDraft(null); setError(''); }} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
              {th ? 'ยกเลิก' : 'Cancel'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {ads.length === 0 && !draft && (
          <div className="text-xs text-gray-500 bg-[#1A1A1A] rounded-xl p-6 text-center border border-white/5">
            {th ? 'ยังไม่มีโฆษณา กด "เพิ่มโฆษณา" เพื่อเริ่มต้น' : 'No ads yet. Click "Add ad" to start.'}
          </div>
        )}
        {ads.map((ad) => {
          const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';
          return (
            <div key={ad.id} className="bg-[#1A1A1A] rounded-xl p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="space-y-1 min-w-0 text-xs text-gray-400">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white">{ad.title}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ad.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {ad.active ? (th ? 'กำลังเปิดใช้งาน' : 'Active') : th ? 'ปิดชั่วคราว' : 'Disabled'}
                  </span>
                </div>
                <div>
                  {th ? 'สปอนเซอร์:' : 'Sponsor:'} <strong className="text-white">{ad.sponsorName || '-'}</strong>
                </div>
                <div>
                  <span className="text-[#0071EB]">{placementLabel(ad.placement)}</span>
                  {ad.placement !== 'banner' && <> · {th ? `ข้ามได้หลัง ${ad.skipAfterSeconds} วินาที` : `skippable after ${ad.skipAfterSeconds}s`}</>}
                </div>
                <div className="font-mono text-[11px] pt-0.5">
                  {th ? 'ยอดดู' : 'Views'} {ad.impressions.toLocaleString()} · {th ? 'คลิก' : 'Clicks'} {ad.clicks.toLocaleString()} · CTR {ctr}%
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onChange(ads.map((a) => (a.id === ad.id ? { ...a, active: !a.active } : a)))}
                  className={`p-2 rounded-lg cursor-pointer ${ad.active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-400 hover:bg-white/10'}`}
                  title={ad.active ? (th ? 'ปิดใช้งาน' : 'Disable') : th ? 'เปิดใช้งาน' : 'Enable'}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button onClick={() => { setDraft({ ...ad }); setError(''); }} className="p-2 rounded-lg text-gray-300 hover:bg-white/10 cursor-pointer" title={th ? 'แก้ไข' : 'Edit'}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => window.confirm(th ? `ลบโฆษณา "${ad.title}" ?` : `Delete "${ad.title}"?`) && onChange(ads.filter((a) => a.id !== ad.id))}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                  title={th ? 'ลบ' : 'Delete'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
