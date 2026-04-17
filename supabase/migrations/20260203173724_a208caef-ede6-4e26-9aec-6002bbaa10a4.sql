-- Add selection_guidance column to section_items
ALTER TABLE public.section_items 
ADD COLUMN selection_guidance text;