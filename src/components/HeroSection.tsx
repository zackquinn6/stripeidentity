import { Button } from '@/components/ui/button';
import { Wrench, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onOrderClick: () => void;
}

const HeroSection = ({ onOrderClick }: HeroSectionProps) => {
  return (
    <section className="hero-gradient min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-64 h-64 border border-white/20 rounded-full" />
        <div className="absolute bottom-32 right-32 w-96 h-96 border border-white/10 rounded-full" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 border border-white/15 rounded-full" />
      </div>

      <div className="container mx-auto px-6 text-center relative z-10">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8">
            <Wrench className="w-5 h-5 text-primary" />
            <span className="text-white/80 text-sm font-medium">Project-Based Tool Rentals</span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Don't Just Rent Tools,
            <br />
            <span className="text-primary">Enable Your Project</span>
          </h1>

          <p className="text-white/70 text-xl md:text-2xl max-w-2xl mx-auto mb-12">
            Get everything you need for your next DIY project in one package. 
            No guesswork, no multiple trips—just results.
          </p>

          <Button 
            variant="hero" 
            size="xl" 
            onClick={onOrderClick}
            className="group"
          >
            Order Today
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-white/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
