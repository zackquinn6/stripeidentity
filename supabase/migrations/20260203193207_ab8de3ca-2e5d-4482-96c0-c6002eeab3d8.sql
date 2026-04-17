-- Add column to track if item is a sales product (vs rental)
ALTER TABLE public.section_items
ADD COLUMN is_sales_item boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.section_items.is_sales_item IS 'True if this is a one-time purchase item (consumable), false if it is a rental';