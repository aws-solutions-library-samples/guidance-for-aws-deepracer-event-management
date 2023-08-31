import { API, graphqlOperation } from 'aws-amplify';
import { useEffect } from 'react';
import * as queries from '../graphql/queries';
import { onUserCreated } from '../graphql/subscriptions';
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

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      async function listUsers() {
        dispatch('USERS_IS_LOADING', true);
        const response = await API.graphql({
          query: queries.listUsers,
          authMode: 'AMAZON_COGNITO_USER_POOLS',
        });
        const tempUsers = response.data.listUsers;
        console.debug('LIST USERS reply');
        const users = tempUsers.map((u) => ({
          ...u,
          Email: getUserEmail(u),
          CountryCode: getUserCountryCode(u),
        }));
        dispatch('ADD_USERS', users);
        dispatch('USERS_IS_LOADING', false);
      }
      listUsers();
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let subscription;
    if (userHasAccess) {
      console.debug('register onUserCreated subscription');
      subscription = API.graphql(graphqlOperation(onUserCreated)).subscribe({
        next: (event) => {
          console.debug('onUserCreated recived');
          const user = {
            ...event.value.data.onUserCreated,
            Email: getUserEmail(event.value.data.onUserCreated),
            CountryCode: getUserCountryCode(event.value.data.onUserCreated),
          };

          dispatch('UPDATE_USER', user);
        },
      });

      // const subscription = API.graphql({
      //   ...graphqlOperation(onUserCreated),
      //   authMode: 'AMAZON_COGNITO_USER_POOLS',
      // }).subscribe({
      //   next: (event) => {
      //     console.debug(event);
      //     setUsers([...users, event.value.data.onUserCreated]);
      //   },
      // });
    }

    return () => {
      //   console.debug('onUserCreated subscription cleanup');
      if (subscription) {
        console.debug('deregister onUserCreated subscription');
        subscription.unsubscribe();
      }
    };
  }, [dispatch, userHasAccess]);
};
