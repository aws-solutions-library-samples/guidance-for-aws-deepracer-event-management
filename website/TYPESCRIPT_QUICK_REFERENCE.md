# TypeScript Quick Reference Guide

## Overview
This guide provides quick references for common TypeScript patterns used in the AWS DeepRacer Event Management application.

## Type Definitions Location

All custom types are organized in the `src/types/` directory:

```
src/types/
├── index.ts           # Main type exports
├── domain.ts          # Domain models (Event, Track, Race, Lap, etc.)
├── api.ts             # API response types
└── graphql.ts         # GraphQL operation types
```

**Import types:**
```typescript
import { Event, Track, Race, Lap, LeaderboardEntry } from '../types';
// or
import { Event, Track } from '../types/domain';
```

---

## Common Patterns

### 1. React Component with Props

```typescript
import React from 'react';
import { Event, Track } from '../types/domain';

interface MyComponentProps {
  event: Event;
  track?: Track;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}

export const MyComponent: React.FC<MyComponentProps> = ({ 
  event, 
  track, 
  onSelect, 
  isLoading = false 
}) => {
  // Component implementation
  return <div>...</div>;
};
```

**Alternative syntax (preferred for complex components):**
```typescript
export function MyComponent({ event, track, onSelect, isLoading = false }: MyComponentProps) {
  // Component implementation
  return <div>...</div>;
}
```

---

### 2. useState Hook

```typescript
// Simple types
const [name, setName] = useState<string>('');
const [count, setCount] = useState<number>(0);
const [isActive, setIsActive] = useState<boolean>(false);

// Array types
const [items, setItems] = useState<string[]>([]);
const [events, setEvents] = useState<Event[]>([]);

// Object types
const [user, setUser] = useState<User | null>(null);
const [config, setConfig] = useState<AppConfig>({ theme: 'light' });

// Complex state
interface FormState {
  username: string;
  email: string;
  isValid: boolean;
}
const [form, setForm] = useState<FormState>({
  username: '',
  email: '',
  isValid: false,
});
```

---

### 3. Event Handlers

```typescript
// Click handlers
const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
  console.log('Clicked');
};

// Change handlers
const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
  setValue(event.target.value);
};

// Form submit
const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
  event.preventDefault();
  // Submit logic
};

// Custom callback with typed parameter
const handleSelect = (item: Event): void => {
  setSelectedEvent(item);
};

// Async handler
const handleSave = async (): Promise<void> => {
  await saveData();
};
```

---

### 4. GraphQL API Calls

```typescript
import { API, graphqlOperation } from 'aws-amplify';
import { GraphQLResult } from '@aws-amplify/api-graphql';
import { getLeaderboard } from '../graphql/queries';
import { LeaderboardEntry } from '../types/domain';

// Define the response type
interface GetLeaderboardResponse {
  getLeaderboard: {
    entries: LeaderboardEntry[];
    trackId: string;
    eventId: string;
  };
}

// Type the API call
const loadLeaderboard = async (eventId: string, trackId: string): Promise<LeaderboardEntry[]> => {
  const response = await API.graphql(
    graphqlOperation(getLeaderboard, { eventId, trackId })
  ) as GraphQLResult<GetLeaderboardResponse>;

  return response.data?.getLeaderboard.entries || [];
};
```

---

### 5. GraphQL Subscriptions

```typescript
import { API, graphqlOperation } from 'aws-amplify';
import { onNewLeaderboardEntry } from '../graphql/subscriptions';
import { LeaderboardEntry } from '../types/domain';

// Define subscription event type
interface SubscriptionEvent<T> {
  value: {
    data: T;
  };
}

// Use in useEffect
useEffect(() => {
  const filter = { eventId: selectedEvent.eventId };
  
  const subscription = API.graphql(
    graphqlOperation(onNewLeaderboardEntry, filter)
  ).subscribe({
    next: (event: SubscriptionEvent<{ onNewLeaderboardEntry: LeaderboardEntry }>) => {
      const entry = event.value.data.onNewLeaderboardEntry;
      updateLeaderboard(entry);
    },
    error: (error: Error) => {
      console.error('Subscription error:', error);
    },
  });

  return () => {
    if (subscription) {
      subscription.unsubscribe();
    }
  };
}, [selectedEvent.eventId]);
```

---

### 6. Cloudscape Components

```typescript
import { TableProps, ButtonProps } from '@cloudscape-design/components';
import { Event } from '../types/domain';

// Table column definitions
const columnDefinitions: TableProps.ColumnDefinition<Event>[] = [
  {
    id: 'eventId',
    header: 'Event ID',
    cell: (item: Event) => item.eventId,
    sortingField: 'eventId',
  },
  {
    id: 'eventName',
    header: 'Event Name',
    cell: (item: Event) => item.eventName || '-',
    sortingField: 'eventName',
  },
];

// Button with typed onClick
const handleButtonClick: ButtonProps['onClick'] = (event) => {
  console.log('Button clicked', event.detail);
};
```

---

### 7. Custom Hooks

```typescript
import { useState, useEffect } from 'react';
import { Event } from '../types/domain';

// Hook with return type
function useEvents(): {
  events: Event[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await loadEventsFromAPI();
      setEvents(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return { events, loading, error, refetch: fetchEvents };
}
```

---

### 8. Async Functions

```typescript
// Function that returns a promise
async function loadData(id: string): Promise<Event> {
  const response = await fetchFromAPI(id);
  return response.data;
}

// Function that returns a promise with possible null
async function findUser(username: string): Promise<User | null> {
  const users = await loadUsers();
  return users.find(u => u.username === username) || null;
}

// Function with error handling
async function saveData(data: Event): Promise<{ success: boolean; error?: string }> {
  try {
    await API.graphql(graphqlOperation(updateEvent, { input: data }));
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
```

