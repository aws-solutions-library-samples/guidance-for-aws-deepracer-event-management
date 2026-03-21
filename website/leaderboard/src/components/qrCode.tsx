import { QRCodeSVG } from 'qrcode.react';
import styles from './qrCode.module.css';
// using large 1024px logo because we load it as part of leaderboard already
import Logo from '../assets/logo1024.png';

const QrCode = ({ eventId, trackId, raceFormat }) => {
  function createLandingPageHref() {
    const href = `${window.location.origin}/landing-page/${eventId.toString()}/?scroll=false&track=${trackId}&format=${raceFormat}`; // 
    console.debug(href);
    return href;
  }

  return (
    <div>
      <QRCodeSVG
        className={styles.qrCode}
        value={createLandingPageHref()}
        level="M"
        imageSettings={{
          src: Logo,
          excavate: false,
          height: 40,
          width: 40,
        }}
      />
    </div>
  );
};

export { QrCode };
