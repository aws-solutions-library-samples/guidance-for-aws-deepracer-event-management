import { API, graphqlOperation } from 'aws-amplify';
import { useEffect } from 'react';
import * as queries from '../graphql/queries';
import { onUserCreated, onUserUpdated } from '../graphql/subscriptions';
import { useStore } from '../store/store';

export const useUsersApi = (userHasAccess = false) => {
  const [, dispatch] = useStore();

  function getUserEmail(item) {
    const email = item.Attributes.filter((obj) => {
      return obj.Name === 'email';
    });
    if (email.length > 0) {
      return email[0].Value;
    }
  }

  function getUserCountryCode(item) {
    const countryCode = item.Attributes.filter((obj) => {
      return obj.Name === 'custom:countryCode';
    });
    return countryCode.length > 0 ? countryCode[0].Value : '';
  }

  // Convert user roles to a comma delimited string
  function parseRoles(user) {
    if (!('Roles' in user) || user.Roles == null) return null;
    return user.Roles.join(',');
  }

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      async function listUsers() {
        dispatch('USERS_IS_LOADING', true);
        const response = await API.graphql({
          query: queries.listUsers,
        });
        const tempUsers = response.data.listUsers;
        console.debug('LIST USERS reply', tempUsers);
        const users = tempUsers.map((u) => ({
          ...u,
          Email: getUserEmail(u),
          CountryCode: getUserCountryCode(u),
          Roles: parseRoles(u),
        }));
        dispatch('ADD_USERS', users);
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
    let subscription;
    if (userHasAccess) {
      console.debug('register onUserCreated subscription');
      subscription = API.graphql(graphqlOperation(onUserCreated)).subscribe({
        next: (event) => {
          console.debug('onUserCreated received', event);
          const user = event.value.data.onUserCreated;
          const enrichedUser = {
            ...user,
            Email: getUserEmail(user),
            CountryCode: getUserCountryCode(user),
            Roles: parseRoles(user),
          };

          dispatch('UPDATE_USER', enrichedUser);
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
    let subscription;
    if (userHasAccess) {
      subscription = API.graphql(graphqlOperation(onUserUpdated)).subscribe({
        next: (event) => {
          console.debug('onUserUpdated received', event);
          const user = event.value.data.onUserUpdated;
          if (user.Attributes != null) {
            const enrichedUser = {
              ...user,
              Email: getUserEmail(user),
              CountryCode: getUserCountryCode(user),
              Roles: parseRoles(user),
            };

            dispatch('UPDATE_USER', enrichedUser);
          } else console.info('a non valid user was received:', user);
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
    let subscription;
    if (userHasAccess) {
      subscription = API.graphql(graphqlOperation(onUserUpdated)).subscribe({
        next: (event) => {
          console.debug('onUserUpdated received', event);
          const user = event.value.data.onUserUpdated;
          const enrichedUser = {
            ...user,
            Email: getUserEmail(user),
            CountryCode: getUserCountryCode(user),
            Roles: parseRoles(user),
          };

          dispatch('UPDATE_USER', enrichedUser);
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
