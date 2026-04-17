-- Create app_options table for storing app-wide settings
CREATE TABLE public.app_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_options ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read app options (needed for the checkout display)
CREATE POLICY "Anyone can read app options"
ON public.app_options
FOR SELECT
USING (true);

-- Only admins can modify app options
CREATE POLICY "Admins can modify app options"
ON public.app_options
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Insert default option for delivery visibility
INSERT INTO public.app_options (key, value)
VALUES ('checkout_settings', '{"show_delivery_pickup": true}'::jsonb);

-- Add trigger for updated_at
CREATE TRIGGER update_app_options_updated_at
BEFORE UPDATE ON public.app_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();