import React, { useEffect, useState } from 'react';
import { useShortcuts, ShortcutAction } from '../hooks/useShortcuts';

/**
 * A headless component that listens for WebHID devices (like Loupedeck, Tangent).
 * Currently mocks the integration behind feature-detection guard.
 */
export function WebHIDManager({ onAction }: { onAction: (a: ShortcutAction) => void }) {
   const [supported, setSupported] = useState(false);
   const [connected, setConnected] = useState(false);

   useEffect(() => {
      if ('hid' in navigator) {
         setSupported(true);
         const nav = navigator as any;
         
         const handleConnect = (e: any) => {
            console.log('HID device connected', e.device);
            setConnected(true);
         };

         const handleDisconnect = (e: any) => {
            console.log('HID device disconnected', e.device);
            setConnected(false);
         };

         nav.hid.addEventListener('connect', handleConnect);
         nav.hid.addEventListener('disconnect', handleDisconnect);

         return () => {
            nav.hid.removeEventListener('connect', handleConnect);
            nav.hid.removeEventListener('disconnect', handleDisconnect);
         };
      }
   }, []);

   // Optional: We can add a hidden connect button if we wanted user to authorize,
   // but since it's a headless manager, we just report status internally or let user use Settings.
   return null;
}
