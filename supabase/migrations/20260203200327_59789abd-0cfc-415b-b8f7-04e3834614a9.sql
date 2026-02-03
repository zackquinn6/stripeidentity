-- Create pricing comparisons table
CREATE TABLE public.pricing_comparisons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_item_id uuid NOT NULL REFERENCES public.section_items(id) ON DELETE CASCADE,
  comparison_level text NOT NULL CHECK (comparison_level IN ('exact', 'professional', 'diy', 'used')),
  model_name text NOT NULL,
  retailer text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_comparisons ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view pricing comparisons"
  ON public.pricing_comparisons
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage pricing comparisons"
  ON public.pricing_comparisons
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_pricing_comparisons_updated_at
  BEFORE UPDATE ON public.pricing_comparisons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient lookups
CREATE INDEX idx_pricing_comparisons_item ON public.pricing_comparisons(section_item_id);

-- Add average_price column to section_items to store calculated average
ALTER TABLE public.section_items 
ADD COLUMN average_market_price numeric DEFAULT 0;

-- Remove old retailer URL columns (replacing with new system)
ALTER TABLE public.section_items 
DROP COLUMN IF EXISTS amazon_url,
DROP COLUMN IF EXISTS home_depot_url;