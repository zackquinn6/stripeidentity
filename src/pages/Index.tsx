import { useRef } from 'react';
import HeroSection from '@/components/HeroSection';
import FounderSection from '@/components/FounderSection';

const Index = () => {
  const aboutRef = useRef<HTMLDivElement>(null);

  const scrollToAbout = () => {
    aboutRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      <HeroSection onLearnMoreClick={scrollToAbout} />
      <div ref={aboutRef}>
        <FounderSection />
      </div>
    </div>
  );
};

export default Index;
