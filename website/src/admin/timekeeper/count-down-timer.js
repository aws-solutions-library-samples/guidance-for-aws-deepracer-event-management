import { Header } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';

const CountDownTimer = (props) => {
  const [timerId, setTimerId] = useState();
  const [time, setTime] = useState(props.duration);

  useEffect(() => {
    if (props.isReset === true) {
      setTime(props.duration);
    }
  }, [props.isReset, props.duration]);

  useEffect(() => {
    if (props.isRunning) {
      console.log('Starting race timer');
      const timeDecrease = 1000;
      if (!timerId) {
        const timerId = setInterval(() => {
          setTime((previousTime) => {
            let newTime = previousTime - timeDecrease;
            if (newTime <= 0) {
              newTime = 0;
              props.onExpire(true);
              clearInterval(timerId);
              setTimerId(null);
            }
            return newTime;
          });
        }, timeDecrease);
        setTimerId(timerId);
      }
    } else {
      console.log('Stopping race timer');
      clearInterval(timerId);
      setTimerId(null);
    }
  }, [props.isRunning, timerId]);

  const convertMsToString = (timeInMS) => {
    const seconds = Math.floor(timeInMS / 1000);
    const secondsAsString = String(Math.floor(timeInMS / 1000) % 60).padStart(2, '0');
    const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
    const timeAsString = `${minutesAsString}:${secondsAsString}`;
    return timeAsString;
  };

  // TODO start to flash timer when closing down to 00:00
  return <Header>{convertMsToString(time)}</Header>;
};

export { CountDownTimer };
