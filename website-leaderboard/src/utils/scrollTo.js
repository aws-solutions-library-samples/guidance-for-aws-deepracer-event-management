// scrollTo.js

import { animateScroll } from './animateScroll';

const logError = () =>
  console.error(`Invalid element, are you sure you've provided element id or react ref?`);

//const getElementPosition = (element) => element.offsetTop;
const getElementPosition = (element) => element.clientHeight;

export const scrollToTop = (element) => {
  element.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
};

export const scrollTo = ({ id, ref = null, duration = 3000 }) => {
  // the position of the scroll bar before the user clicks the button
  //const initialPosition = window.scrollY; //it will always be 0

  //alert(initialPosition);
  // decide what type of reference that is
  // if neither ref or id is provided  set element to null
  const element = ref ? ref.current : id ? document.getElementById(id) : null;

  const initialPosition = element.scrollTop;

  if (!element) {
    // log error if the reference passed is invalid
    logError();
    return;
  }

  animateScroll({
    targetPosition: getElementPosition(element),
    initialPosition,
    duration,
    element,
  });
};
