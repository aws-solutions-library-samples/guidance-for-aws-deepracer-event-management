import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LowerThird } from './LowerThird';

const labels = {
  racer: 'Racer',
  remaining: 'Remaining',
  fastest: 'Fastest lap',
  previous: 'Previous lap',
};

describe('LowerThird', () => {
  test('renders racer name, formatted times, and labels', () => {
    render(
      <LowerThird
        username="speedy"
        timeLeftMs={125400}
        fastestLapMs={8324}
        lastLapMs={9167}
        eventName="Test Event"
        labels={labels}
        visible
      />
    );
    expect(screen.getByText('speedy')).toBeInTheDocument();
    expect(screen.getByText('02:05.4')).toBeInTheDocument(); // remaining
    expect(screen.getByText('08.324')).toBeInTheDocument(); // fastest
    expect(screen.getByText('09.167')).toBeInTheDocument(); // last
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Racer')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getByText('Fastest lap')).toBeInTheDocument();
    expect(screen.getByText('Previous lap')).toBeInTheDocument();
  });

  test('renders placeholder time when fastestLapMs is null', () => {
    render(
      <LowerThird
        username="speedy"
        timeLeftMs={180000}
        fastestLapMs={null}
        lastLapMs={null}
        eventName="Test Event"
        labels={labels}
        visible
      />
    );
    // Two placeholder slots (fastest + last) should both show 00.000
    expect(screen.getAllByText('00.000')).toHaveLength(2);
  });

  test('applies visible class when visible=true and hidden class when visible=false', () => {
    const { container, rerender } = render(
      <LowerThird
        username="speedy"
        timeLeftMs={180000}
        fastestLapMs={null}
        lastLapMs={null}
        eventName="Test Event"
        labels={labels}
        visible
      />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/visible/);

    rerender(
      <LowerThird
        username="speedy"
        timeLeftMs={180000}
        fastestLapMs={null}
        lastLapMs={null}
        eventName="Test Event"
        labels={labels}
        visible={false}
      />
    );
    expect(root.className).not.toMatch(/visible/);
  });
});
