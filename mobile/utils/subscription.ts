import type { PublicUser } from '../types/auth';

export function hasActiveSubscription(user:PublicUser|null|undefined,now=Date.now()) {
  return !!user&&user.accountType==='PREMIUM'&&user.subscriptionStatus==='ACTIVE'&&
    (!user.subscriptionExpiresAt||Date.parse(user.subscriptionExpiresAt)>now);
}
export function formatPrice(paise:number) {
  return `₹${(paise/100).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
}
export function subscriptionDate(value:string|null|undefined) {
  if(!value||!Number.isFinite(Date.parse(value)))return null;
  return new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
}
