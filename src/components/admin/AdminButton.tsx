import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminPanel from './AdminPanel';

export default function AdminButton() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsPanelOpen(true)}
        variant="default"
        size="icon"
        className="fixed top-4 right-4 z-[9999] rounded-full shadow-xl h-12 w-12 bg-primary hover:bg-primary/90"
        title="Admin Panel"
      >
        <Settings className="h-6 w-6" />
      </Button>
      
      <AdminPanel 
        open={isPanelOpen} 
        onClose={() => setIsPanelOpen(false)} 
        onSignOut={() => setIsPanelOpen(false)} 
      />
    </>
  );
}
