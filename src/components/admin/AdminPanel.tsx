import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import ProjectsTab from './ProjectsTab';
import SectionsTab from './SectionsTab';
import ItemsTab from './ItemsTab';

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export default function AdminPanel({ open, onClose, onSignOut }: AdminPanelProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle className="font-display text-xl">Admin Panel</SheetTitle>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </SheetHeader>

        <Tabs defaultValue="projects" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <ProjectsTab 
              onSelectProject={(id) => {
                setSelectedProjectId(id);
                setSelectedSectionId(null);
              }}
              selectedProjectId={selectedProjectId}
            />
          </TabsContent>

          <TabsContent value="sections" className="mt-4">
            <SectionsTab
              projectId={selectedProjectId}
              onSelectSection={setSelectedSectionId}
              selectedSectionId={selectedSectionId}
            />
          </TabsContent>

          <TabsContent value="items" className="mt-4">
            <ItemsTab sectionId={selectedSectionId} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
