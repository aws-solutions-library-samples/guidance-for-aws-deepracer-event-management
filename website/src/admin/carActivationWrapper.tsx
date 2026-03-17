import React, { useEffect, useState } from 'react';

// Import the original car activation component
import { AdminCarActivation as OriginalCarActivation } from './carActivationOriginal';

// Browser capability detection using safe feature checks only
const detectBrowserCapabilities = (): boolean => {
  try {
    return (
      typeof Promise !== 'undefined' &&
      typeof fetch !== 'undefined' &&
      typeof Object.assign !== 'undefined' &&
      typeof Array.prototype.find !== 'undefined' &&
      typeof String.prototype.includes !== 'undefined' &&
      typeof Symbol !== 'undefined' &&
      typeof Map !== 'undefined' &&
      typeof Set !== 'undefined'
    );
  } catch (error) {
    return false;
  }
};

// User agent based detection as fallback
const isLegacyBrowser = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Firefox versions before 85 (released January 2021)
  const firefoxMatch = userAgent.match(/firefox\/(\d+)/);
  if (firefoxMatch && parseInt(firefoxMatch[1]) < 85) {
    return true;
  }

  // Chrome versions before 88 (released January 2021)
  const chromeMatch = userAgent.match(/chrome\/(\d+)/);
  if (chromeMatch && parseInt(chromeMatch[1]) < 88) {
    return true;
  }

  // Safari versions before 14 (released September 2020)
  const safariMatch = userAgent.match(/version\/(\d+).*safari/);
  if (safariMatch && parseInt(safariMatch[1]) < 14) {
    return true;
  }

  // Edge versions before 88 (released January 2021)
  const edgeMatch = userAgent.match(/edg\/(\d+)/);
  if (edgeMatch && parseInt(edgeMatch[1]) < 88) {
    return true;
  }

  return false;
};

const AdminCarActivationWrapper: React.FC = () => {
  const [shouldUseLegacy, setShouldUseLegacy] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for force legacy mode via URL parameter (for testing)
    const urlParams = new URLSearchParams(window.location.search);
    const forceLegacy = urlParams.get('legacy') === 'true';
    
    // Perform browser detection
    const isLegacy = forceLegacy || !detectBrowserCapabilities() || isLegacyBrowser();
    setShouldUseLegacy(isLegacy);

    // If legacy browser detected, redirect to static HTML page
    if (isLegacy) {
      // Add a small delay to prevent flash of React content
      setTimeout(() => {
        window.location.href = '/car-activation-legacy.html';
      }, 100);
    }
  }, []);

  // Show loading state while detecting
  if (shouldUseLegacy === null) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div>Loading car activation...</div>
      </div>
    );
  }

  // If legacy browser, show a fallback message (shouldn't normally be seen due to redirect)
  if (shouldUseLegacy) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h2>Redirecting to Legacy Interface...</h2>
        <p>Your browser requires the simplified car activation interface.</p>
        <p>If you are not redirected automatically, <a href="/car-activation-legacy.html">click here</a>.</p>
      </div>
    );
  }

  // Modern browser - render the full React component
  return <OriginalCarActivation />;
};

export { AdminCarActivationWrapper as AdminCarActivation };