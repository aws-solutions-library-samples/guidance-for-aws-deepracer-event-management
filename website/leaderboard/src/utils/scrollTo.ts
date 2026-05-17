// scrollTo.ts

import { animateScroll } from './animateScroll';

const logError = () => console.error(`Invalid element, are you sure you've provided element id or react ref?`);

//const getElementPosition = (element) => element.offsetTop;
const getElementPosition = (element: HTMLElement) => element.clientHeight;

export const scrollTo = ({ id, ref = null, duration = 3000 }: { id?: string; ref?: any; duration?: number }) => {
  // decide what type of reference that is
  // if neither ref or id is provided set element to null
  const element: HTMLElement | null = ref ? ref.current : id ? document.getElementById(id) : null;

  if (!element) {
    // log error if the reference passed is invalid
    logError();
    return;
  }

  const initialPosition = element.scrollTop;

  animateScroll({
    targetPosition: getElementPosition(element),
    initialPosition,
    duration,
    element,
  });
};
