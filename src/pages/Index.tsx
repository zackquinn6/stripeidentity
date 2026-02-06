import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
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
      
      {/* Admin login button - bottom left */}
      <Link
        to="/auth"
        className="fixed bottom-4 left-4 text-muted-foreground/50 hover:text-muted-foreground text-xs"
      >
        <Button
          variant="ghost"
          size="sm"
        >
          <LogIn className="w-3 h-3 mr-1" />
          Admin
        </Button>
      </Link>

      {/* Test button - bottom right */}
      <Link
        to="/test"
        className="fixed bottom-4 right-4 z-[10000] pointer-events-auto"
        style={{ 
          position: 'fixed', 
          bottom: '1rem', 
          right: '1rem', 
          zIndex: 10000,
          display: 'inline-block'
        }}
        onClick={(e) => {
          console.log('[Index] Test link clicked');
        }}
      >
        <Button
          variant="default"
          size="sm"
          className="pointer-events-auto"
        >
          Test
        </Button>
      </Link>
    </div>
  );
};

export default Index;
