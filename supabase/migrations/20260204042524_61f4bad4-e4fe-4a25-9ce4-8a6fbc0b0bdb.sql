-- Create a new table for per-tile-size scaling configurations
CREATE TABLE public.item_scaling_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_item_id UUID NOT NULL REFERENCES public.section_items(id) ON DELETE CASCADE,
  tile_size TEXT NOT NULL CHECK (tile_size IN ('small', 'medium', 'large', 'extra-large')),
  units_per_100_sqft NUMERIC(10,2) NOT NULL DEFAULT 0,
  guidance TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(section_item_id, tile_size)
);

-- Enable RLS
ALTER TABLE public.item_scaling_configs ENABLE ROW LEVEL SECURITY;

-- Public read access (for ordering flow)
CREATE POLICY "Public can read scaling configs"
ON public.item_scaling_configs
FOR SELECT
USING (true);

-- Admin write access (admins can manage scaling configs)
CREATE POLICY "Admins can manage scaling configs"
ON public.item_scaling_configs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_item_scaling_configs_updated_at
BEFORE UPDATE ON public.item_scaling_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();