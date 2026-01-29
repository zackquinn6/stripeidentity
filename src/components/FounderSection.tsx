const FounderSection = () => {
  return (
    <section id="about" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6 max-w-3xl">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
          Who We Are & How It Works
        </h2>
        
        {/* Founder Message */}
        <div className="bg-card rounded-2xl p-8 shadow-sm border border-border mb-12">
          <blockquote className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
            "I lived the frustration of DIY—endless trips to the hardware store, renting tools I didn't know I needed, 
            returning ones I forgot to use. I decided to make a better way."
          </blockquote>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">ZQ</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">Zack Quinn</p>
              <p className="text-sm text-muted-foreground">Founder, Toolio</p>
            </div>
          </div>
        </div>

        {/* How It Works - Concise */}
        <div className="space-y-6">
          <h3 className="font-display text-xl font-semibold text-foreground text-center mb-6">
            Project-Based Tool Rental, Simplified
          </h3>
          
          <p className="text-muted-foreground text-center leading-relaxed">
            We bundle the right tools for your project—tile flooring, painting, landscaping—so you get everything 
            you need in one package. Customize to skip what you own, pick your timeline, and we deliver. 
            No guesswork. No multiple trips. Just results.
          </p>
        </div>
      </div>
    </section>
  );
};

export default FounderSection;
