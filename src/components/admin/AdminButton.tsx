import { useState } from 'react';
import { Settings, LogOut, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AdminPanel from './AdminPanel';

export default function AdminButton() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleClick = () => {
    if (!user) {
      navigate('/auth');
    } else if (isAdmin) {
      setIsPanelOpen(true);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setIsPanelOpen(false);
  };

  if (!user) {
    return (
      <Button
        onClick={handleClick}
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg h-12 w-12"
        title="Sign In"
      >
        <LogIn className="h-5 w-5" />
      </Button>
    );
  }

  if (!isAdmin) {
    return (
      <Button
        onClick={handleSignOut}
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg h-12 w-12"
        title="Sign Out"
      >
        <LogOut className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleClick}
        variant="default"
        size="icon"
        className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg h-12 w-12"
        title="Admin Panel"
      >
        <Settings className="h-5 w-5" />
      </Button>
      
      <AdminPanel open={isPanelOpen} onClose={() => setIsPanelOpen(false)} onSignOut={handleSignOut} />
    </>
  );
}
