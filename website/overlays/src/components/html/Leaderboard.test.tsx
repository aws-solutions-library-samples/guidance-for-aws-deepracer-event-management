import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Leaderboard } from './Leaderboard';
import type { LeaderboardEntry } from '../../format';

const labels = {
  first: 'P1',
  second: 'P2',
  third: 'P3',
  fourth: 'P4',
  footer: 'Live results',
};

const entries: LeaderboardEntry[] = [
  { username: 'speed', fastestLapTime: 8324 },
  { username: 'turbo', fastestLapTime: 8730 },
  { username: 'doom', fastestLapTime: 8985 },
  { username: 'dbro', fastestLapTime: 9167 },
];

describe('Leaderboard', () => {
  test('renders the four top racers in order with their times', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('speed')).toBeInTheDocument();
    expect(screen.getByText('08.324')).toBeInTheDocument();
    expect(screen.getByText('turbo')).toBeInTheDocument();
    expect(screen.getByText('08.730')).toBeInTheDocument();
    expect(screen.getByText('doom')).toBeInTheDocument();
    expect(screen.getByText('dbro')).toBeInTheDocument();
  });

  test('renders empty slots when fewer than 4 entries supplied', () => {
    render(
      <Leaderboard
        entries={entries.slice(0, 2)}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('speed')).toBeInTheDocument();
    expect(screen.getByText('turbo')).toBeInTheDocument();
    expect(screen.queryByText('doom')).toBeNull();
    expect(screen.queryByText('dbro')).toBeNull();
  });

  test('renders gap-to-leader for P2-P4 when gapToLeader=true', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('+00.406')).toBeInTheDocument(); // 8730 - 8324
    expect(screen.getByText('+00.661')).toBeInTheDocument(); // 8985 - 8324
    expect(screen.getByText('+00.843')).toBeInTheDocument(); // 9167 - 8324
  });

  test('does not render gap-to-leader when gapToLeader=false', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.queryByText('+00.406')).toBeNull();
  });

  test('renders fastestAverageLap.avgTime in average format', () => {
    render(
      <Leaderboard
        entries={[{ username: 'avg', fastestAverageLap: { avgTime: 9500, startLapId: 1, endLapId: 3 } }]}
        raceFormat="average"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('09.500')).toBeInTheDocument();
  });

  test('renders DNF in average format when entry has no fastestAverageLap', () => {
    render(
      <Leaderboard
        entries={[{ username: 'dnf', fastestAverageLap: null }]}
        raceFormat="average"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('DNF')).toBeInTheDocument();
  });

  test('renders event name in the header, rank labels, and footer fallback', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="My Cool Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('My Cool Event')).toBeInTheDocument();
    expect(screen.getByText('P1')).toBeInTheDocument();
    // No raceName supplied → footer falls back to labels.footer.
    expect(screen.getByText('Live results')).toBeInTheDocument();
  });

  test('renders the raceName in the footer when supplied', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="My Cool Event"
        raceName="AWS LONDON SUMMIT 2023"
        labels={labels}
        visible
      />,
    );
    // raceName takes priority over labels.footer when set.
    expect(screen.getByText('AWS LONDON SUMMIT 2023')).toBeInTheDocument();
    expect(screen.queryByText('Live results')).toBeNull();
  });

  test('applies visible class when visible=true and hidden class when visible=false', () => {
    const { container, rerender } = render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test"
        labels={labels}
        visible
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/visible/);

    rerender(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test"
        labels={labels}
        visible={false}
      />,
    );
    expect(root.className).not.toMatch(/visible/);
  });
});
