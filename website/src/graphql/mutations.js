/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const addEvent = /* GraphQL */ `
  mutation AddEvent($eventName: String!, $tracks: [TrackInput]) {
    addEvent(eventName: $eventName, tracks: $tracks) {
      createdAt
      eventName
      id
      tracks {
        id
        tag
        trackName
      }
    }
  }
`;
export const addTrack = /* GraphQL */ `
  mutation AddTrack(
    $eventId: String!
    $trackName: String!
    $trackTag: String!
  ) {
    addTrack(eventId: $eventId, trackName: $trackName, trackTag: $trackTag) {
      id
      tag
      trackName
    }
  }
`;
export const deleteEvent = /* GraphQL */ `
  mutation DeleteEvent($id: String!) {
    deleteEvent(id: $id) {
      createdAt
      eventName
      id
      tracks {
        id
        tag
        trackName
      }
    }
  }
`;
export const deleteTrack = /* GraphQL */ `
  mutation DeleteTrack($eventId: String!, $id: String!) {
    deleteTrack(eventId: $eventId, id: $id) {
      id
      tag
      trackName
    }
  }
`;
export const updateEvent = /* GraphQL */ `
  mutation UpdateEvent(
    $eventName: String
    $id: String!
    $tracks: [TrackInput]
  ) {
    updateEvent(eventName: $eventName, id: $id, tracks: $tracks) {
      createdAt
      eventName
      id
      tracks {
        id
        tag
        trackName
      }
    }
  }
`;
export const updateTrack = /* GraphQL */ `
  mutation UpdateTrack($id: String!, $trackName: String, $trackTag: String) {
    updateTrack(id: $id, trackName: $trackName, trackTag: $trackTag) {
      id
      tag
      trackName
    }
  }
`;
