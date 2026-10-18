import { useRouter } from 'expo-router';

type FallbackRoute = '/dashboard' | '/customers' | '/users' | '/';

/** Goes back when there is history (in-app navigation), otherwise to a known route (deep link, web reload). */
export function useGoBack(fallback: FallbackRoute): () => void {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  };
}
