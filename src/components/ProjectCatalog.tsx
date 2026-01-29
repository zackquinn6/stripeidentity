import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Paintbrush, TreeDeciduous, Hammer, Grid3X3, Wrench, Zap, Droplets, Home } from 'lucide-react';
import { useProjects, Project } from '@/hooks/useProjects';

interface ProjectCatalogProps {
  onProjectSelect: (projectId: string) => void;
}

const getIcon = (iconType: string) => {
  const iconClass = "w-12 h-12";
  switch (iconType) {
    case 'tile':
      return <Grid3X3 className={iconClass} />;
    case 'paint':
      return <Paintbrush className={iconClass} />;
    case 'landscape':
      return <TreeDeciduous className={iconClass} />;
    case 'carpentry':
      return <Hammer className={iconClass} />;
    case 'plumbing':
      return <Droplets className={iconClass} />;
    case 'electrical':
      return <Zap className={iconClass} />;
    case 'general':
      return <Wrench className={iconClass} />;
    case 'home':
      return <Home className={iconClass} />;
    default:
      return <Grid3X3 className={iconClass} />;
  }
};

const ProjectCatalog = ({ onProjectSelect }: ProjectCatalogProps) => {
  const { data: projects, isLoading, error } = useProjects();

  return (
    <section id="catalog" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Choose Your Project
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Select a project type to get a curated toolkit with everything you need to succeed.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-2 border-transparent">
                <CardContent className="p-8 text-center">
                  <Skeleton className="h-20 w-20 rounded-2xl mx-auto mb-6" />
                  <Skeleton className="h-6 w-32 mx-auto mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-5 w-20 mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-muted-foreground">
            Failed to load projects. Please refresh the page.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {projects?.map((project: Project) => (
              <Card
                key={project.id}
                className={`card-hover cursor-pointer border-2 ${
                  project.is_available 
                    ? 'border-transparent hover:border-primary bg-card' 
                    : 'border-transparent bg-muted opacity-75 cursor-not-allowed'
                }`}
                onClick={() => project.is_available && onProjectSelect(project.slug)}
              >
                <CardContent className="p-8 text-center">
                  <div className={`inline-flex p-4 rounded-2xl mb-6 ${
                    project.is_available ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'
                  }`}>
                    {getIcon(project.icon)}
                  </div>
                  
                  <h3 className="font-display text-xl font-semibold mb-2 text-foreground">
                    {project.name}
                  </h3>
                  
                  <p className="text-muted-foreground text-sm mb-4">
                    {project.description}
                  </p>

                  {project.is_available ? (
                    <Badge className="bg-success text-success-foreground">Available</Badge>
                  ) : (
                    <Badge variant="secondary">Coming Soon</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProjectCatalog;
