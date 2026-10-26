import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { photos } from '../images';
import Navbar from './Navbar';
import WaveField from './WaveField';
import Sparkles from './Sparkles';

const slides = [
  { ...photos.prayer, position: '50% 22%' },
  { ...photos.throne, position: '50% 30%' },
  { ...photos.portrait, position: '50% 30%' },
];

const serif = { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' } as const;

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setCurrent((c) => (c + 1) % slides.length), 6500);
    return () => window.clearInterval(id);
  }, []);

  // gentle 3D tilt that follows the pointer
  const onMove = (e: React.PointerEvent) => {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg)`;
  };
  const onLeave = () => {
    if (stage.current) stage.current.style.transform = 'perspective(1100px) rotateY(0) rotateX(0)';
  };

  return (
    <section
      id="top"
      className="relative min-h-screen overflow-hidden mb-[-25px] pb-16 bg-gradient-to-br from-maroon-950 via-maroon-900 to-maroon-800"
    >
      {/* atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_75%_55%,rgba(233,185,179,0.22),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(40%_40%_at_10%_90%,rgba(232,194,122,0.10),transparent_70%)]" />
      <WaveField className="absolute inset-0" />
      <Sparkles count={22} />

      <Navbar />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-28 md:pt-0 min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-6 items-center">
        {/* copy + form */}
        <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
          <p
            className="animate-fade-up text-gold text-xs tracking-[0.35em] uppercase font-medium mb-5"
            style={{ animationDelay: '50ms' }}
          >
            Shechen Rabjam Rinpoche
          </p>
          <h1 className="font-normal leading-[1.08] tracking-tight">
            <span className="block animate-fade-up text-white text-4xl sm:text-6xl lg:text-[54px] xl:text-[60px] lg:whitespace-nowrap">
              Ask with an open heart
            </span>
            <span
              className="block animate-fade-up text-4xl sm:text-6xl lg:text-[58px] xl:text-[66px] text-shine pb-2"
              style={{ ...serif, animationDelay: '200ms' }}
            >
              receive the teachings
            </span>
          </h1>

          <p
            className="mt-6 text-white/75 text-sm md:text-base leading-relaxed max-w-[440px] animate-fade-up"
            style={{ animationDelay: '400ms' }}
          >
            AI Rinpoche is a gentle companion for exploring the teachings of Shechen Rabjam
            Rinpoche, one quiet question at a time. No noise. No complicated systems.
          </p>

          <div className="mt-8 animate-fade-up" style={{ animationDelay: '600ms' }}>
            <a
              href="http://localhost:5173/chat"
              className="btn-shine group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-300 to-rose-100 text-maroon-900 text-sm font-semibold px-7 py-3 shadow-[0_8px_30px_-8px_rgba(233,185,179,0.8)] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-6px_rgba(232,194,122,0.8)] active:translate-y-0 transition-all"
            >
              Start asking
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>

        {/* blob stage */}
        <div
          className="relative flex justify-center items-center py-6 lg:py-0"
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          <div
            ref={stage}
            className="relative w-[min(86vw,560px)] aspect-[1/1.05] transition-transform duration-300 ease-out animate-fade-up"
            style={{ animationDelay: '300ms', transformStyle: 'preserve-3d' }}
          >
            {/* outline ring */}
            <div className="absolute -inset-[7%] animate-spin-slow">
              <div className="blob-b absolute inset-0 border border-white/60" />
            </div>
            {/* glowing gradient blob */}
            <div className="absolute -inset-[3%] animate-spin-slower">
              <div className="blob-b absolute inset-0 bg-gradient-to-br from-rose-100 via-rose-300 to-maroon-800 opacity-90 shadow-[0_0_90px_10px_rgba(233,185,179,0.35)]" />
            </div>
            {/* photo blob */}
            <div className="blob-a absolute inset-[4%] overflow-hidden bg-maroon-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/20">
              {slides.map((s, i) => (
                <img
                  key={s.src}
                  src={s.src}
                  alt={s.alt}
                  style={{ objectPosition: s.position }}
                  className={`absolute inset-0 w-full h-full object-cover animate-slow-zoom transition-opacity duration-[1800ms] ease-in-out ${
                    i === current ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/40 via-transparent to-transparent" />
              {/* a slow glint crossing the photo */}
              <div
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                style={{ animation: 'glint 7s ease-in-out infinite', transform: 'translateX(-150%) skewX(-20deg)' }}
              />
            </div>

            {/* floating orbs */}
            <span className="absolute -top-1 left-[12%] w-3 h-3 rounded-full bg-gold shadow-[0_0_20px_6px_rgba(232,194,122,0.7)] animate-float" />
            <span
              className="absolute bottom-[14%] -left-2 w-2.5 h-2.5 rounded-full bg-rose-100 shadow-[0_0_16px_4px_rgba(248,215,211,0.7)] animate-float"
              style={{ animationDelay: '1.5s' }}
            />
            <span
              className="absolute top-[30%] -right-3 w-4 h-4 rounded-full bg-gold/90 shadow-[0_0_24px_8px_rgba(232,194,122,0.6)] animate-float"
              style={{ animationDelay: '3s' }}
            />

            {/* indicators */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-2 items-center z-10">
              {slides.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  aria-label={`Show photo ${i + 1}`}
                  onClick={() => setCurrent(i)}
                  className="relative w-3 h-3 flex items-center justify-center"
                >
                  <span
                    className={`block rounded-full transition-all duration-500 ${
                      i === current ? 'w-3 h-3 bg-gold shadow-[0_0_12px_rgba(232,194,122,0.9)]' : 'w-2 h-2 bg-white/80'
                    }`}
                  />
                  {i === current && (
                    <span
                      className="absolute inset-0 rounded-full border border-gold"
                      style={{ animation: 'pulse-ring 2s ease-out infinite' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* scroll cue */}
      <div className="absolute bottom-10 left-6 md:left-10 hidden md:flex items-center gap-3 text-white/60 text-[11px] tracking-[0.3em] uppercase">
        <span className="gold-line block w-12 h-px" />
        Scroll
      </div>
    </section>
  );
}
