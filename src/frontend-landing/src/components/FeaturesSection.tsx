import { useEffect, useRef, useState } from 'react';
import Logo from './Logo';
import { photos } from '../images';
import Sparkles from './Sparkles';
import Mandala from './Mandala';

const features = [
  {
    title: 'Ask, simply and sincerely',
    description:
      'Bring any question, big or small. AI Rinpoche answers in plain, gentle language, drawing on the teachings of Shechen Rabjam Rinpoche so you are never left decoding.',
    photo: photos.throne,
    position: '50% 30%',
  },
  {
    title: 'Grounded in the teachings',
    description:
      'Responses stay close to the source material, so what you read feels faithful and considered rather than improvised. A quiet way to return to the words that matter.',
    photo: photos.portrait,
    position: '50% 25%',
  },
  {
    title: 'Room to reflect',
    description:
      'No notifications, no clutter. A stripped-back conversation that lets each answer settle, and lets you take your time before the next question.',
    photo: photos.prayer,
    position: '50% 30%',
  },
];

function CtaBar() {
  return (
    <div className="bg-black/25 backdrop-blur-md rounded-xl flex items-center pl-6 pr-1 py-1 w-fit border border-gold/20">
      <span className="text-white text-sm font-medium pr-5">
        No noise. No complicated systems. Just a quiet place to ask.
      </span>
      <button
        type="button"
        className="btn-shine bg-white text-black text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-white/90 hover:-translate-y-0.5 transition-all whitespace-nowrap"
      >
        Start asking
      </button>
    </div>
  );
}

export default function FeaturesSection() {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>(() => features.map(() => false));

  useEffect(() => {
    const activeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActive(idx);
          }
        });
      },
      { threshold: 0.6 },
    );

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) {
              setRevealed((prev) => {
                if (prev[idx]) return prev;
                const next = [...prev];
                next[idx] = true;
                return next;
              });
              revealObserver.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.15 },
    );

    cardRefs.current.forEach((el) => {
      if (el) {
        activeObserver.observe(el);
        revealObserver.observe(el);
      }
    });

    return () => {
      activeObserver.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  const scrollTo = (i: number) => {
    cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section
      id="features"
      className="relative px-5 md:px-10 lg:px-16 py-20 md:py-40 lg:py-48"
    >
      {/* Fixed backdrop: the photo, blurred and deepened into red */}
      <div className="fixed inset-0 -z-10 bg-[#3B1210]">
        <img
          src="/rinpoche.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover blur-2xl scale-110 opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#5A1B17]/60 via-[#3B1210]/50 to-black/60" />
        <Mandala className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] max-w-none opacity-[0.07] animate-spin-slow" />
        <Sparkles count={16} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] xl:grid-cols-[460px_1fr] gap-10 lg:gap-24 xl:gap-48">
        {/* Left column */}
        <div className="lg:sticky lg:top-0 lg:h-screen lg:flex lg:flex-col lg:justify-between lg:py-32">
          <h2 className="text-white text-2xl sm:text-3xl lg:text-[46px] leading-[1.2] font-normal">
            Wisdom that meets your{' '}
            <span className="text-shine" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
              questions, gently
            </span>
          </h2>

          <div className="hidden lg:flex flex-col gap-2 items-start">
            {features.map((f, i) => (
              <button
                key={f.title}
                type="button"
                onClick={() => scrollTo(i)}
                className={`text-left text-sm font-medium px-4 py-2.5 rounded-xl bg-black/20 transition-all duration-500 ${
                  active === i ? 'text-white bg-white/10 shadow-[inset_0_0_0_1px_rgba(232,194,122,0.5)]' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {f.title}
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <CtaBar />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-8 md:gap-16 lg:gap-[30vh]">
          {features.map((f, i) => (
            <div
              key={f.title}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
              }}
              className={`glass-card bg-black/20 backdrop-blur-sm rounded-3xl p-6 md:p-10 flex flex-col gap-6 transition-all duration-700 ease-out ${
                revealed[i] ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16'
              }`}
            >
              <span className="inline-block w-fit animate-[spin-slow_24s_linear_infinite]"><Logo fill="#E8C27A" /></span>
              <h3 className="text-white text-xl md:text-2xl font-medium">
                <span className="text-shine">{f.title}</span>
              </h3>
              <div className="aspect-video rounded-2xl overflow-hidden bg-black/30 ring-1 ring-white/10">
                <img
                  src={f.photo.src}
                  alt={f.photo.alt}
                  className="w-full h-full object-cover animate-slow-zoom"
                  style={{ objectPosition: f.position, transformOrigin: f.position }}
                />
              </div>
              <p className="text-white/60 font-medium text-sm md:text-base leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
