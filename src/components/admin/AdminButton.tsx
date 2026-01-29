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
        className="fixed bottom-6 right-6 z-[9999] rounded-full shadow-xl h-14 w-14 bg-primary hover:bg-primary/90"
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
