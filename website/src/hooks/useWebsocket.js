import { useEffect, useRef, useState } from 'react';

export default function useWebsocket(url) {
  const [message, setMessage] = useState();
  const [connected, setConnected] = useState(false);
  const wsClient = useRef();

  useEffect(() => {
    console.info('wsClient:' + wsClient);
    const connect = () => {
      try {
        console.info('Websocket trying to connect to server....');
        const client = new WebSocket(url);
        wsClient.current = client;
        client.onopen = () => {
          console.warn('WebSocket Connected');
          setConnected(true);
        };

        client.onmessage = (message) => {
          setMessage(message);
        };

        client.onclose = () => {
          console.warn('WebSocket Connection closed');
          setConnected(false);
          wsClient.current = null;
          //     setTimeout(() => {}, 5000); // TODO check why reconnection is not working properly
        };

        client.onerror = () => {
          console.warn('WebSocket Connection Error');
          setConnected(false);
          wsClient.current = null;
          // setTimeout(connect(), 5000); // TODO check why reconnection is not working properly
        };

        console.info('Websocket connected to server');
      } catch (e) {
        console.error('Websocket connection error', e);
        // setTimeout(connect(), 5000); // TODO check why reconnection is not working properly
      }
    };
    if (!wsClient.current) {
      console.info('test');
      connect();
    }
    return () => {
      if (wsClient.current) {
        wsClient.current.close();
        wsClient.current = undefined;
      }
    };
  }, [url]);

  return { message, connected };
}
