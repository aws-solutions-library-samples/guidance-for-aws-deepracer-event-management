import React from 'react';
import styles from './followFooter.module.css';

const FollowFooter = ({ visible, text = 'Follow the race: #AWSDeepRacer' }) => {
    return <>{visible && <div className={styles.footerRoot}>{text}</div>}</>;
};

export { FollowFooter };
