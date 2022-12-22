import { Header } from '@cloudscape-design/components';
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import useInterval from '../../hooks/useInterval';

const interval = 10;

const LapTimer = forwardRef((props, ref) => {
  const [isRunning, setIsRunning] = useState(false);
  const [prevTime, setPrevTime] = useState(null);
  const [timeInMilliseconds, setTimeInMilliseconds] = useState(0);
  const [time, setTime] = useState({
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  useImperativeHandle(ref, () => ({
    start() {
      // console.log('Start Timer');
      setIsRunning(true);
      setPrevTime(null);
      setTime(toTime(0));
    },
    pause() {
      // console.log('Pause Resume Timer');
      setIsRunning(false);
    },
    reset(startingTime = 0) {
      // console.log('Reset Timer');
      setPrevTime(null);
      setTimeInMilliseconds(startingTime);
      setTime(toTime(startingTime));
    },
    getCurrentTimeInMs() {
      return timeInMilliseconds;
    },
    getIsRunning() {
      return isRunning;
    },
  }));

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
      const newMilliTime = timeInMilliseconds + diffTime;
      setTimeInMilliseconds(newMilliTime);
      const newTime = toTime(newMilliTime);
      setPrevTime(Date.now());
      setTime(newTime);
    },
    isRunning ? interval : null
  );

  return (
    <Header>
      {time.minutes}:{time.seconds}:{time.milliseconds}
    </Header>
  );
});

export default LapTimer;
