import { useState } from 'react';

export default function useCounter(initValue = 0) {
  const [counterValue, setCounter] = useState(initValue);

  const resetCounter = (initValue = 0) => {
    setCounter(initValue);
  };

  const increseCounter = () => {
    setCounter((prevState) => prevState + 1);
  };

  const decreaseCounter = () => {
    setCounter((prevState) => {
      if (prevState <= 0) {
        return 0;
      } else {
        return prevState - 1;
      }
    });
  };

  return [counterValue, increseCounter, decreaseCounter, resetCounter];
}
