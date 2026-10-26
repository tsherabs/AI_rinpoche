import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import Reveal from './Reveal';
import Mandala from './Mandala';
import Sparkles from './Sparkles';

const questions = [
  'How do I stay calm when my mind is restless?',
  'What does compassion ask of me today?',
  'How can I practise when life feels too busy?',
  'What is the meaning of impermanence?',
  'How do I begin to meditate?',
];

/** Types each sample question out, holds, erases, and moves on. */
function useTypewriter(lines: string[]) {
  const [text, setText] = useState('');
  useEffect(() => {
    let i = 0;
    let n = 0;
    let dir: 1 | -1 = 1;
    let t: number;
    const tick = () => {
      const line = lines[i];
      n += dir;
      setText(line.slice(0, n));
      let wait = dir === 1 ? 55 : 22;
      if (dir === 1 && n === line.length) {
        dir = -1;
        wait = 1800;
      } else if (dir === -1 && n === 0) {
        dir = 1;
        i = (i + 1) % lines.length;
        wait = 400;
      }
      t = window.setTimeout(tick, wait);
    };
    t = window.setTimeout(tick, 600);
    return () => window.clearTimeout(t);
  }, [lines]);
  return text;
}

export default function AskSection() {
  const typed = useTypewriter(questions);

  return (
    <section
      id="ask"
      className="relative overflow-hidden bg-gradient-to-b from-maroon-900 to-maroon-950 px-6 py-24 md:py-36"
    >
      <Mandala className="absolute -right-40 -top-40 w-[640px] opacity-[0.12] animate-spin-slow" />
      <Mandala className="absolute -left-52 -bottom-52 w-[560px] opacity-[0.09] animate-spin-slower" stroke="#F8D7D3" />
      <Sparkles count={14} />

      <div className="relative max-w-3xl mx-auto text-center">
        <Reveal className="flex flex-col items-center gap-6">
          <p className="text-gold text-xs tracking-[0.35em] uppercase font-medium">A quiet place to ask</p>
          <h2 className="text-white text-3xl sm:text-5xl leading-[1.15]">
            Begin with a{' '}
            <span className="text-shine" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
              single question
            </span>
          </h2>

          {/* glowing prompt box */}
          <div className="relative w-full mt-4 group">
            <div className="relative rounded-3xl p-[1.5px] overflow-hidden">
              <div
                className="absolute inset-[-100%]"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0 60%, #e8c27a 80%, #f8d7d3 90%, transparent 100%)',
                  animation: 'spin-slow 6s linear infinite',
                }}
              />
              <div className="relative flex items-center gap-4 rounded-[22px] bg-maroon-950/95 backdrop-blur px-6 py-5 text-left">
                <p className="flex-1 min-h-[1.75rem] text-white/90 text-base sm:text-lg" aria-live="off">
                  {typed}
                  <span className="inline-block w-[2px] h-5 bg-gold ml-0.5 align-middle" style={{ animation: 'caret 1s steps(1) infinite' }} />
                </p>
                <a
                  href="http://localhost:5173/chat"
                  aria-label="Start asking"
                  className="btn-shine shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-rose-100 to-rose-300 text-maroon-900 flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <Send size={18} />
                </a>
              </div>
            </div>
          </div>

          <p className="text-white/50 text-sm max-w-md">
            Answers stay close to the teachings, in plain and gentle language.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
