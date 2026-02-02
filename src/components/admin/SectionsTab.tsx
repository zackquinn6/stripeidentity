import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDragReorder } from '@/hooks/useDragReorder';

interface Section {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  description: string | null;
  section_type: string;
  is_visible: boolean;
  display_order: number;
}

interface SectionsTabProps {
  projectId: string | null;
  projectName: string | null;
  onSelectSection: (id: string, name: string) => void;
  selectedSectionId: string | null;
}

const SECTION_TYPES = ['equipment', 'addon', 'consumable'];

export default function SectionsTab({ projectId, projectName, onSelectSection, selectedSectionId }: SectionsTabProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    section_type: 'equipment',
    is_visible: true
  });

  const handleReorder = async (reorderedSections: Section[]) => {
    setSections(reorderedSections);
    
    const updates = reorderedSections.map((section, index) => 
      supabase
        .from('ordering_sections')
        .update({ display_order: index })
        .eq('id', section.id)
    );
    
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);
    
    if (hasError) {
      toast.error('Failed to save order');
      fetchSections();
    }
  };

  const {
    draggedIndex,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useDragReorder(sections, handleReorder);

  useEffect(() => {
    if (projectId) {
      fetchSections();
    } else {
      setSections([]);
    }
  }, [projectId]);

  const fetchSections = async () => {
    if (!projectId) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('ordering_sections')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order');
    
    if (error) {
      toast.error('Failed to load sections');
      console.error(error);
    } else {
      setSections(data || []);
    }
    setIsLoading(false);
  };

  const handleOpenDialog = (e: React.MouseEvent, section?: Section) => {
    e.preventDefault();
    e.stopPropagation();
    if (section) {
      setEditingSection(section);
      setFormData({
        name: section.name,
        slug: section.slug,
        description: section.description || '',
        section_type: section.section_type,
        is_visible: section.is_visible
      });
    } else {
      setEditingSection(null);
      setFormData({ name: '', slug: '', description: '', section_type: 'equipment', is_visible: true });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!projectId || !formData.name || !formData.slug) {
      toast.error('Name and slug are required');
      return;
    }

    if (editingSection) {
      const { error } = await supabase
        .from('ordering_sections')
        .update({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          section_type: formData.section_type,
          is_visible: formData.is_visible
        })
        .eq('id', editingSection.id);

      if (error) {
        toast.error('Failed to update section');
        console.error(error);
      } else {
        toast.success('Section updated');
        fetchSections();
        setIsDialogOpen(false);
      }
    } else {
      const { error } = await supabase
        .from('ordering_sections')
        .insert({
          project_id: projectId,
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          section_type: formData.section_type,
          is_visible: formData.is_visible,
          display_order: sections.length
        });

      if (error) {
        toast.error('Failed to create section');
        console.error(error);
      } else {
        toast.success('Section created');
        fetchSections();
        setIsDialogOpen(false);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this section and all its items?')) return;
    
    const { error } = await supabase.from('ordering_sections').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete section');
    } else {
      toast.success('Section deleted');
      fetchSections();
    }
  };

  const handleToggleVisible = async (e: React.MouseEvent, section: Section) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { error } = await supabase
      .from('ordering_sections')
      .update({ is_visible: !section.is_visible })
      .eq('id', section.id);

    if (error) {
      toast.error('Failed to update section');
    } else {
      fetchSections();
    }
  };

  if (!projectId) {
    return (
      <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
        <AlertCircle className="h-8 w-8" />
        <p>Select a project first to manage its sections</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {projectName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
          <span className="font-medium text-foreground">Project:</span>
          <span>{projectName}</span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Manage ordering sections (Equipment, Add-ons, etc.)</p>
        <Button size="sm" onClick={(e) => handleOpenDialog(e)}>
          <Plus className="h-4 w-4 mr-1" /> Add Section
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="z-[10000]">
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Edit Section' : 'New Section'}</DialogTitle>
            <DialogDescription>
              {editingSection ? 'Update the section details below.' : 'Create a new ordering section.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Safety Equipment"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="safety"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Essential safety gear..."
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.section_type} onValueChange={(v) => setFormData({ ...formData, section_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10001]">
                  {SECTION_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_visible}
                onCheckedChange={(v) => setFormData({ ...formData, is_visible: v })}
              />
              <Label>Visible to users</Label>
            </div>
            <Button onClick={handleSave} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {sections.map((section, index) => (
          <Card 
            key={section.id} 
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`cursor-pointer transition-all ${
              selectedSectionId === section.id ? 'border-primary' : ''
            } ${
              draggedIndex === index ? 'opacity-50' : ''
            } ${
              dragOverIndex === index && draggedIndex !== index ? 'border-t-2 border-t-primary' : ''
            }`}
            onClick={() => onSelectSection(section.id, section.name)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                <div>
                  <p className="font-medium">{section.name}</p>
                  <p className="text-sm text-muted-foreground">{section.section_type} • {section.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={section.is_visible}
                  onCheckedChange={() => {}}
                  onClick={(e) => handleToggleVisible(e, section)}
                />
                <Button variant="ghost" size="icon" onClick={(e) => handleOpenDialog(e, section)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, section.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {sections.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">No sections yet. Create your first one!</p>
        )}
      </div>
    </div>
  );
}
