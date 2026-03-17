import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/**
 * Event detail for link follow events from Cloudscape components
 */
interface LinkFollowDetail {
  href?: string;
  external?: boolean;
}

/**
 * Link follow event structure
 */
interface LinkFollowEvent {
  detail: LinkFollowDetail;
  preventDefault: () => void;
}

/**
 * Return type for useLink hook
 */
interface UseLinkReturn {
  handleFollow: (event: LinkFollowEvent) => void;
}

/**
 * Custom hook for handling internal navigation with Cloudscape link components
 */
const useLink = (): UseLinkReturn => {
  const navigate = useNavigate();
  return {
    handleFollow: useCallback(
      function (e: LinkFollowEvent) {
        if (e.detail.external === true || typeof e.detail.href === 'undefined') {
          return;
        }
        e.preventDefault();
        navigate(e.detail.href);
      },
      [navigate]
    ),
  };
};

export default useLink;
