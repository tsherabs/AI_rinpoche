import { useMemo } from 'react';

const W = 2400; // two periods wide so a -50% slide loops seamlessly
const H = 600;

function wave(amp: number, phase: number, cycles: number, y: number) {
  const steps = 120;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * W;
    const t = (i / steps) * Math.PI * 2 * cycles + phase;
    const yy = y + Math.sin(t) * amp + Math.sin(t * 2 + phase) * amp * 0.18;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${yy.toFixed(1)} `;
  }
  return d;
}

interface Strand {
  d: string;
  dur: number;
  opacity: number;
  gold: boolean;
  width: number;
  reverse: boolean;
}

/** Slowly drifting, interlacing strands — a woven-silk backdrop. */
export default function WaveField({ className = '' }: { className?: string }) {
  const strands = useMemo<Strand[]>(() => {
    const list: Strand[] = [];
    for (let i = 0; i < 9; i++) {
      list.push({
        d: wave(46 + i * 6, i * 0.7, 2, 150 + i * 38),
        dur: 46 + i * 7,
        opacity: 0.16 + (i % 3) * 0.07,
        gold: i % 3 === 0,
        width: i % 3 === 0 ? 1.2 : 0.8,
        reverse: i % 2 === 1,
      });
    }
    return list;
  }, []);

  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <svg
        viewBox={`0 0 ${W / 2} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id="strand-gold" x1="0" x2="1">
            <stop offset="0" stopColor="#e8c27a" stopOpacity="0" />
            <stop offset="0.5" stopColor="#f6dca0" />
            <stop offset="1" stopColor="#e8c27a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="strand-rose" x1="0" x2="1">
            <stop offset="0" stopColor="#f8d7d3" stopOpacity="0" />
            <stop offset="0.5" stopColor="#f8d7d3" />
            <stop offset="1" stopColor="#f8d7d3" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      {strands.map((s, i) => (
        <svg
          key={i}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute top-0 left-0 h-full"
          style={{
            width: '200%',
            animation: `wave-drift ${s.dur}s linear infinite ${s.reverse ? 'reverse' : 'normal'}`,
            opacity: s.opacity,
          }}
        >
          <path
            d={s.d}
            fill="none"
            stroke={s.gold ? '#e8c27a' : '#f8d7d3'}
            strokeWidth={s.width}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ))}
    </div>
  );
}
