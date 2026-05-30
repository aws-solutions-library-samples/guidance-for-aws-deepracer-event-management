import { fetchAuthSession, getCurrentUser, signOut, updatePassword } from 'aws-amplify/auth';
import { graphqlQuery } from '../graphql/graphqlHelpers';
import { getRacerProfile } from '../graphql/queries';

/**
 * Authenticated user information returned by the Auth helpers.
 * Centralises all Auth access patterns to make future Amplify
 * version upgrades a single-file change.
 */
export interface AuthUser {
  /** Cognito username */
  username: string;
  /** Cognito user sub (unique ID, used for S3 paths) */
  sub: string;
  /** Cognito identity pool ID */
  identityId: string;
  /** JWT access token (used for REST API calls) */
  jwtToken: string;
  /** Cognito user groups (e.g. ['admin', 'operator']) */
  groups: string[];
  /** Display name: custom:racerName → preferred_username → username */
  displayName: string;
  /** All Cognito user attributes (standard + custom) */
  attributes: Record<string, string>;
}

/**
 * Get the current authenticated user's information.
 * Combines getCurrentUser() and fetchAuthSession() (Amplify v6)
 * into a single typed response.
 */
export const getCurrentAuthUser = async (): Promise<AuthUser> => {
  const user = await getCurrentUser();
  const session = await fetchAuthSession();

  const accessToken = session.tokens?.accessToken;
  const idToken = session.tokens?.idToken;
  const groups: string[] = (accessToken?.payload?.['cognito:groups'] as string[] | undefined) ?? [];

  // Extract attributes from the ID token payload — already in memory after
  // fetchAuthSession(), so no extra Cognito API call is needed.
  // Cognito embeds all standard and custom user attributes in the ID token;
  // only string values are kept (this naturally excludes numeric JWT claims
  // such as exp/iat and array claims such as cognito:groups).
  const idPayload = (idToken?.payload ?? {}) as Record<string, unknown>;
  const attributes: Record<string, string> = Object.fromEntries(
    Object.entries(idPayload).filter((e): e is [string, string] => typeof e[1] === 'string')
  );

  return {
    username: user.username,
    sub: user.userId, // v6: userId is the sub
    identityId: session.identityId ?? '',
    jwtToken: accessToken?.toString() ?? '',
    groups,
    attributes,
    displayName:
      attributes['custom:racerName'] || attributes['preferred_username'] || user.username,
  };
};

/**
 * Lightweight alternative to getCurrentAuthUser() that only resolves the
 * current user's Cognito groups — no fetchUserAttributes() round-trip.
 * Use this in hooks that only need permission checks (e.g. usePermissions).
 */
export const getAuthGroups = async (): Promise<string[]> => {
  const session = await fetchAuthSession();
  const accessToken = session.tokens?.accessToken;
  return (accessToken?.payload?.['cognito:groups'] as string[] | undefined) ?? [];
};

/**
 * Sign the current user out.
 */
export const authSignOut = async (): Promise<void> => {
  await signOut();
};

export interface RacerProfileData {
  username: string;
  avatarConfig: string | null;
  highlightColour: string | null;
  updatedAt: string | null;
}

/**
 * Fetch the current user's racer profile (avatar + highlight colour) from the
 * RacerProfile DynamoDB table via AppSync. Returns null fields when no profile
 * has been saved yet.
 */
export const getCurrentRacerProfile = async (): Promise<RacerProfileData | null> => {
  const authUser = await getCurrentAuthUser();
  const data = await graphqlQuery<{ getRacerProfile: RacerProfileData | null }>(getRacerProfile, {
    username: authUser.username,
  });
  return data?.getRacerProfile ?? null;
};

/**
 * Change the current user's password.
 * @param oldPassword - Current password
 * @param newPassword - New password
 */
export const authChangePassword = async (
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  await updatePassword({ oldPassword, newPassword });
};
