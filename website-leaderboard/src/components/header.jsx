import React from 'react';

// import { useTranslation } from 'react-i18next';
import Logo from '../assets/logo.png';
import styles from './header.module.css';

const Header = ({ headerText }) => {
    return (
        <div className={styles.headerRoot}>
            <img src={Logo} alt="DeepRacer Logo" className={styles.logo} />
            <div className={styles.headerText}>{headerText}</div>
        </div>
    );
};

export { Header };
