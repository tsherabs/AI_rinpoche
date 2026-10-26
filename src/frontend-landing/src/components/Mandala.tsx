interface MandalaProps {
  className?: string;
  stroke?: string;
}

/** A lotus-petal mandala drawn from simple geometry. */
export default function Mandala({ className = '', stroke = '#E8C27A' }: MandalaProps) {
  const petals = (n: number, r: number, len: number, w: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (360 / n) * i;
      return (
        <path
          key={`${n}-${r}-${i}`}
          d={`M0 ${-r} C ${w} ${-r - len * 0.4}, ${w} ${-r - len * 0.8}, 0 ${-r - len} C ${-w} ${-r - len * 0.8}, ${-w} ${-r - len * 0.4}, 0 ${-r}`}
          transform={`rotate(${a})`}
        />
      );
    });

  return (
    <svg viewBox="-200 -200 400 400" className={className} fill="none" aria-hidden="true">
      <g stroke={stroke} strokeWidth="0.8">
        <circle r="196" strokeDasharray="2 6" />
        <circle r="150" />
        <circle r="146" strokeOpacity="0.5" />
        <circle r="60" />
        <circle r="20" />
        {petals(24, 150, 46, 14)}
        {petals(16, 96, 52, 20)}
        {petals(8, 40, 46, 16)}
      </g>
    </svg>
  );
}
