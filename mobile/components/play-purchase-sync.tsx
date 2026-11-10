import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { playBilling, playBillingAvailable } from '@/services/play-billing-service';
import type { PurchaseOutcome } from '@/services/play-billing-flow';
import { useAuth } from '@/store/auth';

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
  const userId=user?.id??null;
  const ready=!!userId&&!!user?.onboardingCompleted;

  useEffect(()=>{
    if(!playBillingAvailable||!ready)return;
    const apply=(outcome:PurchaseOutcome)=>{
      if(outcome.kind!=='none'){update(outcome.user);void cache.invalidateQueries();}
    };
    if(synced.current!==userId) {
      synced.current=userId;
      void playBilling.restore(true).then(apply).catch(()=>{});
    }
    return playBilling.onPurchasesUpdated(purchases=>{
      void playBilling.handleUpdates(purchases).then(apply).catch(()=>{});
    });
  },[ready,userId,update,cache]);

  return null;
}
