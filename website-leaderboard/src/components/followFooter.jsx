import React from 'react';
import styles from './followFooter.module.css';
import { QrCode } from './qrCode';

const FollowFooter = ({
  visible,
  eventId,
  trackId,
  raceFormat,
  text = 'Follow the race: #AWSDeepRacer',
  qrCodeVisible = '',
}) => {
  return (
    <>
      {visible && (
        <div className={styles.footerRoot}>
          <div>{text}</div>
          <div className={styles.qrCodeDiv}>
            {' '}
            {qrCodeVisible === 'footer' && <QrCode eventId={eventId} trackId={trackId} raceFormat={raceFormat} />}{' '}
          </div>
        </div>
      )}
    </>
  );
};

export { FollowFooter };
