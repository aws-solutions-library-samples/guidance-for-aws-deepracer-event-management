# API Response Type Definitions - Usage Guide

## Overview

This file (`types/api-responses.ts`) contains comprehensive TypeScript type definitions for all API responses in the AWS DeepRacer Event Management application. These types are derived directly from the CDK infrastructure code (GraphQL schema definitions in `lib/constructs/`).

## Relationship with Domain Types

**Important**: This project has TWO sets of type definitions:

1. **`types/api-responses.ts`** (this file) - Types for API responses
   - Represents data **as it comes from the backend**
   - Derived from CDK GraphQL schema definitions
   - Use these for typing `API.graphql()` responses

2. **`types/domain.ts`** - Frontend domain model types
   - Represents data **as used in the application**
   - May include additional computed fields or transformations
   - Use these for component state and props

### Why Two Type Systems?

The frontend sometimes needs different representations than the backend provides:

| Field | API Response Type | Domain Type | Reason |
|-------|------------------|-------------|---------|
| `raceTimeInMin` | `number` | `string` | Frontend displays as string in forms |
| `lapTime` | `time` (Lap) | `lapTime` (domain.Lap) | Different field names for clarity |
| `userId` | `string` | `string` | Same - direct mapping |

### Transformation Pattern

```typescript
import { GetEventsResponse, Event as APIEvent } from '../types/api-responses';
import { Event as DomainEvent } from '../types/domain';

// Fetch from API
const apiResponse = await API.graphql(
  graphqlOperation(getEvents)
) as { data: GetEventsResponse['data'] };

const apiEvents: APIEvent[] = apiResponse.data.getEvents;

// Transform to domain model
const domainEvents: DomainEvent[] = apiEvents.map(apiEvent => ({
  ...apiEvent,
  raceConfig: {
    ...apiEvent.raceConfig,
    raceTimeInMin: String(apiEvent.raceConfig.raceTimeInMin), // number -> string
  }
}));

// Use domain model in component
setEvents(domainEvents);
```

## Overview (continued)

## Why These Types Exist

The challenge with typing API responses is that you don't always know the exact shape of the data returned from external APIs. However, in this project, we **own the backend** - the CDK code defines the GraphQL schema and Lambda resolvers, so we can create accurate types based on that source of truth.

## Source of Truth

The types in `api-responses.ts` are based on:

1. **GraphQL Schema Definitions** in CDK constructs:
   - `lib/constructs/events-manager.ts` → Event types
   - `lib/constructs/leaderboard.ts` → Leaderboard types
   - `lib/constructs/race-manager.ts` → Race and Lap types
   - `lib/constructs/models-manager.ts` → Model types
   - `lib/constructs/user-manager.ts` → User types
   - `lib/constructs/cars-manager.ts` → Car/Fleet types

2. **Lambda Function Implementations**:
   - `lib/lambdas/events_api/index.py` → Event CRUD operations
   - `lib/lambdas/leaderboard_api/index.py` → Leaderboard queries
   - `lib/lambdas/race_api/index.py` → Race operations
   - `lib/lambdas/models_api/index.py` → Model operations

## Usage Examples

### 1. Typing GraphQL Queries

#### Before (Untyped):
```typescript
const response = await API.graphql(
  graphqlOperation(getLeaderboard, { 
    eventId: eventId, 
    trackId: selectedTrack.trackId 
  })
);
// response is 'any' - no type safety!
const leaderboard = response.data.getLeaderboard;
```

#### After (Typed):
```typescript
import { GetLeaderboardResponse } from '../types/api-responses';

const response = await API.graphql(
  graphqlOperation(getLeaderboard, { 
    eventId: eventId, 
    trackId: selectedTrack.trackId 
  })
) as { data: GetLeaderboardResponse['data'] };

const leaderboard = response.data.getLeaderboard;
// Now TypeScript knows leaderboard has:
// - config: { leaderBoardTitle, leaderBoardFooter, sponsor }
// - entries: Array<LeaderboardEntry>
```

### 2. Typing Event API Calls

#### Fetching Events:
```typescript
import { GetEventsResponse, Event } from '../types/api-responses';

const response = await API.graphql(
  graphqlOperation(getEvents)
) as { data: GetEventsResponse['data'] };

const events: Event[] = response.data.getEvents;
// TypeScript now knows each event has:
// - eventId, eventName, typeOfEvent, eventDate
// - raceConfig: { raceTimeInMin, rankingMethod, etc. }
// - tracks: Track[]
```

