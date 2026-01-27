import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Paintbrush, TreeDeciduous, Hammer, Grid3X3 } from 'lucide-react';
import { ProjectType } from '@/types/rental';

interface ProjectCatalogProps {
  onProjectSelect: (projectId: string) => void;
}

const projects: ProjectType[] = [
  {
    id: 'tile-flooring',
    name: 'Tile Flooring',
    description: 'Complete tile installation toolkit with cutting, mixing, and finishing tools.',
    icon: 'tile',
    available: true,
  },
  {
    id: 'painting',
    name: 'Painting',
    description: 'Professional painting equipment for interior and exterior projects.',
    icon: 'paint',
    available: false,
  },
  {
    id: 'landscaping',
    name: 'Landscaping',
    description: 'Outdoor power equipment and hand tools for yard transformations.',
    icon: 'landscape',
    available: false,
  },
  {
    id: 'carpentry',
    name: 'Carpentry',
    description: 'Woodworking tools from basic cuts to detailed finish work.',
    icon: 'carpentry',
    available: false,
  },
];

const getIcon = (iconType: string) => {
  switch (iconType) {
    case 'tile':
      return <Grid3X3 className="w-12 h-12" />;
    case 'paint':
      return <Paintbrush className="w-12 h-12" />;
    case 'landscape':
      return <TreeDeciduous className="w-12 h-12" />;
    case 'carpentry':
      return <Hammer className="w-12 h-12" />;
    default:
      return <Grid3X3 className="w-12 h-12" />;
  }
};

const ProjectCatalog = ({ onProjectSelect }: ProjectCatalogProps) => {
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {projects.map((project) => (
            <Card
              key={project.id}
              className={`card-hover cursor-pointer border-2 ${
                project.available 
                  ? 'border-transparent hover:border-primary bg-card' 
                  : 'border-transparent bg-muted opacity-75 cursor-not-allowed'
              }`}
              onClick={() => project.available && onProjectSelect(project.id)}
            >
              <CardContent className="p-8 text-center">
                <div className={`inline-flex p-4 rounded-2xl mb-6 ${
                  project.available ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'
                }`}>
                  {getIcon(project.icon)}
                </div>
                
                <h3 className="font-display text-xl font-semibold mb-2 text-foreground">
                  {project.name}
                </h3>
                
                <p className="text-muted-foreground text-sm mb-4">
                  {project.description}
                </p>

                {project.available ? (
                  <Badge className="bg-success text-success-foreground">Available</Badge>
                ) : (
                  <Badge variant="secondary">Coming Soon</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProjectCatalog;
