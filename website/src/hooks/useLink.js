import { useCallback } from 'react';
import { useNavigate } from 'react-router';

const useLink = () => {
  var navigate = useNavigate();
  return {
    handleFollow: useCallback(
      function (e) {
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
