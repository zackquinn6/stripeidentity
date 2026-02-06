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

  const handleTestClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Index] Test button clicked - attempting navigation');
    try {
      navigate('/test');
      console.log('[Index] Navigation called');
    } catch (error) {
      console.error('[Index] Navigation error:', error);
      // Fallback to direct navigation
      window.location.href = '/test';
    }
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

      {/* Test button - bottom right */}
      <button
        onClick={handleTestClick}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Index] Test button mousedown');
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Index] Test button mouseup');
        }}
        className="fixed bottom-4 right-4 z-[10000] pointer-events-auto bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 rounded-md text-sm font-medium transition-colors"
        style={{ 
          position: 'fixed', 
          bottom: '1rem', 
          right: '1rem', 
          zIndex: 10000,
          pointerEvents: 'auto',
          cursor: 'pointer'
        }}
      >
        Test
      </button>
    </div>
  );
};

export default Index;
