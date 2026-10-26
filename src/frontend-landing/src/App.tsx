import Hero from './components/Hero';
import AboutSection from './components/AboutSection';
import FeaturesSection from './components/FeaturesSection';
import AskSection from './components/AskSection';
import Marquee from './components/Marquee';
import ScrollProgress from './components/ScrollProgress';
import CursorGlow from './components/CursorGlow';

export default function App() {
  return (
    <main>
      <ScrollProgress />
      <CursorGlow />
      <Hero />
      <AboutSection />
      <Marquee />
      <FeaturesSection />
      <AskSection />
    </main>
  );
}