#### Creating an Event:
```typescript
import { AddEventInput, AddEventResponse, TypeOfEvent, TrackType, RankingMethod } from '../types/api-responses';

const input: AddEventInput = {
  eventName: "Summer Championship",
  typeOfEvent: TypeOfEvent.OFFICIAL_TRACK_RACE,
  eventDate: "2025-06-15",
  sponsor: "AWS",
  countryCode: "US",
  tracks: [{
    trackId: "1",
    leaderBoardTitle: "Main Track",
    leaderBoardFooter: "Powered by AWS"
  }],
  raceConfig: {
    raceTimeInMin: 4,
    numberOfResetsPerLap: 3,
    trackType: TrackType.REINVENT_2023,
    rankingMethod: RankingMethod.BEST_LAP_TIME,
    maxRunsPerRacer: "unlimited",
    averageLapsWindow: 3
  }
};

const response = await API.graphql(
  graphqlOperation(addEvent, input)
) as { data: AddEventResponse['data'] };

const newEvent = response.data.addEvent;
```

### 3. Typing Race Operations

#### Adding a Race with Laps:
```typescript
import { AddRaceInput, AddRaceResponse, Lap } from '../types/api-responses';

const laps: AddRaceInput['laps'] = [
  {
    lapId: "1",
    time: 12.345,
    resets: 0,
    isValid: true,
    autTimerConnected: true,
    carName: "Car01"
  },
  {
    lapId: "2",
    time: 11.890,
    resets: 1,
    isValid: true,
    autTimerConnected: true,
    carName: "Car01"
  }
];

const input: AddRaceInput = {
  eventId: "evt-123",
  trackId: "1",
  userId: "user-456",
  racedByProxy: false,
  laps: laps,
  averageLaps: [{
    startLapId: 1,
    endLapId: 2,
    avgTime: 12.1175
  }]
};

const response = await API.graphql(
  graphqlOperation(addRace, input)
) as { data: AddRaceResponse['data'] };

const race = response.data.addRace;
```

### 4. Typing Model Queries

```typescript
import { GetAllModelsResponse, Model } from '../types/api-responses';

const response = await API.graphql(
  graphqlOperation(getAllModels, { limit: 50 })
) as { data: GetAllModelsResponse['data'] };

const models: Model[] = response.data.getAllModels.models;
const nextToken: string | undefined = response.data.getAllModels.nextToken;

// TypeScript knows each model has:
// - modelId, modelName, status
// - fileMetaData: { uploadedDateTime, fileName, fileSize }
// - optimizedUrl (optional)
```

### 5. Error Handling with Types

```typescript
import { GraphQLResponse, GraphQLError, GetEventsResponse } from '../types/api-responses';

try {
  const response = await API.graphql(
    graphqlOperation(getEvents)
  ) as GraphQLResponse<GetEventsResponse['data']>;

  if (response.errors && response.errors.length > 0) {
    const error: GraphQLError = response.errors[0];
    console.error(`GraphQL Error: ${error.message}`);
    console.error(`Error Code: ${error.extensions?.code}`);
    return;
  }

  if (response.data) {
    const events = response.data.getEvents;
    // Process events safely
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## Type Categories

### 1. Domain Types
Core data structures that represent business entities:
- `Event` - Event details and configuration
- `Race` - Race session with laps and averages
- `Lap` - Individual lap data
- `Leaderboard` - Leaderboard with config and entries
- `Model` - AI model metadata
- `User` - User account information
- `Car` - Physical car details
- `Fleet` - Fleet of cars

### 2. API Response Types
Wrapper types for GraphQL responses:
- `GetEventsResponse` - Response from getEvents query
- `AddEventResponse` - Response from addEvent mutation
- `GetLeaderboardResponse` - Response from getLeaderboard query
- `GetRacesResponse` - Response from getRaces query
- And more...

### 3. Input Types
Types for mutation arguments:
- `AddEventInput` - Arguments for adding an event
- `UpdateEventInput` - Arguments for updating an event
- `AddRaceInput` - Arguments for adding a race
- `UpdateRaceInput` - Arguments for updating a race

### 4. Enum Types
Constrained string values from GraphQL schema:
- `TrackType` - Track variations
- `RankingMethod` - Scoring methods
- `TypeOfEvent` - Event categories

## Enums Reference

### TrackType
```typescript
enum TrackType {
  REINVENT_2018 = 'REINVENT_2018',
  REINVENT_2019 = 'REINVENT_2019',
  REINVENT_2022 = 'REINVENT_2022',
  REINVENT_2023 = 'REINVENT_2023',
  FOREVER_RACEWAY = 'FOREVER_RACEWAY',
  SUMMIT_SPEEDWAY = 'SUMMIT_SPEEDWAY',
  ATOZ_SPEEDWAY = 'ATOZ_SPEEDWAY',
  OTHER = 'OTHER',
}
```

### RankingMethod
```typescript
enum RankingMethod {
  BEST_LAP_TIME = 'BEST_LAP_TIME',
  BEST_AVERAGE_LAP_TIME_X_LAP = 'BEST_AVERAGE_LAP_TIME_X_LAP',
}
```

### TypeOfEvent
```typescript
enum TypeOfEvent {
  PRIVATE_WORKSHOP = 'PRIVATE_WORKSHOP',
  PRIVATE_TRACK_RACE = 'PRIVATE_TRACK_RACE',
  OFFICIAL_WORKSHOP = 'OFFICIAL_WORKSHOP',
  OFFICIAL_TRACK_RACE = 'OFFICIAL_TRACK_RACE',
  OTHER = 'OTHER',
}
```

## Best Practices

### 1. Always Use Type Assertions for API.graphql()
```typescript
// ✅ Good
const response = await API.graphql(
  graphqlOperation(query, variables)
) as { data: ResponseType['data'] };

