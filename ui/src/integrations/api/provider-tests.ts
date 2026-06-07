import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/utils/orpc';

type ProviderName = Parameters<typeof apiClient.getProviderTestState>[0]['provider'];
type ProviderTestStep = Parameters<typeof apiClient.runProviderTestStep>[0]['step'];

const providerTestKeys = {
  all: ['provider-test'] as const,
  state: (provider: ProviderName) => [...providerTestKeys.all, 'state', provider] as const,
};

export { providerTestKeys };

export function useProviderTestState(provider: ProviderName) {
  return useQuery({
    queryKey: providerTestKeys.state(provider),
    queryFn: async () => apiClient.getProviderTestState({ provider }),
    enabled: !!provider,
  });
}

export function useSaveProviderTestScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      provider: ProviderName;
      scenario: Record<string, unknown>;
    }) => apiClient.saveProviderTestScenario(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: providerTestKeys.state(variables.provider) });
    },
  });
}

export function useRunProviderTestStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      provider: ProviderName;
      step: ProviderTestStep;
    }) => apiClient.runProviderTestStep(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: providerTestKeys.state(variables.provider) });
    },
  });
}

export type { ProviderName, ProviderTestStep };
