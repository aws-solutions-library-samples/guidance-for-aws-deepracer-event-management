const inBetween = 1;
const inBetweenTop3 = 1.5;
const afterTop3 = 2.5;

export default function positionForRank(idx) {
  if (idx < 3) {
    return inBetweenTop3;
  } else if (idx === 3) {
    return afterTop3;
  }
  return inBetween;
}
