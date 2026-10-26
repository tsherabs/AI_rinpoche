import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import Logo from './Logo';

const links = [
  { label: 'Home', href: '#top' },
  { label: 'Features', href: '#features' },
  { label: 'About', href: '#about' },
  { label: 'Ask', href: '#ask' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const ease = 'cubic-bezier(0.77,0,0.175,1)';

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-maroon-950/75 backdrop-blur-lg shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 py-4 md:py-5 animate-fade-up">
        <a href="#top" className="group flex items-center gap-3">
          <span className="transition-transform duration-700 group-hover:rotate-180">
            <Logo size={34} fill="#F8D7D3" />
          </span>
          <span className="text-white text-sm md:text-base font-semibold tracking-[0.18em] uppercase">
            Rinpoche<span className="text-gold">.</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-10">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="relative text-white/90 text-[13px] font-medium tracking-[0.16em] uppercase py-1 group"
            >
              {l.label}
              <span className="absolute left-0 -bottom-0.5 h-px w-full origin-left scale-x-0 bg-gradient-to-r from-rose-300 via-gold to-rose-300 transition-transform duration-500 group-hover:scale-x-100" />
            </a>
          ))}
          <a
            href="#ask"
            aria-label="Search the teachings"
            className="text-white/90 hover:text-gold transition-colors hover:rotate-12"
          >
            <Search size={18} />
          </a>
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="md:hidden relative w-8 h-8 flex items-center justify-center"
        >
          <span
            className="absolute block h-[2px] w-6 bg-white"
            style={{
              transition: `transform 300ms ${ease}`,
              transform: open ? 'rotate(45deg)' : 'translateY(-4px)',
            }}
          />
          <span
            className="absolute block h-[2px] w-6 bg-white"
            style={{
              transition: `transform 300ms ${ease}`,
              transform: open ? 'rotate(-45deg)' : 'translateY(4px)',
            }}
          />
        </button>
      </nav>

      <div
        className={`md:hidden mx-4 mb-3 rounded-2xl bg-maroon-950/90 backdrop-blur-xl border border-gold/20 p-2 origin-top transition-all duration-300 ${
          open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none h-0 p-0 mb-0 border-0'
        }`}
      >
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 rounded-xl text-sm font-medium tracking-widest uppercase text-white hover:bg-white/10 transition-colors"
          >
            {l.label}
          </a>
        ))}
      </div>
    </header>
  );
}
