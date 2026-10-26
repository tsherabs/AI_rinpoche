import { Mail, Plus } from 'lucide-react';
import Logo from './Logo';
import Reveal from './Reveal';
import { photos } from '../images';
import Mandala from './Mandala';
import Sparkles from './Sparkles';

const DARK = '#3B1210';

const gallery = [
  { ...photos.throne, position: '50% 30%', delay: '0s', tilt: '-rotate-3' },
  { ...photos.portrait, position: '50% 25%', delay: '1.5s', tilt: 'rotate-2' },
  { ...photos.prayer, position: '50% 30%', delay: '3s', tilt: '-rotate-2' },
];

export default function AboutSection() {
  return (
    <section
      id="about"
      className="bg-[#F8D7D3] rounded-t-[25px] relative z-10 py-20 md:py-32 px-6 overflow-hidden"
    >
      <Mandala
        className="absolute -left-40 top-24 w-[520px] opacity-[0.18] animate-spin-slow"
        stroke="#C8964A"
      />
      <Mandala
        className="absolute -right-48 bottom-10 w-[600px] opacity-[0.14] animate-spin-slower"
        stroke="#3B1210"
      />
      <Sparkles count={10} className="opacity-70" />
      <div className="relative max-w-6xl mx-auto flex flex-col items-center gap-16 md:gap-20">
        {/* Top area */}
        <div className="max-w-3xl w-full flex flex-col items-center gap-8">
          <Reveal className="flex flex-col items-center gap-8">
            <p className="text-[#3B1210] text-base md:text-lg text-center leading-relaxed max-w-lg">
              We build tools that carry the teachings with care, not haste. Designed for
              stillness, sincerity, and open questions.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="mailto:hello@airinpoche.example"
                className="group inline-flex items-center gap-3 bg-[#3B1210] hover:bg-[#230B09] text-[#FFF5F3] rounded-full pl-1.5 pr-6 py-1.5 transition-all hover:-translate-y-0.5"
              >
                <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <Mail size={16} color={DARK} />
                </span>
                <span className="text-sm uppercase tracking-wide font-medium">Say hello</span>
              </a>
              <a
                href="#features"
                className="group inline-flex items-center gap-3 bg-[#E9B9B3] hover:bg-[#DFA9A2] text-[#3B1210] rounded-full pl-1.5 pr-6 py-1.5 transition-all hover:-translate-y-0.5"
              >
                <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center transition-transform duration-300 group-hover:rotate-90">
                  <Plus size={16} color={DARK} />
                </span>
                <span className="text-sm uppercase tracking-wide font-medium">Stay informed</span>
              </a>
            </div>
          </Reveal>
        </div>

        {/* Floating photo cards */}
        <div className="flex justify-center items-center gap-4 sm:gap-8 md:gap-12">
          {gallery.map((g, i) => (
            <Reveal key={g.src} delay={i * 150}>
              <div
                className={`${g.tilt} group relative w-24 h-32 sm:w-36 sm:h-48 md:w-48 md:h-64 rounded-2xl overflow-hidden shadow-xl border-4 border-[#FFF5F3] animate-float hover:scale-105 hover:rotate-0 hover:shadow-[0_20px_50px_-10px_rgba(59,18,16,0.5)] transition-all duration-500`}
                style={{ animationDelay: g.delay }}
              >
                <img
                  src={g.src}
                  alt={g.alt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  style={{ objectPosition: g.position }}
                />
                <span className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent group-hover:left-[150%] transition-all duration-1000" />
              </div>
            </Reveal>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-[2px]">
          <span className="w-2 h-2 rounded-full bg-[#E9B9B3]" />
          <span className="gold-line flex-1 h-[2px]" style={{ backgroundColor: '#E9B9B3', backgroundBlendMode: 'normal' }} />
          <span className="w-2 h-2 rounded-full bg-[#E9B9B3]" />
        </div>

        {/* Bottom area */}
        <div className="w-full max-w-6xl flex flex-col md:flex-row gap-10 md:gap-16">
          <Reveal className="flex md:flex-col items-center md:items-start gap-4 md:w-48 shrink-0">
            <span className="inline-block animate-[spin-slow_20s_linear_infinite]"><Logo fill={DARK} /></span>
            <p className="text-xs uppercase tracking-widest font-semibold text-[#3B1210]">
              Calm
              <br />
              Amplified
            </p>
          </Reveal>
          <Reveal delay={150}>
            <p className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] leading-[1.3] font-normal text-[#3B1210]">
              We make AI tools and companions. But, most importantly, we help you remember what
              it feels like to ask with an open heart. We create spaces that hold the teachings
              with care, so you can attend to what truly matters.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
