import React from 'react';

// import { useTranslation } from 'react-i18next';
import Logo from '../assets/logo1024.png';
import styles from './header.module.css';
import { QrCode } from './qrCode';

const Header = ({ headerText, eventId, trackId, raceFormat, qrCodeVisible }) => {
  return (
    <div className={styles.headerRoot}>
      <img src={Logo} alt="DeepRacer Logo" className={styles.logo} />
      <div className={styles.headerText}>{headerText}</div>
      {qrCodeVisible === 'header' && <QrCode eventId={eventId} trackId={trackId} raceFormat={raceFormat}/>}
    </div>
  );
};

export { Header };
