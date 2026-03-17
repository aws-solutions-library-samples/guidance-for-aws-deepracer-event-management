import React, { useEffect, useState } from 'react';
import { useInterval } from '../hooks/useInterval';

const interval = 500;

/**
 * Time structure for displaying minutes and seconds
 */
interface TimeDisplay {
  minutes: string;
  seconds: string;
}

/**
 * Props interface for RaceTimer component
 */
interface RaceTimerProps {
  /** Time remaining in milliseconds */
  timeLeftInMs: number;
  /** Whether the timer is currently running */
  timerIsRunning: boolean | null;
}

/**
 * Converts milliseconds to a formatted time display
 * @param time - Time in milliseconds
 * @returns Formatted time with minutes and seconds
 */
const toTime = (time: number): TimeDisplay => {
  let seconds: number | string = Math.floor((time / 1000) % 60);
  let minutes: number | string = Math.floor(time / (1000 * 60));

  minutes = minutes < 10 ? '0' + minutes : minutes.toString();
  seconds = seconds < 10 ? '0' + seconds : seconds.toString();

  return {
    seconds,
    minutes,
  };
};

/**
 * RaceTimer component that displays a countdown timer
 * @param props - Component props
 * @returns Rendered timer display
 */
const RaceTimer = ({ timeLeftInMs, timerIsRunning }: RaceTimerProps): JSX.Element => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [prevTime, setPrevTime] = useState<number | null>(null);
  const [timeInMilliseconds, setTimeInMilliseconds] = useState<number>(0);
  const [time, setTime] = useState<TimeDisplay>({
    minutes: '00',
    seconds: '00',
  });

  useEffect(() => {
    setTimeInMilliseconds(timeLeftInMs);
    const newTime = toTime(timeLeftInMs);
    setPrevTime(Date.now());
    setTime(newTime);
  }, [timeLeftInMs]);

  useEffect(() => {
    if (timerIsRunning == null) return;

    if (timerIsRunning) {
      setPrevTime(Date.now());
    }
    setIsRunning(timerIsRunning);
  }, [timerIsRunning]);

  useInterval(
    () => {
      const prev = prevTime ? prevTime : Date.now();
      const diffTime = Date.now() - prev;
      const newMilliTime = timeInMilliseconds - diffTime;
      if (newMilliTime <= 0) {
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
    <span>
      {time.minutes}:{time.seconds}
    </span>
  );
};

export default RaceTimer;
