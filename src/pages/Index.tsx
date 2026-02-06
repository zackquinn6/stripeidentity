import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import HeroSection from '@/components/HeroSection';
import FounderSection from '@/components/FounderSection';

const Index = () => {
  const aboutRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToAbout = () => {
    aboutRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      <HeroSection onLearnMoreClick={scrollToAbout} />
      <div ref={aboutRef}>
        <FounderSection />
      </div>
      
      {/* Admin login button - bottom left */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/auth')}
        className="fixed bottom-4 left-4 text-muted-foreground/50 hover:text-muted-foreground text-xs"
      >
        <LogIn className="w-3 h-3 mr-1" />
        Admin
      </Button>

      {/* Test button - bottom left */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/test')}
        className="fixed bottom-4 left-20 z-50 text-muted-foreground/50 hover:text-muted-foreground text-xs"
      >
        Test
      </Button>
    </div>
  );
};

export default Index;