---

### 9. Type Guards

```typescript
// Check if value is defined
function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Check if error is Error type
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Usage
const value: string | null = getValue();
if (isDefined(value)) {
  // TypeScript knows value is string here
  console.log(value.toUpperCase());
}
```

---

### 10. Utility Types

```typescript
// Make all properties optional
type PartialEvent = Partial<Event>;

// Pick specific properties
type EventBasics = Pick<Event, 'eventId' | 'eventName'>;

// Omit specific properties
type EventWithoutId = Omit<Event, 'eventId'>;

// Make properties required
type RequiredEvent = Required<Event>;

// Union types
type Status = 'idle' | 'loading' | 'success' | 'error';
const status: Status = 'loading';

// Record type (object with string keys)
type EventMap = Record<string, Event>;
const eventsById: EventMap = {
  'event-1': event1,
  'event-2': event2,
};
```

---

## Domain Model Quick Reference

### Core Types

```typescript
// Event
interface Event {
  eventId: string;
  eventName: string;
  countryCode: string;
  eventDate?: string;
  tracks?: Track[];
  raceConfig?: RaceConfig;
  // ... more fields
}

// Track
interface Track {
  trackId: string;
  trackName: string;
  eventId: string;
  // ... more fields
}

// Race
interface Race {
  raceId: string;
  username: string;
  trackId: string;
  eventId: string;
  raceDuration?: number;
  laps?: Lap[];
  // ... more fields
}

// Lap
interface Lap {
  lapId: string;
  raceId: string;
  lapNumber: number;
  lapTime: number;
  resetCount: number;
  isValid: boolean;
}

// LeaderboardEntry
interface LeaderboardEntry {
  username: string;
  fastestLapTime: number;
  fastestAverageLap?: AverageLap;
  totalLaps: number;
  // ... more fields
}
```

---

## Common Issues and Solutions

### Issue 1: "Implicit any type"
**Problem:** `Parameter 'x' implicitly has an 'any' type`
**Solution:** Add explicit type annotation
```typescript
// ❌ Bad
const handleClick = (item) => { ... }

// ✅ Good
const handleClick = (item: Event) => { ... }
```

### Issue 2: "Property does not exist on type"
**Problem:** `Property 'eventName' does not exist on type 'Event | null'`
**Solution:** Use optional chaining or type guard
```typescript
// ❌ Bad
const name = event.eventName;

// ✅ Good
const name = event?.eventName;
// or
if (event) {
  const name = event.eventName;
}
```

### Issue 3: "Type 'X' is not assignable to type 'Y'"
**Problem:** Types don't match
**Solution:** Ensure types align or use type assertion carefully
```typescript
// ❌ Bad
const events: Event[] = response.data; // if response.data might be undefined

// ✅ Good
const events: Event[] = response.data?.events || [];
```

### Issue 4: "Cannot find module"
**Problem:** Import path not resolving
**Solution:** Use correct relative path or check tsconfig paths
```typescript
// ❌ Bad (if types is not in same directory)
import { Event } from './types';

// ✅ Good
import { Event } from '../types/domain';
// or with baseUrl configured
import { Event } from 'types/domain';
```

---

## TypeScript Configuration

Current `tsconfig.json` settings:
```json
{
  "compilerOptions": {
    "target": "ES6",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": "src"
  }
}
```

**Key settings:**
- `strict: true` - Enables all strict type checking
- `jsx: "react-jsx"` - Modern JSX transform (React 18+)
- `baseUrl: "src"` - Allows imports from src/ without ../../../

---

## Testing with TypeScript

```typescript
import { calculateMetrics } from './metricCalculations';
import { Race, Lap } from '../../../types';

describe('calculateMetrics', () => {
  it('should calculate fastest lap', () => {
    const race: Partial<Race> = {
      laps: [
        { lapTime: 1000, resetCount: 0, isValid: true } as Lap,
        { lapTime: 900, resetCount: 0, isValid: true } as Lap,
      ],
    };

    const result = calculateMetrics([race as Race]);
    expect(result.fastestLap).toBe(900);
  });
});
```

---

## ESLint Rules

Current TypeScript ESLint rules warn about:
- `@typescript-eslint/no-explicit-any` - Avoid using `any` type
- `@typescript-eslint/no-unused-vars` - Remove unused variables
- React hooks dependencies

**Disable specific rule for one line:**
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = complexLegacyObject;
```

---

## Resources

- **Full Migration Guide:** `TYPESCRIPT_MIGRATION_STATUS.md`
- **Type Definitions:** `src/types/`
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/intro.html
- **React TypeScript:** https://react-typescript-cheatsheet.netlify.app/
- **Cloudscape Design:** https://cloudscape.design/get-started/guides/typescript/
- **AWS Amplify:** https://docs.amplify.aws/lib/graphqlapi/typescript-support/q/platform/js/

---

## Verification Commands

```bash
# Check TypeScript compilation
npx tsc --noEmit

# Run ESLint
npx eslint --ext .ts,.tsx src/

# Run tests
npm test

# Build for production
npm run build
```

---

## Migration Status

✅ **89% Complete** (142 out of 155 files fully typed)
- 0 TypeScript compilation errors
- 100% test pass rate (40/40 tests)
- Production build working
- 13 files remaining (documented in TYPESCRIPT_MIGRATION_STATUS.md)

For detailed information on completing the remaining 13 files, see `TYPESCRIPT_MIGRATION_STATUS.md`.
