import Logo from './Logo';

const phrases = [
  'Ask with an open heart',
  'Om Mani Padme Hum',
  'Receive the teachings',
  'Shechen Rabjam Rinpoche',
  'One quiet question at a time',
  'Calm, amplified',
];

/** Endless ribbon of phrases, edges softly faded. */
export default function Marquee() {
  const row = [...phrases, ...phrases];
  return (
    <div
      className="relative bg-maroon-900 border-y border-gold/20 py-5 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)',
      }}
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee">
        {[0, 1].map((k) => (
          <div key={k} className="flex items-center shrink-0">
            {row.map((p, i) => (
              <div key={`${k}-${i}`} className="flex items-center">
                <span
                  className="text-2xl md:text-3xl text-shine px-8 whitespace-nowrap"
                  style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}
                >
                  {p}
                </span>
                <Logo size={18} fill="#E8C27A" className="opacity-80" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
