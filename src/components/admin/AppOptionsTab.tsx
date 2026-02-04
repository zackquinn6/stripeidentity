import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CheckoutSettings {
  show_delivery_pickup: boolean;
}

export default function AppOptionsTab() {
  const queryClient = useQueryClient();

  const { data: checkoutSettings, isLoading } = useQuery({
    queryKey: ['app-options', 'checkout_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_options')
        .select('value')
        .eq('key', 'checkout_settings')
        .single();
      
      if (error) throw error;
      return data.value as unknown as CheckoutSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<CheckoutSettings>) => {
      const merged = { ...checkoutSettings, ...newSettings };
      const { error } = await supabase
        .from('app_options')
        .update({ value: merged })
        .eq('key', 'checkout_settings');
      
      if (error) throw error;
      return merged;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-options', 'checkout_settings'] });
      toast.success('Settings updated');
    },
    onError: () => {
      toast.error('Failed to update settings');
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-4">Checkout Options</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="show-delivery">Show Delivery & Pickup</Label>
              <p className="text-sm text-muted-foreground">
                Display the "Delivery & Pickup: Free" section in the checkout summary
              </p>
            </div>
            <Switch
              id="show-delivery"
              checked={checkoutSettings?.show_delivery_pickup ?? true}
              onCheckedChange={(checked) => 
                updateSettings.mutate({ show_delivery_pickup: checked })
              }
              disabled={updateSettings.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
