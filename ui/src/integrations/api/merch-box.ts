import { apiClient } from '@/utils/orpc';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useMerchBoxRequest() {
  return useMutation({
    mutationFn: async ({
      items,
      notes,
    }: {
      items: Array<{ article: string; qty: number; cost: number }>;
      notes?: string | null;
    }) => {
      return await apiClient.submitMerchBoxRequest({ items, notes: notes ?? null });
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

export function useMerchBoxRequests(options: {
  limit?: number;
  offset?: number;
  reviewed?: boolean;
} = {}) {
  return useQuery({
    queryKey: ['merch-box-requests', options],
    queryFn: async () => {
      return await apiClient.getMerchBoxRequests({
        limit: options.limit ?? 50,
        offset: options.offset ?? 0,
        reviewed: options.reviewed,
      });
    },
  });
}

export function useMarkMerchBoxRequestReviewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return await apiClient.markMerchBoxRequestReviewed({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merch-box-requests'] });
    },
  });
}
