import { graphqlQuery } from '../../../graphql/graphqlHelpers';
import { getRacerProfile } from '../../../graphql/queries';
import { carSetTaillightColor, carEmergencyStop } from '../../../graphql/mutations';

const STOP_COLOUR = 'white';

const TAILLIGHT_COLOURS: Record<string, [number, number, number]> = {
  blue: [0, 0, 255],
  red: [255, 0, 0],
  marigold: [255, 130, 0],
  'orchid purple': [128, 0, 128],
  'sky blue': [30, 144, 255],
  green: [124, 252, 0],
  violet: [255, 0, 255],
  lime: [255, 255, 0],
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function colourDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function nearestTaillightColour(hex: string): string {
  const target = hexToRgb(hex);
  let nearest = 'blue';
  let minDist = Infinity;
  for (const [name, rgb] of Object.entries(TAILLIGHT_COLOURS)) {
    const dist = colourDistance(target, rgb);
    if (dist < minDist) {
      minDist = dist;
      nearest = name;
    }
  }
  return nearest;
}

export async function setTaillightFromProfile(
  carInstanceId: string,
  username: string
): Promise<{ raceColour: string; stopColour: string } | null> {
  try {
    const data = await graphqlQuery<{ getRacerProfile: { highlightColour?: string | null } | null }>(
      getRacerProfile,
      { username }
    );
    const hex = data?.getRacerProfile?.highlightColour;
    if (!hex) return null;

    const raceColour = nearestTaillightColour(hex);

    await graphqlQuery(carSetTaillightColor, {
      resourceIds: [carInstanceId],
      selectedColor: raceColour,
    });

    return { raceColour, stopColour: STOP_COLOUR };
  } catch (err) {
    console.error('Failed to set taillight colour from profile:', err);
    return null;
  }
}

export async function setTaillightColour(
  carInstanceId: string,
  colour: string
): Promise<void> {
  try {
    await graphqlQuery(carSetTaillightColor, {
      resourceIds: [carInstanceId],
      selectedColor: colour,
    });
  } catch (err) {
    console.error('Failed to set taillight colour:', err);
  }
}

export async function stopCar(carInstanceId: string): Promise<void> {
  try {
    await graphqlQuery(carEmergencyStop, {
      resourceIds: [carInstanceId],
    });
  } catch (err) {
    console.error('Failed to emergency stop car:', err);
  }
}
