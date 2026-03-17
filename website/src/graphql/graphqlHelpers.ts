// Typed GraphQL Helper Functions (Amplify v6)
// ================================
// These wrappers around Amplify v6's generateClient().graphql() provide proper TypeScript typing
// by distinguishing between queries/mutations (which return Promises) and subscriptions
// (which return Observables). This eliminates the need for `as any` or `as Promise<any>`
// casts throughout the codebase.
//
// Usage:
//   import { graphqlQuery, graphqlMutate, graphqlSubscribe } from '../graphql/graphqlHelpers';
//
//   // Queries
//   const cars = await graphqlQuery<{ listCars: Car[] }>(listCars, { online: true });
//
//   // Mutations
//   await graphqlMutate(deleteFleets, { fleetIds });
//
//   // Subscriptions
//   const sub = graphqlSubscribe(onUpdatedCarsInfo).subscribe({
//     next: (event) => console.log(event.value.data),
//     error: (err) => console.error(err),
//   });

import { generateClient, type GraphQLResult } from 'aws-amplify/api';

const client = generateClient();

/**
 * Execute a GraphQL query using the v6 client.
 * Returns the full response data object.
 *
 * @example
 * const response = await graphqlQuery<{ listCars: Car[] }>(listCars, { online: true });
 * const cars = response.listCars;
 */
export async function graphqlQuery<T = any>(
    query: string,
    variables?: Record<string, any>
): Promise<T> {
    const result = (await client.graphql({ query, variables } as any)) as GraphQLResult<T>;
    return result.data as T;
}

/**
 * Execute a GraphQL mutation using the v6 client.
 * Returns the full response data object.
 *
 * @example
 * const response = await graphqlMutate<{ deleteFleets: string[] }>(deleteFleets, { fleetIds });
 */
export async function graphqlMutate<T = any>(
    query: string,
    variables?: Record<string, any>,
    options?: { authMode?: string }
): Promise<T> {
    const params: any = { query, variables };
    if (options?.authMode) {
        params.authMode = options.authMode;
    }
    const result = (await client.graphql(params)) as GraphQLResult<T>;
    return result.data as T;
}

/** Subscription event shape — kept compatible with v5 consumers using event.value.data */
export interface GraphQLSubscriptionEvent<T> {
    value: {
        data: T;
    };
}

/** Subscription observable returned by graphqlSubscribe */
export interface GraphQLSubscription<T> {
    subscribe(handlers: {
        next: (event: GraphQLSubscriptionEvent<T>) => void;
        error?: (error: any) => void;
    }): { unsubscribe: () => void };
}

/**
 * Create a GraphQL subscription with proper typing.
 * Returns a typed observable that can be subscribed to.
 *
 * In Amplify v6, subscriptions deliver { data } directly.
 * We wrap this to maintain the v5-compatible { value: { data } } shape
 * so all existing consumers continue to work unchanged.
 *
 * @example
 * const sub = graphqlSubscribe<{ onUpdatedCarsInfo: Car[] }>(onUpdatedCarsInfo).subscribe({
 *   next: (event) => {
 *     const cars = event.value.data.onUpdatedCarsInfo;
 *   },
 *   error: (err) => console.error(err),
 * });
 * // Later: sub.unsubscribe();
 */
export function graphqlSubscribe<T = any>(
    subscription: string,
    variables?: Record<string, any>
): GraphQLSubscription<T> {
    const observable = client.graphql({ query: subscription, variables } as any) as any;

    return {
        subscribe(handlers: {
            next: (event: GraphQLSubscriptionEvent<T>) => void;
            error?: (error: any) => void;
        }) {
            const sub = observable.subscribe({
                next: (event: any) => {
                    // v6 delivers { data } directly; wrap to v5-compatible { value: { data } }
                    const data = event?.data ?? event?.value?.data;
                    handlers.next({ value: { data } });
                },
                error: handlers.error,
            });
            return { unsubscribe: () => sub.unsubscribe() };
        },
    };
}
