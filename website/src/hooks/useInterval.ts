import { useEffect, useRef } from 'react';

/**
 * Custom hook for declarative setInterval
 * Based on: https://overreacted.io/making-setinterval-declarative-with-react-hooks/
 * 
 * @param callback - Function to call on each interval tick
 * @param delay - Delay in milliseconds (null to pause)
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }
    
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
