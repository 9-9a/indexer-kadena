import { ResolverContext } from '../../config/apollo-server-config';
import { QueryResolvers, RichlistConnection } from '../../config/graphql-types';

export const richlistQueryResolver: QueryResolvers<ResolverContext>['richlist'] = async (
  _parent,
  args,
  context,
): Promise<RichlistConnection> => {
  const { fungibleName, chainId, after, before, first, last } = args;

  const output = await context.balanceRepository.getRichlist({
    fungibleName: fungibleName ?? 'coin',
    chainId: chainId ?? null,
    after: after ?? null,
    before: before ?? null,
    first: first ?? 10,
    last: last ?? null,
  });

  return output;
};
