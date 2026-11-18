import React from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutTemplate, Network, Plus, Trash2 } from 'lucide-react';
import { Category, MenuLink, MenuLinkType, MenusConfig } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  menus: MenusConfig;
  categories: Category[];
  onChange: (menus: MenusConfig) => void;
}

const TYPE_LABELS: Record<MenuLinkType, { th: string; en: string }> = {
  home: { th: 'หน้าแรก', en: 'Home' },
  category: { th: 'หมวดหมู่หนัง', en: 'Movie category' },
  live: { th: 'ถ่ายทอดสด', en: 'Live sports' },
  faq: { th: 'คำถามที่พบบ่อย (เลื่อนไปหา)', en: 'FAQ (scroll to)' },
  contact: { th: 'ติดต่อ (อีเมลในตั้งค่า)', en: 'Contact (settings email)' },
  url: { th: 'ลิงก์ภายนอก', en: 'External link' },
};

const inputCls =
  'bg-[#0F0F0F] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-white/40 min-w-0';

export const MenusEditor: React.FC<Props> = ({ menus, categories, onChange }) => {
  const { language } = useLanguage();
  const th = language === 'th';

  const update = (area: 'header' | 'footer', list: MenuLink[]) => onChange({ ...menus, [area]: list });

  const patch = (area: 'header' | 'footer', id: string, p: Partial<MenuLink>) =>
    update(area, menus[area].map((l) => (l.id === id ? { ...l, ...p } : l)));

  const move = (area: 'header' | 'footer', i: number, dir: -1 | 1) => {
    const list = [...menus[area]];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    update(area, list);
  };

  const add = (area: 'header' | 'footer') =>
    update(area, [
      ...menus[area],
      { id: `menu-${Date.now().toString(36)}`, label: th ? 'ลิงก์ใหม่' : 'New link', type: 'url', value: 'https://', visible: true },
    ]);

  const renderArea = (area: 'header' | 'footer') => {
    const Icon = area === 'header' ? LayoutTemplate : Network;
    return (
      <div className="bg-[#1A1A1A] rounded-xl p-4 sm:p-5 border border-white/5 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Icon className={`w-4 h-4 ${area === 'header' ? 'text-[#0071EB]' : 'text-[#E50914]'}`} />
            {area === 'header'
              ? th ? 'เมนูส่วนหัวเว็บ (Header)' : 'Header navigation'
              : th ? 'ลิงก์ส่วนท้ายเว็บ (Footer)' : 'Footer links'}
          </h3>
          <button
            onClick={() => add(area)}
            className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {th ? 'เพิ่มลิงก์' : 'Add link'}
          </button>
        </div>

        <ul className="space-y-2">
          {menus[area].length === 0 && (
            <li className="text-xs text-gray-500 py-3 text-center">{th ? 'ยังไม่มีลิงก์' : 'No links yet'}</li>
          )}
          {menus[area].map((l, i) => (
            <li
              key={l.id}
              className={`p-2.5 rounded-lg border border-white/5 bg-[#141414] space-y-2 ${l.visible ? '' : 'opacity-50'}`}
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  value={l.label}
                  onChange={(e) => patch(area, l.id, { label: e.target.value })}
                  placeholder={th ? 'ชื่อ (ไทย)' : 'Label (TH)'}
                />
                <input
                  className={inputCls}
                  value={l.labelEn || ''}
                  onChange={(e) => patch(area, l.id, { labelEn: e.target.value })}
                  placeholder={th ? 'ชื่อ (อังกฤษ)' : 'Label (EN)'}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={`${inputCls} flex-1 basis-40`}
                  value={l.type}
                  onChange={(e) => {
                    const type = e.target.value as MenuLinkType;
                    patch(area, l.id, {
                      type,
                      value: type === 'category' ? categories[0]?.name || '' : type === 'url' ? 'https://' : '',
                    });
                  }}
                >
                  {(Object.keys(TYPE_LABELS) as MenuLinkType[]).map((t) => (
                    <option key={t} value={t}>
                      {th ? TYPE_LABELS[t].th : TYPE_LABELS[t].en}
                    </option>
                  ))}
                </select>

                {l.type === 'category' && (
                  <select
                    className={`${inputCls} flex-1 basis-40`}
                    value={l.value || ''}
                    onChange={(e) => patch(area, l.id, { value: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {l.type === 'url' && (
                  <input
                    className={`${inputCls} flex-1 basis-48 font-mono`}
                    value={l.value || ''}
                    onChange={(e) => patch(area, l.id, { value: e.target.value })}
                    placeholder="https://..."
                  />
                )}

                <div className="flex items-center gap-0.5 ml-auto">
                  <button onClick={() => move(area, i, -1)} disabled={i === 0} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer" title="Up">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => move(area, i, 1)} disabled={i === menus[area].length - 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer" title="Down">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => patch(area, l.id, { visible: !l.visible })}
                    className="p-1.5 text-gray-400 hover:text-white cursor-pointer"
                    title={l.visible ? (th ? 'ซ่อน' : 'Hide') : th ? 'แสดง' : 'Show'}
                  >
                    {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => update(area, menus[area].filter((x) => x.id !== l.id))}
                    className="p-1.5 text-gray-400 hover:text-red-400 cursor-pointer"
                    title={th ? 'ลบ' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        {th
          ? 'แก้แล้วบันทึกอัตโนมัติ และหน้าเว็บผู้ชมที่เปิดอยู่จะอัปเดตทันที'
          : 'Changes save automatically and open visitor pages update immediately.'}
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {renderArea('header')}
        {renderArea('footer')}
      </div>
    </div>
  );
};
