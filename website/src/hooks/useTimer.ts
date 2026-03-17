import { useState } from 'react';
import { useInterval } from './useInterval';

export const Direction = {
  Up: 'Up',
  Down: 'Down',
} as const;

export type DirectionType = typeof Direction[keyof typeof Direction];

interface Time {
  minutes: string | number;
  seconds: string | number;
  milliseconds: string | number;
}

type TimerReturnType = [
  Time,
  number,
  boolean,
  () => void,
  () => void,
  (startingTime?: number) => void
];

export default function useTimer(
  interval: number = 27,
  direction: DirectionType = Direction.Up
): TimerReturnType {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [prevTime, setPrevTime] = useState<number | null>(null);
  const [timeInMilliseconds, setTimeInMilliseconds] = useState<number>(0);
  const [time, setTime] = useState<Time>({
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  const toTime = (time: number): Time => {
    let milliseconds: string | number = parseInt((time % 1000).toString(), 10);
    let seconds: string | number = Math.floor((time / 1000) % 60);
    let minutes: string | number = Math.floor(time / (1000 * 60));

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    if (milliseconds < 10) {
      milliseconds = '00' + milliseconds;
    } else if (milliseconds < 100) {
      milliseconds = '0' + milliseconds;
    }

    return {
      milliseconds,
      seconds,
      minutes,
    };
  };

  useInterval(
    () => {
      const prev = prevTime ? prevTime : Date.now();
      const diffTime = Date.now() - prev;
      let newMilliTime: number;
      if (direction === Direction.Up) {
        newMilliTime = timeInMilliseconds + diffTime;
      } else {
        newMilliTime = timeInMilliseconds - diffTime;
      }
      setTimeInMilliseconds(newMilliTime);
      const newTime = toTime(newMilliTime);
      setPrevTime(Date.now());
      setTime(newTime);
    },
    isRunning ? interval : null
  );

  const handleStart = (): void => {
    console.debug('start lap timer');
    setIsRunning(true);
    setPrevTime(null);
    setTime(toTime(0));
  };

  const handlePause = (): void => {
    console.debug('Pause lap timer');
    setIsRunning(false);
  };

  const handleReset = (startingTime: number = 0): void => {
    console.debug('Reset lap time');
    setPrevTime(null);
    setTimeInMilliseconds(startingTime);
    setTime(toTime(startingTime));
  };

  return [time, timeInMilliseconds, isRunning, handleStart, handlePause, handleReset];
}
