import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  is_available: boolean;
  display_order: number;
}

async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('display_order');

  if (error) {
    console.error('[useProjects] Error fetching projects:', error);
    throw error;
  }

  return data || [];
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export default useProjects;
