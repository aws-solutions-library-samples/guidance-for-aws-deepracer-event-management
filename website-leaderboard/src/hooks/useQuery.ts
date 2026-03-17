import { generateClient } from 'aws-amplify/api';
import { useEffect, useState } from 'react';

import * as queries from '../graphql/queries';

const client = generateClient();

export default function useQuery(method: string, params: Record<string, any> = {}) {
  const [data, setData] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  useEffect(() => {
    const queryApi = async () => {
      try {
        setLoading(true);
        const response = await client.graphql({ query: (queries as any)[method], variables: params });
        setData((response as any).data[method]);
        setLoading(false);
      } catch (err: any) {
        setError(String(err));
        setLoading(false);
      }
    };
    queryApi();
    return () => {
      // abort();
    };
  }, [method]);

  return [data, loading, error] as const;
}
