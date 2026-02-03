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
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null);
  const [selectedSectionType, setSelectedSectionType] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Admin Panel</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="projects" className="mt-6 flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <ProjectsTab 
              onSelectProject={(id, name) => {
                setSelectedProjectId(id);
                setSelectedProjectName(name);
                setSelectedSectionId(null);
                setSelectedSectionName(null);
                setSelectedSectionType(null);
              }}
              selectedProjectId={selectedProjectId}
            />
          </TabsContent>

          <TabsContent value="sections" className="mt-4">
            <SectionsTab
              projectId={selectedProjectId}
              projectName={selectedProjectName}
              onSelectSection={(id, name, type) => {
                setSelectedSectionId(id);
                setSelectedSectionName(name);
                setSelectedSectionType(type);
              }}
              selectedSectionId={selectedSectionId}
            />
          </TabsContent>

          <TabsContent value="items" className="mt-4">
            <ItemsTab 
              sectionId={selectedSectionId}
              projectName={selectedProjectName}
              sectionName={selectedSectionName}
              sectionType={selectedSectionType || undefined}
            />
          </TabsContent>
        </Tabs>

        <div className="pt-4 mt-auto border-t">
          <Button variant="outline" className="w-full" onClick={onSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
