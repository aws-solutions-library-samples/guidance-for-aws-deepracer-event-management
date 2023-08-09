import { useEffect, useRef, useState } from 'react';

export default function useWebsocket(url, onMessage) {
  const [waitingToReconnect, setWaitingToReconnect] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsClientRef = useRef();

  useEffect(() => {
    try {
      if (waitingToReconnect) {
        return;
      }

      if (!wsClientRef.current) {
        console.info(`Websocket trying to connect to server on url ${url}`);
        const client = new WebSocket(url);
        wsClientRef.current = client;

        client.onopen = () => {
          console.info('WebSocket Connected');
          setIsConnected(true);
        };

        client.onmessage = (event) => {
          onMessage(event.data);
        };

        client.onclose = () => {
          if (wsClientRef.current) {
            // Connection failed
            console.debug('ws closed by server');
          } else {
            // Cleanup initiated from app side, can return here, to not attempt a reconnect
            console.debug('ws closed by app component unmount');
            return;
          }

          if (waitingToReconnect) {
            return;
          }

          setIsConnected(false);

          // Setting this will trigger a re-run of the effect,
          // cleaning up the current websocket, but not setting
          // up a new one right away
          setWaitingToReconnect(true);

          // This will trigger another re-run, and because it is false,
          // the socket will be set up again
          setTimeout(() => setWaitingToReconnect(null), 5000);
        };

        client.onerror = (e) => console.error(e);
      }
    } catch (error) {
      console.warn(error);
    }
    return () => {
      wsClientRef.current = null;
    };
  }, [waitingToReconnect]);

  return [isConnected];
}
