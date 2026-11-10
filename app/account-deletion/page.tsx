// ============================================================
// app/account-deletion/page.tsx — Account & data deletion policy (public)
// ============================================================
// The URL for Play Console → App content → Data safety → "Delete account URL":
//   https://rsdeducation.vercel.app/account-deletion
//
// Google's requirements for that page, and where each is met:
//   - names the app / developer shown on the store listing  → intro
//   - prominently lists the steps to request deletion       → "How to delete"
//   - says which data is deleted and which is kept          → two sections
//   - states any additional retention period                → "What we keep"
// Public (not in proxy.ts PROTECTED_WEB_ROUTES): reviewers and signed-out
// users must be able to read it. The deletion itself happens at
// /delete-account (sign-in required) or in the app.
//
// Keep this in step with deleteUserAccount() in lib/auth/db.ts and the
// ON DELETE rules in supabase/migrations.
// ============================================================

import type { Metadata } from 'next'
import LegalPage, { type LegalDocument } from '@/app/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Account deletion — RSD Education',
  description:
    'How to delete your RSD Education account and data: steps in the app, on the website or by email, what is deleted and what is kept.',
}

const EMAIL = 'rsdeducationplatform@gmail.com'

const english: LegalDocument = {
  title: 'Account and data deletion',
  updated: 'Last updated 10 November 2026',
  intro: [
    'This page explains how to delete your account in RSD Education (the "RSD Education" Android app on Google Play and the rsdeducation website, by the RSD Education developer), what is deleted, and what is kept. You can delete your account yourself at any time — no reason is needed and there is no charge.',
  ],
  action: { href: '/delete-account', label: 'Delete my account' },
  sections: [
    {
      heading: 'How to delete your account',
      items: [
        'In the app: open Profile → Account → Delete account, and confirm twice.',
        'On the website: open rsdeducation.vercel.app/delete-account, sign in with the same Google account (or email login) you use in the app, type DELETE and press Delete my account. This works without installing the app.',
        `By email: write to ${EMAIL} from the email address of your account with the subject "Delete my account". We confirm the request came from that address and delete the account within 7 days, then reply to tell you it is done.`,
        'Deletion from the app or website happens immediately and cannot be undone. Signing in again later with the same Google account starts a new, empty account.',
      ],
    },
    {
      heading: 'If you bought Pro on Google Play',
      body: [
        'Pro bought on Google Play is a one-time pass and does not renew, so there is nothing to cancel and you will not be charged again. Any remaining Pro time ends when you delete your account and is not refunded.',
      ],
    },
    {
      heading: 'What is deleted',
      items: [
        'Your profile: name, email address, profile picture, study medium and learning goals.',
        'For an email sign-in account we created for you: its stored password hash.',
        'Your practice sessions, answers, scores, weak-topic data and progress.',
        'Your mock test attempts, results and leaderboard entries.',
        'Tests you created in My Tests, including uploaded questions and results.',
        'Your question reports (with any note you wrote), the record of study files you opened, sign-in sessions, devices and account security log.',
        'Your Google Play purchase records held by us, and any remaining Pro access.',
      ],
    },
    {
      heading: 'What we keep, and for how long',
      items: [
        'Website purchases: the Razorpay payment reference, order reference, plan length and date of each purchase, no longer linked to your name or email. Kept as long as Indian accounting and tax law requires us to keep payment records.',
        'Google Play notices: order references and dates that Google sent us about purchases, not linked to your name or email, may remain in our logs.',
        'Backups: deleted data may remain in our database provider\'s routine backups for up to 30 days, until those backups are overwritten. Backups are not used to restore individual accounts.',
        'Google and Razorpay keep their own records of payments made through them, under their own policies. For your Google account data, see Google\'s own settings.',
      ],
    },
    {
      heading: 'Deleting some data without deleting your account',
      body: [
        `To delete only part of your data — for example your practice history — while keeping your account, email ${EMAIL} from your account's email address and tell us what to remove. We complete it within 7 days.`,
      ],
    },
    {
      heading: 'Questions',
      body: [
        `For anything about deletion or your data, contact ${EMAIL}. Our Privacy Policy explains what we collect and why.`,
      ],
    },
  ],
}

