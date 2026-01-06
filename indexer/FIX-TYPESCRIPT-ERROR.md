# Fix for TypeScript Compilation Error

## Error
```
error TS2561: Object literal may only specify known properties, but 'topFungibleAccounts' does not exist in type 'QueryResolvers<ResolverContext, {}>'.
```

## Cause
The GraphQL schema was updated with a new `topFungibleAccounts` query, but the TypeScript types haven't been regenerated yet.

## Solution

Run the GraphQL code generator to regenerate types:

```bash
cd /home/user/indexer-kadena/indexer

# Make sure dependencies are installed
npm install

# Regenerate GraphQL TypeScript types
npm run graphql:generate-types
```

This will update `src/kadena-server/config/graphql-types.ts` with the new `topFungibleAccounts` resolver type.

## Alternative: Manual Fix

If codegen fails, you can manually add the type to `graphql-types.ts`, but regenerating is preferred to keep types in sync with schema.
