function LowerThirdRacerAndLapInfoIn() {
  return d3
    .select('#lower-third-racer-and-lap-info')
    .transition()
    .ease(d3.easeExpInOut)
    .duration(1000)
    .style('left', '20px');
}

function LowerThirdRacerAndLapInfoOut() {
  return (
    d3
      .select('#lower-third-racer-and-lap-info')
      .transition()
      .ease(d3.easeExpInOut)
      // .delay(1000)
      // .ease(d3.easeLinear)
      .duration(1000)
      .style('left', '-1200px')
  );
}

function LeaderboardFadeIn() {
  return (
    d3
      .select('#leaderboard')
      .transition()
      .ease(d3.easeExpInOut)
      // .delay(1000)
      // .ease(d3.easeLinear)
      .duration(1000)
      .style('opacity', 1)
  );
}

function LeaderboardFadeOut() {
  return (
    d3
      .select('#leaderboard')
      .transition()
      .ease(d3.easeExpInOut)
      // .delay(1000)
      // .ease(d3.easeLinear)
      .duration(1000)
      .style('opacity', 0)
  );
}

function DidYouKnowFadeIn() {
  return (
    d3
      .select('#did-you-know')
      .transition()
      .ease(d3.easeExpInOut)
      // .delay(1000)
      // .ease(d3.easeLinear)
      .duration(1000)
      .style('opacity', 1)
  );
}

function DidYouKnowFadeOut() {
  return (
    d3
      .select('#did-you-know')
      .transition()
      .ease(d3.easeExpInOut)
      // .delay(1000)
      // .ease(d3.easeLinear)
      .duration(1000)
      .style('opacity', 0)
  );
}
