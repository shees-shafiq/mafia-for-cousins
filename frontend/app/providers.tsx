'use client';

import { SocketProvider } from '@/context/SocketContext';

/**
 * Client-boundary wrapper for all providers.
 * This pattern lets layout.tsx remain a Server Component while
 * still wrapping children in React context.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SocketProvider>{children}</SocketProvider>;
}
