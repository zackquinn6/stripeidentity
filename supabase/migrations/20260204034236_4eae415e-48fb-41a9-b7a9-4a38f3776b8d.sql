-- Add columns for essentials and comprehensive default quantities
ALTER TABLE public.section_items
ADD COLUMN default_quantity_essentials integer NOT NULL DEFAULT 0,
ADD COLUMN default_quantity_comprehensive integer NOT NULL DEFAULT 0;

-- Migrate existing default_quantity to comprehensive (since "Make it Comprehensive" was the previous behavior)
UPDATE public.section_items 
SET default_quantity_comprehensive = default_quantity
WHERE default_quantity > 0;