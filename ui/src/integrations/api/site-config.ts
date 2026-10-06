import { apiClient } from "@/utils/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const siteConfigKeys = {
  all: ["site-config"] as const,
};

export type SiteConfig = Awaited<ReturnType<typeof apiClient.getSiteConfig>>;

export function useSiteConfig() {
  return useQuery({
    queryKey: siteConfigKeys.all,
    queryFn: () => apiClient.getSiteConfig(),
    staleTime: 30_000,
  });
}

export function useSetMaintenanceMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { enabled: boolean; message?: string }) =>
      apiClient.setMaintenanceMode(variables),
    onSuccess: (data) => {
      queryClient.setQueryData(siteConfigKeys.all, data);
    },
  });
}
