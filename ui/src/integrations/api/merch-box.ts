import { apiClient } from '@/utils/orpc';
import { useMutation, useQuery } from '@tanstack/react-query';

export function useMerchBoxRequest() {
  return useMutation({
    mutationFn: async ({ orderDetails }: { orderDetails: string }) => {
      return await apiClient.submitMerchBoxRequest({ orderDetails });
    },
  });
}

export function useVanguardSbtCheck(nearAccountId: string | null) {
  return useQuery({
    queryKey: ['vanguard-sbt-check', nearAccountId],
    queryFn: async () => {
      return await apiClient.checkVanguardSbt({ nearAccountId: nearAccountId! });
    },
    enabled: Boolean(nearAccountId),
    staleTime: 60_000,
  });
}
