-- Add scaling configuration columns for consumable items
ALTER TABLE public.section_items
ADD COLUMN scaling_tile_size text DEFAULT NULL,
ADD COLUMN scaling_per_100_sqft numeric DEFAULT NULL,
ADD COLUMN scaling_guidance text DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.section_items.scaling_tile_size IS 'Which tile size this scaling applies to: small, medium, large, all';
COMMENT ON COLUMN public.section_items.scaling_per_100_sqft IS 'Number of units needed per 100 square feet';
COMMENT ON COLUMN public.section_items.scaling_guidance IS 'User-facing explanation of the scaling calculation (e.g., "1 bag per 20 sq ft. Buy 10% extra for waste")';
