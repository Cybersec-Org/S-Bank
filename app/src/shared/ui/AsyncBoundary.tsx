import type { ReactNode } from 'react';

import { describeProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';

import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

interface AsyncBoundaryProps {
  readonly isLoading: boolean;
  readonly error: unknown;
  readonly isEmpty: boolean;
  readonly onRetry: () => void;
  readonly emptyTitle?: string;
  readonly emptyMessage?: string;
  readonly children: ReactNode;
}

/** The loading / error / empty / success switch every data screen shares. */
export function AsyncBoundary({
  isLoading,
  error,
  isEmpty,
  onRetry,
  emptyTitle = pl.common.emptyTitle,
  emptyMessage = pl.common.emptyMessage,
  children,
}: AsyncBoundaryProps) {
  if (isLoading) {
    return <LoadingState />;
  }
  if (error !== null && error !== undefined) {
    return <ErrorState message={describeProblem(error)} onRetry={onRetry} />;
  }
  if (isEmpty) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }
  return <>{children}</>;
}
