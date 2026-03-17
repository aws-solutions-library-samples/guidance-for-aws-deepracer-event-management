import { useEffect } from 'react';
import { graphqlMutate, graphqlSubscribe } from '../graphql/graphqlHelpers';
import * as queries from '../graphql/queries';
import { onUserCreated, onUserUpdated } from '../graphql/subscriptions';
import { useStore } from '../store/store';

// Cognito user attribute structure
interface UserAttribute {
    Name: string;
    Value: string;
}

// Cognito user from API
interface CognitoUser {
    Attributes: UserAttribute[];
    Roles?: string[] | null;
    [key: string]: any;
}

// Enriched user with parsed attributes
interface EnrichedUser {
    Attributes: UserAttribute[];
    Email?: string;
    CountryCode?: string;
    Roles?: string | null;
    [key: string]: any;
}

export const useUsersApi = (userHasAccess: boolean = false): void => {
    const [, dispatch] = useStore();

    function getUserEmail(item: CognitoUser): string | undefined {
        const email = item.Attributes.filter((obj) => {
            return obj.Name === 'email';
        });
        if (email.length > 0) {
            return email[0].Value;
        }
    }

    function getUserCountryCode(item: CognitoUser): string {
        const countryCode = item.Attributes.filter((obj) => {
            return obj.Name === 'custom:countryCode';
        });
        return countryCode.length > 0 ? countryCode[0].Value : '';
    }

    // Convert user roles to a comma delimited string
    function parseRoles(user: CognitoUser): string | null {
        if (!('Roles' in user) || user.Roles == null) return null;
        return user.Roles.join(',');
    }

    // initial data load
    useEffect(() => {
        if (userHasAccess) {
            async function listUsers() {
                dispatch('USERS_IS_LOADING', true);
                const response = await graphqlMutate<{ listUsers: CognitoUser[] }>(
                    queries.listUsers
                );
                const tempUsers = response.listUsers;
                if (tempUsers) {
                    const users: EnrichedUser[] = tempUsers.map((u) => ({
                        ...u,
                        Email: getUserEmail(u),
                        CountryCode: getUserCountryCode(u),
                        Roles: parseRoles(u),
                    }));
                    dispatch('ADD_USERS', users);
                }
                dispatch('USERS_IS_LOADING', false);
            }
            listUsers();
        }
        return () => {
            // Unmounting
        };
    }, [userHasAccess, dispatch]);

    // subscribe to data changes and append them to local array
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            console.debug('register onUserCreated subscription');
            subscription = graphqlSubscribe<{ onUserCreated: CognitoUser }>(
                onUserCreated
            ).subscribe({
                next: (event) => {
                    console.debug('onUserCreated received', event);
                    const user = event.value.data.onUserCreated;
                    if (user) {
                        const enrichedUser: EnrichedUser = {
                            ...user,
                            Email: getUserEmail(user),
                            CountryCode: getUserCountryCode(user),
                            Roles: parseRoles(user),
                        };
                        dispatch('UPDATE_USER', enrichedUser);
                    }
                },
            });
        }

        return () => {
            if (subscription) {
                console.debug('deregister onUserCreated subscription');
                subscription.unsubscribe();
            }
        };
    }, [dispatch, userHasAccess]);

    // subscribe to user updates
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            subscription = graphqlSubscribe<{ onUserUpdated: CognitoUser }>(
                onUserUpdated
            ).subscribe({
                next: (event) => {
                    console.debug('onUserUpdated received', event);
                    const user = event.value.data.onUserUpdated;
                    if (user && user.Attributes != null) {
                        const enrichedUser: EnrichedUser = {
                            ...user,
                            Email: getUserEmail(user),
                            CountryCode: getUserCountryCode(user),
                            Roles: parseRoles(user),
                        };
                        dispatch('UPDATE_USER', enrichedUser);
                    } else {
                        console.info('a non valid user was received:', user);
                    }
                },
            });
        }
        return () => {
            if (subscription) {
                console.debug('deregister onUserCreated subscription');
                subscription.unsubscribe();
            }
        };
    }, [dispatch, userHasAccess]);

    // subscribe to user updates (duplicate for reliability)
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            subscription = graphqlSubscribe<{ onUserUpdated: CognitoUser }>(
                onUserUpdated
            ).subscribe({
                next: (event) => {
                    console.debug('onUserUpdated received', event);
                    const user = event.value.data.onUserUpdated;
                    if (user) {
                        const enrichedUser: EnrichedUser = {
                            ...user,
                            Email: getUserEmail(user),
                            CountryCode: getUserCountryCode(user),
                            Roles: parseRoles(user),
                        };
                        dispatch('UPDATE_USER', enrichedUser);
                    }
                },
            });
        }
        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [userHasAccess, dispatch]);
};
