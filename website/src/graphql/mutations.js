/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const addEvent = /* GraphQL */ `
  mutation AddEvent($eventName: String!, $tracks: [TrackInput]) {
    addEvent(eventName: $eventName, tracks: $tracks) {
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
export const carActivation = /* GraphQL */ `
  mutation CarActivation(
    $eventId: ID!
    $eventName: String!
    $hostname: String!
  ) {
    carActivation(
      eventId: $eventId
      eventName: $eventName
      hostname: $hostname
    ) {
      activationCode
      activationId
      region
    }
  }
`;
export const deleteEvent = /* GraphQL */ `
  mutation DeleteEvent($eventId: String!) {
    deleteEvent(eventId: $eventId) {
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
export const updateEvent = /* GraphQL */ `
  mutation UpdateEvent(
    $eventId: String!
    $eventName: String
    $tracks: [TrackInput]
  ) {
    updateEvent(eventId: $eventId, eventName: $eventName, tracks: $tracks) {
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
