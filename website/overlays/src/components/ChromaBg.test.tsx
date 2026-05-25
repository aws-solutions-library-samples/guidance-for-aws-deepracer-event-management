import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChromaBg } from './ChromaBg';

function renderWith(searchParams: string) {
  return render(
    <MemoryRouter initialEntries={[`/some-event?${searchParams}`]}>
      <ChromaBg />
    </MemoryRouter>
  );
}

describe('ChromaBg', () => {
  test('renders nothing when chroma param is absent', () => {
    const { container } = renderWith('');
    expect(container.querySelector('#chromaBg')).toBeNull();
  });

  test('renders nothing when chroma=0', () => {
    const { container } = renderWith('chroma=0');
    expect(container.querySelector('#chromaBg')).toBeNull();
  });

  test('renders green background when chroma=1', () => {
    const { container } = renderWith('chroma=1');
    const el = container.querySelector('#chromaBg') as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  test('renders custom colour when chromaColor is set', () => {
    const { container } = renderWith('chroma=1&chromaColor=ff00ff');
    const el = container.querySelector('#chromaBg') as HTMLElement | null;
    expect(el!.style.backgroundColor).toBe('rgb(255, 0, 255)');
  });

  test('falls back to green if chromaColor is longer than 6 chars (XSS guard)', () => {
    const { container } = renderWith('chroma=1&chromaColor=ff00ffabc');
    const el = container.querySelector('#chromaBg') as HTMLElement | null;
    expect(el!.style.backgroundColor).toBe('rgb(0, 255, 0)');
  });
});
