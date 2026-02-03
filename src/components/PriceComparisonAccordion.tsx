import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, DollarSign, Store } from 'lucide-react';

interface PricingComparison {
  id: string;
  comparison_level: string;
  model_name: string;
  retailer: string;
  price: number;
}

interface TierSummary {
  level: string;
  label: string;
  average: number;
  count: number;
}

interface PriceComparisonAccordionProps {
  itemId: string;
  itemName: string;
  rentalDailyRate: number;
  rentalFirstDayRate: number;
}

const levelLabels: Record<string, string> = {
  exact: 'Exact Match',
  professional: 'Professional Grade',
  diy: 'DIY / Homeowner',
  used: 'Used Market',
};

const levelColors: Record<string, string> = {
  exact: 'bg-primary text-primary-foreground',
  professional: 'bg-blue-500 text-white',
  diy: 'bg-green-500 text-white',
  used: 'bg-amber-500 text-white',
};

const PriceComparisonAccordion = ({ 
  itemId, 
  itemName,
  rentalDailyRate,
  rentalFirstDayRate 
}: PriceComparisonAccordionProps) => {
  const [comparisons, setComparisons] = useState<PricingComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierSummaries, setTierSummaries] = useState<TierSummary[]>([]);

  useEffect(() => {
    const fetchComparisons = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('pricing_comparisons')
        .select('*')
        .eq('section_item_id', itemId)
        .order('comparison_level');

      if (error) {
        console.error('Error fetching pricing comparisons:', error);
        setLoading(false);
        return;
      }

      setComparisons(data || []);

      // Calculate tier summaries
      const tiers: Record<string, { total: number; count: number }> = {};
      for (const comp of data || []) {
        if (!tiers[comp.comparison_level]) {
          tiers[comp.comparison_level] = { total: 0, count: 0 };
        }
        tiers[comp.comparison_level].total += Number(comp.price);
        tiers[comp.comparison_level].count += 1;
      }

      const summaries: TierSummary[] = Object.entries(tiers).map(([level, data]) => ({
        level,
        label: levelLabels[level] || level,
        average: data.count > 0 ? data.total / data.count : 0,
        count: data.count,
      }));

      // Sort by level order
      const order = ['exact', 'professional', 'diy', 'used'];
      summaries.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
      
      setTierSummaries(summaries);
      setLoading(false);
    };

    if (itemId) {
      fetchComparisons();
    }
  }, [itemId]);

  if (loading) {
    return null; // Don't show accordion while loading
  }

  if (comparisons.length === 0) {
    return null; // No pricing data available
  }

  // Find the DIY average for comparison (most relevant for rental customers)
  const diyTier = tierSummaries.find(t => t.level === 'diy');
  const comparisonPrice = diyTier?.average || tierSummaries[0]?.average || 0;
  
  // Calculate rental savings (assuming 3-day rental as typical use case)
  const typicalRentalCost = rentalFirstDayRate + (rentalDailyRate * 2);
  const savings = comparisonPrice - typicalRentalCost;
  const savingsPercent = comparisonPrice > 0 ? Math.round((savings / comparisonPrice) * 100) : 0;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="price-comparison" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-green-500" />
            <span className="font-semibold text-sm">Price Comparison</span>
            {savings > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                Save up to ${savings.toFixed(0)} ({savingsPercent}%)
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          {/* Tier Summaries */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {tierSummaries.map((tier) => (
              <div 
                key={tier.level}
                className="bg-secondary/50 rounded-lg p-3 text-center"
              >
                <Badge className={`${levelColors[tier.level]} text-xs mb-1`}>
                  {tier.label}
                </Badge>
                <p className="text-lg font-bold">${tier.average.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">avg of {tier.count} models</p>
              </div>
            ))}
          </div>

          {/* Rental Value Proposition */}
          <div className="bg-primary/10 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Rental vs. Buying</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A typical 3-day rental costs <strong className="text-foreground">${typicalRentalCost.toFixed(2)}</strong> compared to 
              buying a DIY-grade tool for <strong className="text-foreground">${(diyTier?.average || comparisonPrice).toFixed(0)}</strong>.
              {savings > 0 && (
                <span className="text-primary font-medium"> You save ${savings.toFixed(0)} by renting!</span>
              )}
            </p>
          </div>

          {/* Detailed Comparison Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Level</TableHead>
                  <TableHead className="text-xs">Model</TableHead>
                  <TableHead className="text-xs">Retailer</TableHead>
                  <TableHead className="text-xs text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisons.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell className="py-2">
                      <Badge className={`${levelColors[comp.comparison_level]} text-xs`}>
                        {comp.comparison_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs max-w-[150px] truncate" title={comp.model_name}>
                      {comp.model_name}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Store className="w-3 h-3 text-muted-foreground" />
                        {comp.retailer}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium">
                      ${Number(comp.price).toFixed(0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            Prices are estimates based on current market research. Actual prices may vary.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default PriceComparisonAccordion;
