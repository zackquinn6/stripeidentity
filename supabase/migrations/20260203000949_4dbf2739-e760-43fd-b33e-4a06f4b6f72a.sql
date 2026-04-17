-- Add retailer link columns to section_items
ALTER TABLE public.section_items 
ADD COLUMN amazon_url text,
ADD COLUMN home_depot_url text;