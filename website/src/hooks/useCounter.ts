import { useState } from 'react';

/**
 * Return type for useCounter hook
 */
type UseCounterReturn = [
  number, // counterValue
  () => void, // increaseCounter
  () => void, // decreaseCounter
  (initValue?: number) => void // resetCounter
];

/**
 * Custom hook for managing a counter with increase, decrease, and reset functionality
 * @param initValue - Initial counter value (default: 0)
 * @returns Tuple containing [counterValue, increaseCounter, decreaseCounter, resetCounter]
 */
export default function useCounter(initValue: number = 0): UseCounterReturn {
  const [counterValue, setCounter] = useState<number>(initValue);

  const resetCounter = (initValue: number = 0): void => {
    setCounter(initValue);
  };

  const increaseCounter = (): void => {
    setCounter((prevState) => prevState + 1);
  };

  const decreaseCounter = (): void => {
    setCounter((prevState) => {
      if (prevState <= 0) {
        return 0;
      } else {
        return prevState - 1;
      }
    });
  };

  return [counterValue, increaseCounter, decreaseCounter, resetCounter];
}
