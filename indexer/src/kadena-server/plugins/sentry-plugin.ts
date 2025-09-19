import * as Sentry from '@sentry/node';
import { ApolloServerPlugin } from '@apollo/server';
import { ResolverContext } from '../config/apollo-server-config';

/**
 * Creates an Apollo Server plugin for Sentry error reporting
 * This plugin will capture GraphQL errors and send them to Sentry with additional context
 * NOTICE: We are using scope for now because profiles will duplicate entries, and might confuse aws api gateway
 */
export function createSentryPlugin(): ApolloServerPlugin<ResolverContext> {
  return {
    async requestDidStart({ request, contextValue }) {
      // Log incoming queries to Sentry as breadcrumbs (no manual spans or profiler here)
      Sentry.addBreadcrumb({
        category: 'graphql.query',
        message: request.operationName || 'Anonymous GraphQL operation',
        level: 'info',
        data: {
          query: request.query,
          variables: request.variables,
          operationType: request.operationName ? 'named' : 'anonymous',
        },
      });
      return {
        async didEncounterErrors({ errors, operation, operationName, request }) {
          // Skip Apollo-specific errors that are intentionally thrown
          const filteredErrors = errors.filter(
            error =>
              !(
                error.extensions?.code === 'BAD_USER_INPUT' ||
                error.message.includes('Not authenticated')
              ),
          );

          if (filteredErrors.length === 0) return;

          filteredErrors.forEach(error => {
            Sentry.withScope(scope => {
              // Add operation details to the scope
              scope.setTag('graphql.operation.type', operation?.operation || 'unknown');
              scope.setTag('graphql.operation.name', operationName || 'anonymous');

              // Add query and variables as context
              scope.setContext('graphql', {
                query: request.query,
                variables: request.variables,
              });

              if (error.path) {
                scope.addBreadcrumb({
                  category: 'graphql.path',
                  message: error.path.join(' > '),
                  level: 'error',
                });
              }

              Sentry.captureException(error.originalError || error);
            });
          });
        },
      };
    },
  };
}
