import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, SkipForward } from 'lucide-react';
import '../site.css';
import { useLanguage } from '../context/LanguageContext';

export interface AdLike {
  id: string;
  title: string;
  sponsorName: string;
  videoUrl: string;
  targetUrl: string;
  skipAfterSeconds: number;
}

interface Props {
  ad: AdLike;
  onFinish: () => void;
  onImpression?: (ad: AdLike) => void;
  onClick?: (ad: AdLike) => void;
}

/** Plays a sponsor video before the movie. Never blocks the viewer: a broken ad is skipped on its own. */
export const AdOverlay: React.FC<Props> = ({ ad, onFinish, onImpression, onClick }) => {
  const { language } = useLanguage();
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onFinish();
  };

  useEffect(() => {
    onImpression?.(ad);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // safety net: if the ad has no usable video, move on after a moment
  useEffect(() => {
    if (!ad.videoUrl) {
      const t = setTimeout(finish, 1500);
      return () => clearTimeout(t);
    }
  }, [ad.videoUrl]);

  const skipIn = Math.max(0, (ad.skipAfterSeconds || 0) - elapsed);
  const canSkip = skipIn === 0;

  const open = () => {
    if (!ad.targetUrl) return;
    onClick?.(ad);
    window.open(ad.targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="site fixed inset-0 z-[80] bg-black flex items-center justify-center">
      {ad.videoUrl && (
        <video
          key={ad.id}
          src={ad.videoUrl}
          autoPlay
          playsInline
          onEnded={finish}
          onError={finish}
          onClick={open}
          className="w-full h-full object-contain cursor-pointer"
        />
      )}

      <div className="absolute top-4 left-4 flex items-center gap-2 text-xs">
        <span className="bg-yellow-400 text-black font-black px-2 py-0.5 rounded">
          {language === 'th' ? 'โฆษณา' : 'AD'}
        </span>
        <span className="text-white/90 font-medium">{ad.sponsorName || ad.title}</span>
      </div>

      <div className="absolute bottom-6 right-4 sm:right-8 flex items-center gap-3">
        {ad.targetUrl && (
          <button
            onClick={open}
            className="px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {language === 'th' ? 'ดูรายละเอียด' : 'Learn more'}
          </button>
        )}
        <button
          onClick={finish}
          disabled={!canSkip}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
            canSkip
              ? 'bg-white text-black border-white cursor-pointer hover:bg-gray-200'
              : 'bg-black/60 text-gray-300 border-white/20 cursor-not-allowed'
          }`}
        >
          <SkipForward className="w-3.5 h-3.5" />
          {canSkip
            ? language === 'th' ? 'ข้ามโฆษณา' : 'Skip ad'
            : language === 'th' ? `ข้ามได้ใน ${skipIn} วินาที` : `Skip in ${skipIn}s`}
        </button>
      </div>
    </div>
  );
};

/** "Banner" placement: a sponsored strip on the page. Counts one view per page load. */
export const SponsoredStrip: React.FC<{
  ad: AdLike;
  onImpression?: (ad: AdLike) => void;
  onClick?: (ad: AdLike) => void;
}> = ({ ad, onImpression, onClick }) => {
  const { language } = useLanguage();
  useEffect(() => {
    onImpression?.(ad);
  }, [ad.id]);
  const safe = /^https?:\/\//i.test(ad.targetUrl || '');
  return (
    <div className="mx-6 md:mx-12 my-6 rounded-xl border border-yellow-400/20 bg-gradient-to-r from-yellow-400/10 to-transparent p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span className="text-[10px] font-black bg-yellow-400 text-black px-1.5 py-0.5 rounded mr-2">
          {language === 'th' ? 'สปอนเซอร์' : 'SPONSORED'}
        </span>
        <span className="text-sm font-semibold text-white">{ad.title}</span>
        {ad.sponsorName && <span className="text-xs text-gray-400 ml-2">{ad.sponsorName}</span>}
      </div>
      {safe && (
        <a
          href={ad.targetUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => onClick?.(ad)}
          className="flex-shrink-0 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {language === 'th' ? 'ดูรายละเอียด' : 'Learn more'}
        </a>
      )}
    </div>
  );
};
