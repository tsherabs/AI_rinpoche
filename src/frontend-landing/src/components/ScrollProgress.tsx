import { useEffect, useState } from 'react';

/** Thin golden thread along the top that fills as you scroll. */
export default function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? window.scrollY / h : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[60] pointer-events-none" aria-hidden="true">
      <div
        className="h-full origin-left bg-gradient-to-r from-rose-300 via-gold to-rose-100 shadow-[0_0_12px_rgba(232,194,122,0.8)]"
        style={{ transform: `scaleX(${p})` }}
      />
    </div>
  );
}
