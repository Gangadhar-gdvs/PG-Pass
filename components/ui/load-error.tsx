import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { EmptyState } from './empty-state';
import { Button } from './button';

/**
 * Standard "couldn't load — here's why, try again" block. Pairs with
 * `useAsyncData`'s `error` + `reload` so every list page fails the same way
 * (a real message + a Retry) instead of silently rendering an empty page.
 *
 *   if (error) return <LoadError message={error} onRetry={reload} />;
 */
export function LoadError({
  message,
  onRetry,
  title = "Couldn't load this page",
}: {
  message?: string | null;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="app-card">
        <EmptyState
          icon3d="alert"
          title={title}
          description={
            message ||
            "We couldn't reach the server. This is usually a temporary connection issue — please check your internet and try again."
          }
          action={
            onRetry ? (
              <Button onClick={onRetry}>
                <RefreshCw className="h-4 w-4" />
                <span>Retry</span>
              </Button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}

/**
 * Restricted-staff state: the listener/API returned 403 because the staff member
 * lacks the permission. Not an outage — don't offer Retry, tell them what to ask for.
 */
export function NoAccess({
  what = 'this section',
  permission,
}: {
  what?: string;
  permission?: string;
}) {
  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="app-card">
        <EmptyState
          icon3d="alert"
          tint="amber"
          title="No access"
          description={`You don't have permission to see ${what}. Ask the PG owner to grant${
            permission ? ` the "${permission}"` : ''
          } access.`}
        />
      </div>
    </div>
  );
}
