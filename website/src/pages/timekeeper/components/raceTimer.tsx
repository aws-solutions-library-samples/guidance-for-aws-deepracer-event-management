import { Header } from '@cloudscape-design/components';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useInterval } from '../../../hooks/useInterval';

const interval = 100;

interface Time {
  minutes: string | number;
  seconds: string | number;
  milliseconds: string | number;
}

export interface RaceTimerHandle {
  start: () => void;
  pause: () => void;
  reset: (startingTime?: number) => void;
  getCurrentTimeInMs: () => number;
  getIsRunning: () => boolean;
}

interface RaceTimerProps {
  onExpire: () => void;
}

const RaceTimer = forwardRef<RaceTimerHandle, RaceTimerProps>((props, ref) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [prevTime, setPrevTime] = useState<number | null>(null);
  const [timeInMilliseconds, setTimeInMilliseconds] = useState<number>(0);
  const [isExpired, SetIsExpired] = useState<boolean>(false);
  const [time, setTime] = useState<Time>({
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  const { onExpire } = props;

  // Signal to parent that timer has expired
  useEffect(() => {
    if (isExpired) {
      onExpire();
    }
  }, [isExpired, onExpire]);

  useImperativeHandle(ref, () => ({
    start() {
      // console.debug('Start Timer');
      setPrevTime(null);
      setIsRunning(true);
    },
    pause() {
      setIsRunning(false);
    },
    reset(startingTime: number = 0) {
      // console.debug('Reset race Timer =' + JSON.stringify(startingTime));
      setPrevTime(null);
      setTime(toTime(startingTime));
      setTimeInMilliseconds(startingTime);
      SetIsExpired(false);
      setIsRunning(false);
    },
    getCurrentTimeInMs() {
      return timeInMilliseconds;
    },
    getIsRunning() {
      return isRunning;
    },
  }));

  const toTime = (time: number): Time => {
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
      seconds,
      minutes,
      milliseconds,
    };
  };

  useInterval(
    () => {
      const prev = prevTime ? prevTime : Date.now();
      const diffTime = Date.now() - prev;
      const newMilliTime = timeInMilliseconds - diffTime;
      if (newMilliTime <= 0) {
        SetIsExpired(true);
        setIsRunning(false);
        setTimeInMilliseconds(0);
        setPrevTime(null);
        setTime(toTime(0));
      } else {
        setTimeInMilliseconds(newMilliTime);
        const newTime = toTime(newMilliTime);
        setPrevTime(Date.now());
        setTime(newTime);
      }
    },
    isRunning ? interval : null
  );

  return (
    <Header variant="h3">
      {time.minutes}:{time.seconds}
    </Header>
  );
});

RaceTimer.displayName = 'RaceTimer';

export default RaceTimer;
