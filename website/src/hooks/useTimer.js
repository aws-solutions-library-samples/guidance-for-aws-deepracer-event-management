// TODO add paramter for counting up or down
import { useState } from 'react';
import useInterval from './useInterval';

export const Direction = {
  Up: 'Up',
  Down: 'Down',
};

export default function useTimer(interval = 27, direction = Direction.Up) {
  const [isRunning, setIsRunning] = useState(false);
  const [prevTime, setPrevTime] = useState(null);
  const [timeInMilliseconds, setTimeInMilliseconds] = useState(0);
  const [time, setTime] = useState({
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  const toTime = (time) => {
    let milliseconds = parseInt(time % 1000, 10);
    let seconds = Math.floor((time / 1000) % 60);
    let minutes = Math.floor(time / (1000 * 60));

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
      let newMilliTime;
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

  const handleStart = () => {
    console.info('start lap timer');
    setIsRunning(true);
    setPrevTime(null);
    setTime(toTime(0));
  };

  const handlePause = () => {
    console.info('Pause lap timer');
    // clearInterval(countRef.current);
    setIsRunning(false);
  };

  const handleReset = (startingTime = 0) => {
    console.info('Reset lap time');
    setPrevTime(null);
    setTimeInMilliseconds(startingTime);
    setTime(toTime(startingTime));
  };

  return [time, timeInMilliseconds, isRunning, handleStart, handlePause, handleReset];
}
