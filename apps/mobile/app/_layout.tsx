import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function NavigationGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavState?.key) return; // wait for navigator to be ready
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)');
  }, [user, isLoading, segments, rootNavState?.key]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationGuard />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="clients/[clientId]"
            options={{ headerShown: true, title: 'Client', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="loans/[loanId]"
            options={{ headerShown: true, title: 'Loan', headerBackTitle: 'Back' }}
          />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
