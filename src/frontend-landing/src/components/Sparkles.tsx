import { useMemo } from 'react';

interface SparklesProps {
  count?: number;
  className?: string;
}

/** Scattered gold twinkles. Positions are seeded so they stay stable across renders. */
export default function Sparkles({ count = 18, className = '' }: SparklesProps) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (n: number) => {
          const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280;
          return x - Math.floor(x);
        };
        return {
          left: `${(r(1) * 100).toFixed(1)}%`,
          top: `${(r(2) * 100).toFixed(1)}%`,
          size: 6 + r(3) * 14,
          delay: `${(r(4) * 6).toFixed(2)}s`,
          dur: `${(2.8 + r(5) * 3).toFixed(2)}s`,
        };
      }),
    [count],
  );

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      {items.map((s, i) => (
        <span
          key={i}
          className="sparkle"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.dur,
          }}
        />
      ))}
    </div>
  );
}
