import { Card, CardContent } from '@/components/ui/card';

interface PackageValueCardProps {
  retailValue?: number;
  packagePrice?: number;
}

const PackageValueCard = ({ retailValue = 900, packagePrice = 495 }: PackageValueCardProps) => {
  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-elevated overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-2">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Tile Flooring Package
          </h2>
          <p className="text-muted-foreground max-w-md">
            Everything you need for a professional tile installation — delivered to your door
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PackageValueCard;
