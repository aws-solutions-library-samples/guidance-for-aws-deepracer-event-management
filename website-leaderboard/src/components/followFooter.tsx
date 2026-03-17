import styles from './followFooter.module.css';
import { QrCode } from './qrCode';

interface FollowFooterProps {
  visible: boolean;
  eventId?: string;
  trackId?: string;
  raceFormat?: string;
  text?: string;
  qrCodeVisible?: boolean | string;
}

const FollowFooter = ({
  visible,
  eventId,
  trackId,
  raceFormat,
  text = 'Follow the race: #AWSDeepRacer',
  qrCodeVisible = false,
}: FollowFooterProps) => {
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
