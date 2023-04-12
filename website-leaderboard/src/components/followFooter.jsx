import React from 'react';
import styles from './followFooter.module.css';
import { QrCode } from './qrCode';

const FollowFooter = ({ visible, eventId, text = 'Follow the race: #AWSDeepRacer', qrCodeVisible = "" }) => {
    return <>{visible &&
      <div className={styles.footerRoot}>
        <div>{text}</div>
        <div className={styles.qrCodeDiv}> {qrCodeVisible === "footer" && (<QrCode eventId={eventId}/>)} </div>
      </div>}
    </>;
};

export { FollowFooter };
