/**
 * GraphQL resolver for the 'topFungibleAccounts' query
 *
 * This file implements the resolver for the 'topFungibleAccounts' query in the GraphQL schema,
 * which allows clients to retrieve a paginated list of accounts sorted by their total balance
 * for a specific fungible token (e.g., 'coin').
 */

import { ResolverContext } from '../../config/apollo-server-config';
import { QueryResolvers } from '../../config/graphql-types';
import { buildFungibleAccount } from '../output/build-fungible-account-output';

/**
 * Resolver function for the 'topFungibleAccounts' query
 *
 * This resolver handles requests for the top fungible accounts sorted by total balance.
 * It supports pagination using cursor-based navigation and allows sorting by balance
 * in ascending or descending order.
 *
 * @param _parent - Parent resolver object (unused in this root resolver)
 * @param args - GraphQL query arguments containing pagination and sorting parameters
 * @param context - Resolver context containing repository implementations
 * @returns Promise resolving to a paginated connection of FungibleAccount objects
 */
export const topFungibleAccountsQueryResolver: QueryResolvers<ResolverContext>['topFungibleAccounts'] =
  async (_parent, args, context) => {
    const { after, before, first, last, fungibleName, orderBy } = args;

    const result = await context.balanceRepository.getTopFungibleAccounts({
      after,
      before,
      first,
      last,
      fungibleName,
      orderBy: orderBy || 'TOTAL_BALANCE_DESC',
    });

    return {
      edges: result.edges.map(edge => ({
        cursor: edge.cursor,
        node: buildFungibleAccount(edge.node),
      })),
      pageInfo: result.pageInfo,
      totalCount: result.totalCount,
    };
  };