const telugu: LegalDocument = {
  title: 'ఖాతా మరియు డేటా తొలగింపు',
  updated: 'చివరిగా నవీకరించబడింది: 10 నవంబర్ 2026',
  intro: [
    'RSD Education లో (గూగుల్ ప్లేలోని "RSD Education" ఆండ్రాయిడ్ యాప్ మరియు rsdeducation వెబ్‌సైట్, RSD Education డెవలపర్ ద్వారా) మీ ఖాతాను ఎలా తొలగించాలో, ఏమి తొలగించబడుతుందో, ఏమి ఉంచబడుతుందో ఈ పేజీ వివరిస్తుంది. మీరు ఎప్పుడైనా మీ ఖాతాను మీరే తొలగించవచ్చు — కారణం చెప్పనవసరం లేదు, ఎలాంటి రుసుము లేదు.',
  ],
  action: { href: '/delete-account', label: 'నా ఖాతాను తొలగించు' },
  sections: [
    {
      heading: 'ఖాతాను ఎలా తొలగించాలి',
      items: [
        'యాప్‌లో: ప్రొఫైల్ → Account → Delete account తెరిచి, రెండుసార్లు నిర్ధారించండి.',
        'వెబ్‌సైట్‌లో: rsdeducation.vercel.app/delete-account తెరిచి, యాప్‌లో వాడే అదే గూగుల్ ఖాతాతో (లేదా ఈమెయిల్ లాగిన్‌తో) సైన్ ఇన్ చేసి, DELETE అని టైప్ చేసి Delete my account నొక్కండి. దీనికి యాప్ ఇన్‌స్టాల్ చేయనవసరం లేదు.',
        `ఈమెయిల్ ద్వారా: మీ ఖాతా ఈమెయిల్ చిరునామా నుండి ${EMAIL} కు "Delete my account" అనే విషయంతో రాయండి. అభ్యర్థన ఆ చిరునామా నుండే వచ్చిందని నిర్ధారించి, 7 రోజుల్లో ఖాతాను తొలగించి, పూర్తయిందని మీకు జవాబిస్తాము.`,
        'యాప్ లేదా వెబ్‌సైట్ నుండి తొలగింపు వెంటనే జరుగుతుంది, తిరిగి పొందలేము. తర్వాత అదే గూగుల్ ఖాతాతో మళ్లీ సైన్ ఇన్ చేస్తే కొత్త, ఖాళీ ఖాతా మొదలవుతుంది.',
      ],
    },
    {
      heading: 'గూగుల్ ప్లేలో Pro కొన్నట్లయితే',
      body: [
        'గూగుల్ ప్లేలో కొన్న Pro ఒక్కసారి చెల్లించే పాస్ — ఇది రెన్యూ కాదు, కాబట్టి రద్దు చేయాల్సింది ఏమీ లేదు, మళ్లీ డబ్బు కట్ కాదు. ఖాతాను తొలగిస్తే మిగిలిన Pro సమయం ముగుస్తుంది; దానికి రీఫండ్ ఉండదు.',
      ],
    },
    {
      heading: 'ఏమి తొలగించబడుతుంది',
      items: [
        'మీ ప్రొఫైల్: పేరు, ఈమెయిల్ చిరునామా, ప్రొఫైల్ ఫోటో, చదువు మాధ్యమం మరియు లక్ష్యాలు.',
        'మేము మీ కోసం తయారుచేసిన ఈమెయిల్ సైన్ ఇన్ ఖాతా అయితే: నిల్వ ఉన్న పాస్‌వర్డ్ హాష్.',
        'మీ ప్రాక్టీస్ సెషన్లు, సమాధానాలు, స్కోర్లు, బలహీన అంశాల డేటా మరియు పురోగతి.',
        'మీ మాక్ టెస్ట్ ప్రయత్నాలు, ఫలితాలు మరియు లీడర్‌బోర్డ్ ఎంట్రీలు.',
        'My Tests లో మీరు తయారుచేసిన టెస్టులు — అప్‌లోడ్ చేసిన ప్రశ్నలు మరియు ఫలితాలతో సహా.',
        'మీ ప్రశ్న నివేదికలు (మీరు రాసిన వివరణతో సహా), మీరు తెరిచిన చదువు ఫైళ్ల రికార్డు, సైన్ ఇన్ సెషన్లు, పరికరాలు మరియు ఖాతా భద్రతా లాగ్.',
        'మా వద్ద ఉన్న మీ గూగుల్ ప్లే కొనుగోలు రికార్డులు, మరియు మిగిలిన Pro ప్రవేశం.',
      ],
    },
    {
      heading: 'ఏమి ఉంచుతాము, ఎంతకాలం',
      items: [
        'వెబ్‌సైట్ కొనుగోళ్లు: ప్రతి కొనుగోలుకు సంబంధించిన Razorpay చెల్లింపు గుర్తింపు, ఆర్డర్ గుర్తింపు, ప్లాన్ కాలవ్యవధి మరియు తేదీ — మీ పేరు లేదా ఈమెయిల్‌తో సంబంధం లేకుండా. భారత లెక్కలు మరియు పన్ను చట్టాలు చెల్లింపు రికార్డులను ఎంతకాలం ఉంచమంటాయో అంతకాలం ఉంచుతాము.',
        'గూగుల్ ప్లే నోటీసులు: కొనుగోళ్ల గురించి గూగుల్ పంపిన ఆర్డర్ గుర్తింపులు మరియు తేదీలు — మీ పేరు లేదా ఈమెయిల్‌తో సంబంధం లేకుండా — మా లాగ్‌లలో ఉండవచ్చు.',
        'బ్యాకప్‌లు: తొలగించిన డేటా మా డేటాబేస్ ప్రదాత యొక్క సాధారణ బ్యాకప్‌లలో 30 రోజుల వరకు ఉండవచ్చు, ఆ బ్యాకప్‌లు తిరిగి రాయబడే వరకు. వ్యక్తిగత ఖాతాలను తిరిగి తెచ్చేందుకు బ్యాకప్‌లను వాడము.',
        'గూగుల్ మరియు Razorpay తమ ద్వారా జరిగిన చెల్లింపుల రికార్డులను తమ సొంత విధానాల ప్రకారం ఉంచుకుంటాయి. మీ గూగుల్ ఖాతా డేటా కోసం గూగుల్ సెట్టింగ్‌లను చూడండి.',
      ],
    },
    {
      heading: 'ఖాతాను ఉంచి కొంత డేటా మాత్రమే తొలగించడం',
      body: [
        `ఖాతాను ఉంచుకుని కొంత డేటా మాత్రమే — ఉదాహరణకు ప్రాక్టీస్ చరిత్ర — తొలగించాలంటే, మీ ఖాతా ఈమెయిల్ నుండి ${EMAIL} కు ఏమి తీసివేయాలో రాయండి. 7 రోజుల్లో పూర్తి చేస్తాము.`,
      ],
    },
    {
      heading: 'ప్రశ్నలు',
      body: [
        `తొలగింపు లేదా మీ డేటా గురించి ఏదైనా ఉంటే ${EMAIL} కు సంప్రదించండి. మేము ఏమి సేకరిస్తామో, ఎందుకో గోప్యతా విధానం వివరిస్తుంది.`,
      ],
    },
  ],
}

export default function AccountDeletionPage() {
  return <LegalPage english={english} telugu={telugu} />
}
