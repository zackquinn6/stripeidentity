const PoweredByFooter = () => {
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-1.5 text-xs text-muted-foreground/50">
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
  );
};

export default PoweredByFooter;
