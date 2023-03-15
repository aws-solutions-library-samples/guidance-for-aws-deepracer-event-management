import React from 'react';

// import { useTranslation } from 'react-i18next';
import Logo from '../assets/logo.png';
import styles from './header.module.css';
import { QRCodeSVG } from 'qrcode.react';

const Header = ({ headerText }) => {
    return (
        <div className={styles.headerRoot}>
            <img src={Logo} alt="DeepRacer Logo" className={styles.logo} />
            <div className={styles.headerText}>{headerText}</div>
          <div>
            <QRCodeSVG value={window.location.href}
                       level='M'
                       imageSettings={{
                         src: Logo,
                         excavate: false,
                         height: 40,
                         width: 40,
                       }}
            />
          </div>
        </div>
    );
};

export { Header };
