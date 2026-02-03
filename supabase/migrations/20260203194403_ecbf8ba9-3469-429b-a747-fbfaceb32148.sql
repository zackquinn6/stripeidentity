-- Add selection_guidance column to ordering_sections for add-on sections
ALTER TABLE public.ordering_sections
ADD COLUMN selection_guidance text;

COMMENT ON COLUMN public.ordering_sections.selection_guidance IS 'Guidance text shown to users to help them select items in this section (primarily for add-ons)';