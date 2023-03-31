import React, { useEffect, useState } from 'react';
import useInterval from '../hooks/useInterval';

const interval = 500;

const RaceTimer = ({ timeLeftInMs, timerIsRunning }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [prevTime, setPrevTime] = useState(null);
  const [timeInMilliseconds, setTimeInMilliseconds] = useState(0);
  const [time, setTime] = useState({
    minutes: 0,
    seconds: 0,
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

  const toTime = (time) => {
    let seconds = Math.floor((time / 1000) % 60);
    let minutes = Math.floor(time / (1000 * 60));

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    return {
      seconds,
      minutes,
    };
  };

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
