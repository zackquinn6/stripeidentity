const PoweredByFooter = () => {
  return (
    <footer className="w-full py-6 mt-auto border-t border-border bg-background">
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
        <span>Powered by</span>
        <a 
          href="https://booqable.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-muted-foreground transition-colors font-medium"
        >
          Booqable
        </a>
      </div>
    </footer>
  );
};

export default PoweredByFooter;
