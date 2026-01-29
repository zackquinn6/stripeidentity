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
        className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg h-12 w-12"
        title="Admin Panel"
      >
        <Settings className="h-5 w-5" />
      </Button>
      
      <AdminPanel 
        open={isPanelOpen} 
        onClose={() => setIsPanelOpen(false)} 
        onSignOut={() => setIsPanelOpen(false)} 
      />
    </>
  );
}
