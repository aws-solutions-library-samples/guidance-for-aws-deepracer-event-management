/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const addedEvent = /* GraphQL */ `
  subscription AddedEvent {
    addedEvent {
      createdAt
      eventId
      eventName
      tracks {
        trackId
        trackName
        trackTag
      }
    }
  }
`;
export const deletedEvent = /* GraphQL */ `
  subscription DeletedEvent {
    deletedEvent {
      createdAt
      eventId
      eventName
      tracks {
        trackId
        trackName
        trackTag
      }
    }
  }
`;
export const updatedEvent = /* GraphQL */ `
  subscription UpdatedEvent {
    updatedEvent {
      createdAt
      eventId
      eventName
      tracks {
        trackId
        trackName
        trackTag
      }
    }
  }
`;
