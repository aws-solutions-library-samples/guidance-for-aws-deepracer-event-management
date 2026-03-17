import { Header } from '@cloudscape-design/components';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useInterval } from '../../../hooks/useInterval';

const interval = 10;

interface Time {
  minutes: string | number;
  seconds: string | number;
  milliseconds: string | number;
}

export interface LapTimerHandle {
  start: () => void;
  pause: () => void;
  reset: (startingTime?: number) => void;
  getCurrentTimeInMs: () => number;
  getIsRunning: () => boolean;
}

interface LapTimerProps {}

const LapTimer = forwardRef<LapTimerHandle, LapTimerProps>((props, ref) => {
  const isRunning = useRef<boolean>(false);
  const prevTime = useRef<number | null>(null);
  const timeInMilliseconds = useRef<number>(0);
  const [time, setTime] = useState<Time>({
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  useImperativeHandle(ref, () => ({
    start() {
      isRunning.current = true;
      prevTime.current = null;
    },
    pause() {
      isRunning.current = false;
    },
    reset(startingTime: number = 0) {
      prevTime.current = null;
      timeInMilliseconds.current = startingTime;
      setTime((prevState) => toTime(startingTime));
    },
    getCurrentTimeInMs() {
      return timeInMilliseconds.current;
    },
    getIsRunning() {
      return isRunning.current;
    },
  }));

  const toTime = useCallback((time: number): Time => {
    let milliseconds: string | number = parseInt(String(time % 1000), 10);
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
  }, []);

  useInterval(
    () => {
      const prev = prevTime.current ? prevTime.current : Date.now();
      const diffTime = Date.now() - prev;
      const newMilliTime = timeInMilliseconds.current + diffTime;
      timeInMilliseconds.current = newMilliTime;
      const newTime = toTime(newMilliTime);
      prevTime.current = Date.now();
      setTime((prevState) => newTime);
    },
    isRunning.current ? interval : null
  );

  return (
    <Header variant="h3">
      {time.minutes}:{time.seconds}:{time.milliseconds}
    </Header>
  );
});

LapTimer.displayName = 'LapTimer';

export default LapTimer;
