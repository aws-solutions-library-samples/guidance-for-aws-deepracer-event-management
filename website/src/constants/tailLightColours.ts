/**
 * The DeepRacer car tail-light colour palette (hex), offered in the racer
 * profile highlight picker and the Timekeeper colour override.
 *
 * These are exactly the 8 colours the car firmware renders cleanly — they
 * match the `colors` dict in lib/lambdas/cars_function/index.py (hex→PWM
 * reproduces the dict's PWM). Colours that wash out on the diffused RGB LED
 * (e.g. #673ab7) and white (#FFFFFF, reserved as the stop signal) are
 * deliberately excluded. Order: blue, red, marigold, orchid purple, sky blue,
 * green, violet (magenta), lime (yellow).
 */
export const TAIL_LIGHT_COLOURS = [
  '#0000FF',
  '#FF0000',
  '#FF8200',
  '#800080',
  '#1E90FF',
  '#7CFC00',
  '#FF00FF',
  '#FFFF00',
];
