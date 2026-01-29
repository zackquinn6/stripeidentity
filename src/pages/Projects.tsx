import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCatalog from '@/components/ProjectCatalog';
import TileOrderingFlow from '@/components/TileOrderingFlow';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

type View = 'catalog' | 'tile-ordering';

const Projects = () => {
  const [currentView, setCurrentView] = useState<View>('catalog');
  const navigate = useNavigate();

  const handleProjectSelect = (projectId: string) => {
    if (projectId === 'tile-flooring') {
      setCurrentView('tile-ordering');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (currentView === 'tile-ordering') {
    return <TileOrderingFlow onBack={() => setCurrentView('catalog')} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>
      <ProjectCatalog onProjectSelect={handleProjectSelect} />
    </div>
  );
};

export default Projects;
