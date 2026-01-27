import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, Shield, Clock, Truck, DollarSign } from 'lucide-react';

interface PackageValueCardProps {
  retailValue: number;
  packagePrice: number;
}

const PackageValueCard = ({ retailValue, packagePrice }: PackageValueCardProps) => {
  const savingsPercent = Math.round(((retailValue - packagePrice) / retailValue) * 100);
  
  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-elevated overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left side - Package info */}
          <div className="space-y-1">
            <Badge variant="secondary" className="mb-2 bg-primary/20 text-primary border-0">
              Complete Package
            </Badge>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Tile Flooring Package
            </h2>
            <p className="text-muted-foreground">
              Everything you need for a professional tile installation
            </p>
          </div>
          
          {/* Right side - Pricing */}
          <div className="flex flex-col items-start md:items-end gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground line-through">
                Retail: ${retailValue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl md:text-4xl font-bold text-primary">
                ${packagePrice}
              </span>
              <span className="text-muted-foreground">/rental</span>
            </div>
          </div>
        </div>

        {/* Value metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-primary/10">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="font-bold text-lg text-success">{savingsPercent}%</p>
              <p className="text-xs text-muted-foreground">Savings vs Buying</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg text-foreground">80%</p>
              <p className="text-xs text-muted-foreground">Fewer Mistakes</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Clock className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-bold text-lg text-foreground">10–15 hrs</p>
              <p className="text-xs text-muted-foreground">Time Saved</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Truck className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="font-bold text-lg text-foreground">Free</p>
              <p className="text-xs text-muted-foreground">Delivery</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PackageValueCard;
