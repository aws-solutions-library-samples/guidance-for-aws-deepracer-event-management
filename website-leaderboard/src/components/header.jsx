import React from 'react';
import { useParams } from 'react-router-dom';

// import { useTranslation } from 'react-i18next';
import {QrCode} from './qrCode';
import Logo from '../assets/logo1024.png';
import styles from './header.module.css';


const Header = ({ headerText, eventId, qrCodeVisible }) => {


  return (
    <div className={styles.headerRoot}>
      <img src={Logo} alt="DeepRacer Logo" className={styles.logo} />
      <div className={styles.headerText}>{headerText}</div>
      {qrCodeVisible === "header" && (<QrCode eventId={eventId}/>)}
    </div>
  );
};

export { Header };
