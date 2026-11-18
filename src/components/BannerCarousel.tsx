import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Info, Play, Star } from 'lucide-react';
import { Banner, Movie } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  banners: Banner[];
  movies: Movie[];
  onPlay: (movie: Movie) => void;
  onDetail: (movie: Movie) => void;
}

const SAFE_URL = /^(https?:\/\/|mailto:|\/)/i;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Homepage hero. Slides come from the banners managed in the admin panel. */
export const BannerCarousel: React.FC<Props> = ({ banners, movies, onPlay, onDetail }) => {
  const { language } = useLanguage();
  const th = language === 'th';
  const [index, setIndex] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2 || prefersReducedMotion()) return; // no auto-rotation for people who asked for less motion
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;
  const banner = banners[Math.min(index, count - 1)];
  const movie = banner.movieId ? movies.find((m) => m.id === banner.movieId) : undefined;
  const link = banner.actionUrl && SAFE_URL.test(banner.actionUrl) ? banner.actionUrl : '';

  return (
    <section className="reveal w-full max-w-[1200px] mx-auto px-4 md:px-6 mt-4" aria-roledescription="carousel" aria-label={th ? 'แนะนำ' : 'Featured'}>
      <div className="relative rounded-[20px] overflow-hidden min-h-[320px] md:min-h-[420px] border border-[var(--border)] bg-[#0c0c0f]">
        {/* fallback glow when a banner has no picture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(225,29,42,0.55),transparent_55%),linear-gradient(135deg,#1a0508,#0c0c0f_60%)]" />
        {banners.map((b, i) =>
          b.imageUrl ? (
            <img
              key={b.id}
              src={b.imageUrl}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                i === index ? 'opacity-100 kb' : 'opacity-0'
              }`}
            />
          ) : null
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c0f] via-[#0c0c0f]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0f]/80 via-transparent to-transparent" />

        <div className="relative p-6 sm:p-9 max-w-[560px] flex flex-col justify-end min-h-[320px] md:min-h-[420px]" aria-live="polite">
          {banner.badgeText && (
            <span className="self-start px-3 py-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold tracking-[0.15em] uppercase mb-3.5">
              {banner.badgeText}
            </span>
          )}
          <h1 className="text-[clamp(26px,5vw,42px)] font-bold leading-[1.1] tracking-[0.01em] mb-2.5">{banner.title}</h1>

          {movie && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)] mb-3.5">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400" />
                {movie.rating.toFixed(1)}
              </span>
              {movie.year && <span>{movie.year}</span>}
              {movie.genres?.length > 0 && <span>{movie.genres.slice(0, 2).join(' / ')}</span>}
              {movie.quality && <span>{movie.quality}</span>}
              {movie.duration && <span>{movie.duration}</span>}
            </div>
          )}

          {banner.subtitle && (
            <p className="text-[13px] text-[#c9c9d1] leading-[1.7] mb-5 max-w-[440px] line-clamp-3">{banner.subtitle}</p>
          )}

          <div className="flex flex-wrap gap-2.5">
            {movie && (
              <>
                <button
                  onClick={() => onPlay(movie)}
                  className="px-6 py-3 rounded-xl bg-white text-black text-sm font-bold flex items-center gap-2 cursor-pointer hover:bg-gray-200 transition"
                >
                  <Play className="w-4 h-4 fill-black" />
                  {th ? 'เล่นตอนนี้' : 'Play now'}
                </button>
                <button
                  onClick={() => onDetail(movie)}
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition"
                >
                  <Info className="w-4 h-4" />
                  {th ? 'รายละเอียด' : 'Details'}
                </button>
              </>
            )}
            {link && (
              <a
                href={link}
                target={link.startsWith('/') ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-xl bg-[var(--accent)] hover:brightness-110 text-white text-sm font-bold flex items-center gap-2 transition"
              >
                <ExternalLink className="w-4 h-4" />
                {th ? 'ดูเพิ่มเติม' : 'Learn more'}
              </a>
            )}
          </div>
        </div>

        {count > 1 && (
          <>
            <button
              onClick={() => setIndex((index - 1 + count) % count)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 cursor-pointer"
              aria-label={th ? 'ก่อนหน้า' : 'Previous'}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIndex((index + 1) % count)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 cursor-pointer"
              aria-label={th ? 'ถัดไป' : 'Next'}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 right-5 flex gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setIndex(i)}
                  aria-label={`${th ? 'สไลด์' : 'Slide'} ${i + 1}`}
                  aria-current={i === index}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
