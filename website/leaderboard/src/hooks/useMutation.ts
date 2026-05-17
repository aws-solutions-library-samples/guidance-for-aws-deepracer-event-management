import { generateClient } from 'aws-amplify/api';
import { useCallback, useState } from 'react';

import * as mutations from '../graphql/mutations';

const client = generateClient();

export default function useMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(undefined);
  const [errorMessage, setErrorMessage] = useState('');

  const send = useCallback(async (method: string, payload: Record<string, any>) => {
    try {
      setIsLoading(true);
      setData(undefined);
      const response = await client.graphql({ query: (mutations as any)[method], variables: payload });
      setData({ ...(response as any).data[method] });
      setIsLoading(false);
      setErrorMessage('');
      console.info((response as any).data[method]);
    } catch (error: any) {
      console.info(error);
      console.warn(error.errors[0].message);
      setIsLoading(false);
      setErrorMessage(error.errors[0].message);
      setData(undefined);
    }
  }, []);

  return [send, isLoading, errorMessage, data] as const;
}