// ❌ Bad
const response = await API.graphql(
  graphqlOperation(query, variables)
); // Returns 'any'
```

### 2. Extract Types for Complex Structures
```typescript
// ✅ Good - Extract and reuse types
import { Lap, AverageLap } from '../types/api-responses';

interface RaceFormData {
  laps: Lap[];
  averages: AverageLap[];
}

// ❌ Bad - Inline types everywhere
const laps: Array<{
  lapId: string;
  time: number;
  // ... duplicate type definitions
}> = [];
```

### 3. Use Enums for Constrained Values
```typescript
// ✅ Good - Use enum
import { TrackType } from '../types/api-responses';
const trackType = TrackType.REINVENT_2023;

// ❌ Bad - Magic strings
const trackType = 'REINVENT_2023'; // Typo-prone
```

### 4. Handle Optional Fields Safely
```typescript
import { LeaderboardEntry } from '../types/api-responses';

const entry: LeaderboardEntry = getEntry();

// ✅ Good - Check optional fields
const lapTime = entry.fastestLapTime ?? 0;
const country = entry.countryCode || 'Unknown';

// ❌ Bad - Assume fields exist
const lapTime = entry.fastestLapTime; // Might be undefined
```

## Migration Strategy

To convert existing untyped API calls:

1. **Find the API call**:
   ```typescript
   const response = await API.graphql(graphqlOperation(getEvents));
   ```

2. **Identify the operation** (getEvents, addRace, updateEvent, etc.)

3. **Import the corresponding response type**:
   ```typescript
   import { GetEventsResponse } from '../types/api-responses';
   ```

4. **Add type assertion**:
   ```typescript
   const response = await API.graphql(
     graphqlOperation(getEvents)
   ) as { data: GetEventsResponse['data'] };
   ```

5. **Update variable types**:
   ```typescript
   const events: Event[] = response.data.getEvents;
   ```

## Keeping Types in Sync

When the backend API changes:

1. **Check CDK Schema** in `lib/constructs/*-manager.ts`
2. **Update Types** in `types/api-responses.ts`
3. **Run Type Check**: `npx tsc --noEmit`
4. **Fix Errors** in components using those types

## Common Patterns

### Pattern 1: Loading Data with useState
```typescript
import { Event } from '../types/api-responses';

const [events, setEvents] = useState<Event[]>([]);
const [loading, setLoading] = useState<boolean>(true);

useEffect(() => {
  const fetchEvents = async () => {
    const response = await API.graphql(
      graphqlOperation(getEvents)
    ) as { data: { getEvents: Event[] } };
    
    setEvents(response.data.getEvents);
    setLoading(false);
  };
  
  fetchEvents();
}, []);
```

### Pattern 2: Form Submission
```typescript
import { AddEventInput, TypeOfEvent } from '../types/api-responses';

const handleSubmit = async (formData: AddEventInput) => {
  try {
    const response = await API.graphql(
      graphqlOperation(addEvent, formData)
    ) as { data: { addEvent: Event } };
    
    console.log('Event created:', response.data.addEvent);
  } catch (error) {
    console.error('Failed to create event:', error);
  }
};
```

### Pattern 3: Subscription Handling
```typescript
import { Race } from '../types/api-responses';

const subscription = API.graphql(
  graphqlOperation(onAddedRace, { eventId, trackId })
).subscribe({
  next: ({ value }: any) => {
    const race: Race = value.data.onAddedRace;
    // Handle new race
  },
  error: (error: any) => {
    console.error('Subscription error:', error);
  }
});
```

## Additional Resources

- **CDK Schema Definitions**: `lib/constructs/events-manager.ts`, `lib/constructs/leaderboard.ts`, etc.
- **Lambda Implementations**: `lib/lambdas/*/index.py`
- **GraphQL Operations**: `website/src/graphql/queries.ts`, `mutations.ts`, `subscriptions.ts`
- **Existing Type Definitions**: `website/src/types/domain.ts`, `api.ts`, `graphql.ts`

## Summary

By using these API response types:

1. ✅ **Type Safety**: Catch errors at compile time, not runtime
2. ✅ **Autocomplete**: IDE suggestions for all fields
3. ✅ **Documentation**: Types serve as inline documentation
4. ✅ **Refactoring**: Safely rename fields and update all usages
5. ✅ **Confidence**: Know exactly what data structure to expect

These types are the **foundation** for full TypeScript adoption across the application, enabling safe refactoring and confident development.
