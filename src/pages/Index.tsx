import { useState, useRef } from 'react';
import HeroSection from '@/components/HeroSection';
import ProjectCatalog from '@/components/ProjectCatalog';
import TileOrderingFlow from '@/components/TileOrderingFlow';

type View = 'home' | 'tile-ordering';

const Index = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const catalogRef = useRef<HTMLDivElement>(null);

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleProjectSelect = (projectId: string) => {
    if (projectId === 'tile-flooring') {
      setCurrentView('tile-ordering');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (currentView === 'tile-ordering') {
    return <TileOrderingFlow onBack={() => setCurrentView('home')} />;
  }

  return (
    <div className="min-h-screen">
      <HeroSection onOrderClick={scrollToCatalog} />
      <div ref={catalogRef}>
        <ProjectCatalog onProjectSelect={handleProjectSelect} />
      </div>
    </div>
  );
};

export default Index;
