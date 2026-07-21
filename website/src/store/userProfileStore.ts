import { initStore } from './store';
import { GlobalState, UserProfileState } from './storeTypes';

/**
 * Per-user racer profile slice. Holds the current user's avatar config
 * and highlight colour so the TopNav mini-avatar and any other
 * consumers re-render together when the user saves a change in
 * AvatarBuilder.
 *
 * The initial hydration still happens in `topNav.tsx` (a single
 * getRacerProfile fetch on mount). Subsequent updates flow through
 * `SET_USER_PROFILE` from wherever the racer profile is mutated.
 */
const configureStore = (): void => {
  const actions = {
    SET_USER_PROFILE: (
      curState: GlobalState,
      patch: Partial<UserProfileState>
    ): Partial<GlobalState> => {
      const current = curState.userProfile ?? { avatarConfig: null, highlightColour: null };
      return { userProfile: { ...current, ...patch } };
    },
  };

  initStore(actions, {
    userProfile: { avatarConfig: null, highlightColour: null },
  });
};

export default configureStore;
