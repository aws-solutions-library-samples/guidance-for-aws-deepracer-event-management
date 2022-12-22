import { API, graphqlOperation } from 'aws-amplify';
import { useState } from 'react';

import * as mutations from '../graphql/mutations';

export default function useMutation() {
  const [loading, setLoading] = useState(false);

  const send = (method, payload) => {
    const mutateApi = async () => {
      try {
        setLoading(true);
        const response = await API.graphql(graphqlOperation(mutations[method], payload));
        console.info(response);
        setLoading(false);
        return '';
      } catch (error) {
        setLoading(false);
        return error;
      }
    };
    return mutateApi();
  };

  return [send, loading];
}
