import { Component, type ReactNode } from 'react';

import { pl } from '@/shared/i18n/pl';
import { ErrorState } from '@/shared/ui';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

/** Last line of defence: a Polish fallback. Nothing is logged because errors may carry financial data. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <ErrorState
          title={pl.errors.boundaryTitle}
          message={pl.errors.boundaryMessage}
          onRetry={() => this.setState({ failed: false })}
        />
      );
    }
    return this.props.children;
  }
}
