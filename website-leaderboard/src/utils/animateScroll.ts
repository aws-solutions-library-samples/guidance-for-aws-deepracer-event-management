// animateScroll.js

const pow = Math.pow;

export const scrollToTop = (element) => {
  element.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
};

// The easing function that makes the scroll decelerate over time
function easeOutQuart(x) {
  return x;
  //return 1 - pow(1 - x, 4);
  //return 1 - pow(x, 2);
  //return pow(x, 2);
}

export function animateScroll({ targetPosition, initialPosition, duration, element }) {
  let start;
  let position;
  let animationFrame;

  const requestAnimationFrame = window.requestAnimationFrame;
  const cancelAnimationFrame = window.cancelAnimationFrame;

  // maximum amount of pixels we can scroll
  //const maxAvailableScroll =
  //  document.documentElement.scrollHeight - document.documentElement.clientHeight;

  //const maxAvailableScroll = element.scrollHeight - element.clientHeight;

  const maxAvailableScroll = element.scrollHeight;

  const amountOfPixelsToScroll = initialPosition - maxAvailableScroll;

  function step(timestamp) {
    if (start === undefined) {
      start = timestamp;
    }

    const elapsed = timestamp - start;

    // this just gives us a number between 0 (start) and 1 (end)
    const relativeProgress = elapsed / duration;

    // ease out that number
    const easedProgress = easeOutQuart(relativeProgress);

    // calculate new position for every tick of the requestAnimationFrame
    position = initialPosition - amountOfPixelsToScroll * Math.min(easedProgress, 1);

    //window.scrollTo(0, position);
    element.scrollTo(0, position);

    // Stop when max scroll is reached
    //if (initialPosition !== maxAvailableScroll && window.scrollY === maxAvailableScroll) {
    if (position == maxAvailableScroll) {
      scrollToTop(element);
      cancelAnimationFrame(animationFrame);
      return;
    }

    // repeat until the end is reached
    if (elapsed < duration) {
      animationFrame = requestAnimationFrame(step);
    }
  }

  animationFrame = requestAnimationFrame(step);
}
