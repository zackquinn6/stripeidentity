import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  is_available: boolean;
  display_order: number;
}

interface ProjectsTabProps {
  onSelectProject: (id: string) => void;
  selectedProjectId: string | null;
}

const ICONS = ['tile', 'paint', 'landscape', 'carpentry', 'plumbing', 'electrical', 'general', 'home'];

export default function ProjectsTab({ onSelectProject, selectedProjectId }: ProjectsTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'tile',
    is_available: false
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('display_order');
    
    if (error) {
      toast.error('Failed to load projects');
      console.error(error);
    } else {
      setProjects(data || []);
    }
    setIsLoading(false);
  };

  const handleOpenDialog = (e: React.MouseEvent, project?: Project) => {
    e.preventDefault();
    e.stopPropagation();
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        slug: project.slug,
        description: project.description || '',
        icon: project.icon,
        is_available: project.is_available
      });
    } else {
      setEditingProject(null);
      setFormData({ name: '', slug: '', description: '', icon: 'tile', is_available: false });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!formData.name || !formData.slug) {
      toast.error('Name and slug are required');
      return;
    }

    if (editingProject) {
      const { error } = await supabase
        .from('projects')
        .update({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          icon: formData.icon,
          is_available: formData.is_available
        })
        .eq('id', editingProject.id);

      if (error) {
        toast.error('Failed to update project');
        console.error(error);
      } else {
        toast.success('Project updated');
        fetchProjects();
        setIsDialogOpen(false);
      }
    } else {
      const { error } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          icon: formData.icon,
          is_available: formData.is_available,
          display_order: projects.length
        });

      if (error) {
        toast.error('Failed to create project');
        console.error(error);
      } else {
        toast.success('Project created');
        fetchProjects();
        setIsDialogOpen(false);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this project and all its sections?')) return;
    
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete project');
    } else {
      toast.success('Project deleted');
      fetchProjects();
    }
  };

  const handleToggleAvailable = async (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { error } = await supabase
      .from('projects')
      .update({ is_available: !project.is_available })
      .eq('id', project.id);

    if (error) {
      toast.error('Failed to update project');
    } else {
      fetchProjects();
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Manage project types shown in the catalog</p>
        <Button size="sm" onClick={(e) => handleOpenDialog(e)}>
          <Plus className="h-4 w-4 mr-1" /> Add Project
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="z-[10000]">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'New Project'}</DialogTitle>
            <DialogDescription>
              {editingProject ? 'Update the project details below.' : 'Create a new project type for the catalog.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tile Flooring"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="tile-flooring"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Complete tile installation toolkit..."
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select value={formData.icon} onValueChange={(v) => setFormData({ ...formData, icon: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10001]">
                  {ICONS.map(icon => (
                    <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_available}
                onCheckedChange={(v) => setFormData({ ...formData, is_available: v })}
              />
              <Label>Available to users</Label>
            </div>
            <Button onClick={handleSave} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {projects.map((project) => (
          <Card 
            key={project.id} 
            className={`cursor-pointer transition-colors ${selectedProjectId === project.id ? 'border-primary' : ''}`}
            onClick={() => onSelectProject(project.id)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-sm text-muted-foreground">{project.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={project.is_available}
                  onCheckedChange={() => {}}
                  onClick={(e) => handleToggleAvailable(e, project)}
                />
                <Button variant="ghost" size="icon" onClick={(e) => handleOpenDialog(e, project)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, project.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {projects.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">No projects yet. Create your first one!</p>
        )}
      </div>
    </div>
  );
}
