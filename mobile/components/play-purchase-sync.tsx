import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { playBilling, playBillingAvailable } from '@/services/play-billing-service';
import type { PurchaseOutcome } from '@/services/play-billing-flow';
import { useAuth } from '@/store/auth';

const RESYNC_MS=2*60_000;

/**
 * Google Play build only. Renders nothing.
 *  - Once per signed-in session: re-sends this account's Play subscriptions to the
 *    server, so a purchase whose verify call was lost (app killed, offline) is still
 *    confirmed and acknowledged, and renewals show up even if a notification was missed.
 *  - Listens for purchases that finish outside the purchase sheet (pending UPI / cash).
 */
export function PlayPurchaseSync() {
  const {user,update}=useAuth();
  const cache=useQueryClient();
  const synced=useRef<string|null>(null);
  const lastSync=useRef(0);
  const userId=user?.id??null;
  const ready=!!userId&&!!user?.onboardingCompleted;

  useEffect(()=>{
    if(!playBillingAvailable||!ready)return;
    const apply=(outcome:PurchaseOutcome)=>{
      if(outcome.kind!=='none'){update(outcome.user);void cache.invalidateQueries();}
    };
    const sync=()=>{lastSync.current=Date.now();void playBilling.restore(true).then(apply).catch(()=>{});};
    if(synced.current!==userId) {
      synced.current=userId;
      sync();
    }
    // Back in the app (for example the connection returned after a payment):
    // send this account's purchases again, at most every 2 minutes.
    const foreground=AppState.addEventListener('change',state=>{
      if(state==='active'&&Date.now()-lastSync.current>RESYNC_MS)sync();
    });
    const updates=playBilling.onPurchasesUpdated(purchases=>{
      void playBilling.handleUpdates(purchases).then(apply).catch(()=>{});
    });
    return ()=>{foreground.remove();updates();};
  },[ready,userId,update,cache]);

  return null;
}
