import { fetchAuthSession, getCurrentUser, signOut, updatePassword } from 'aws-amplify/auth';

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
    const groups: string[] =
        (accessToken?.payload?.['cognito:groups'] as string[] | undefined) ?? [];

    return {
        username: user.username,
        sub: user.userId, // v6: userId is the sub
        identityId: session.identityId ?? '',
        jwtToken: accessToken?.toString() ?? '',
        groups,
    };
};

/**
 * Sign the current user out.
 */
export const authSignOut = async (): Promise<void> => {
    await signOut();
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
