import React from 'react';
import { useParams } from 'react-router-dom';

// import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import Logo from '../assets/logo.png';
import styles from './header.module.css';


const Header = ({ headerText, qrCodeVisible }) => {
  const urlParams = useParams();
  let eventId = urlParams.eventId;
  if (eventId == null) eventId = "";

  function createLandingPageHref() {


    console.log(`${window.location.origin}/landing-page/${eventId.toString()}`)
    return `${window.location.origin}/landing-page/${eventId.toString()}`;
  }

  return (
    <div className={styles.headerRoot}>
      <img src={Logo} alt="DeepRacer Logo" className={styles.logo} />
      <div className={styles.headerText}>{headerText}</div>
      {qrCodeVisible && (
        <div>
          <QRCodeSVG
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
      )}
    </div>
  );
};

export { Header };
