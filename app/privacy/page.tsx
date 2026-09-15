// ============================================================
// app/privacy/page.tsx — Privacy Policy
// ============================================================
// Written from the schema rather than from a template: the tables behind this
// are users, devices, sessions, security_events and payment_orders, and the
// policy says what is actually in them. Two facts are worth stating plainly
// because they are unusually good and most policies bury them — IP addresses
// are stored hashed, never raw, and no card detail ever reaches this server.
// ============================================================

import type { Metadata } from 'next'
import LegalPage, { type LegalDocument } from '@/app/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy — rsdeducation',
  description:
    'What rsdeducation collects, why, who it is shared with, and how to have it deleted.',
}

const english: LegalDocument = {
  title: 'Privacy Policy',
  updated: 'Last updated 15 September 2026',
  intro: [
    'This explains what rsdeducation collects about you, why, and what you can do about it. It describes what the application actually stores, not what a policy template would say.',
  ],
  sections: [
    {
      heading: 'What we collect',
      items: [
        'From Google, when you sign in: your name, email address and profile picture. We never receive or ask for your Google password.',
        'What you tell us during onboarding: your preferred medium (Telugu or English) and your learning goals.',
        'Your study activity: which questions you practised, what you answered, your mock test attempts, scores, time taken and topic performance.',
        'Device and session information: a device identifier, your browser or app user agent, and the platform you signed in from. This is what lets you sign out of other devices.',
        'A hashed form of your IP address. We store a one-way hash, not the address itself — it is used for rate limiting and to spot suspicious sign-ins, and it cannot be turned back into your IP.',
        'Payment records: the plan, amount, coupon used, and the order and payment identifiers returned by Razorpay.',
      ],
    },
    {
      heading: 'What we never collect',
      items: [
        'Your card number, CVV, UPI PIN or bank credentials. Payments happen inside Razorpay; those details never reach our servers.',
        'Your Google password.',
        'Your precise location, contacts, photos or files.',
      ],
    },
    {
      heading: 'Why we collect it',
      items: [
        'To sign you in and keep you signed in across your devices.',
        'To show your practice history, scores and weak topics, and to decide which module unlocks next.',
        'To give you access to the plan you paid for, and to support you if a payment goes wrong.',
        'To keep accounts secure — detecting unusual sign-ins, limiting repeated attempts, and letting you end sessions on devices you no longer use.',
      ],
    },
    {
      heading: 'Who else sees it',
      body: [
        'We do not sell your data and we do not share it for advertising. It reaches these service providers only because the platform runs on them:',
      ],
      items: [
        'Google — sign-in only.',
        'Supabase — the database where your account and study records are stored.',
        'Razorpay — payment processing. They handle your payment details under their own policy.',
        'Vercel — hosting and delivery of the application.',
        'Upstash — a temporary cache used for rate limiting and to serve mock papers quickly.',
        'We will also disclose information if the law requires it.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'Your account and study history stay while your account exists, because that record is the point of the product — it is how your progress survives changing phones. Payment records are kept as long as required for accounting. Sign-in sessions expire on their own, and security event logs are kept for a limited period.',
      ],
    },
    {
      heading: 'Your choices',
      items: [
        'You can sign out of every device at once from your profile menu.',
        'You can ask for a copy of your data, or ask us to delete your account and everything attached to it, by emailing us. Deletion is permanent and includes your practice history and scores.',
        'You can correct your name or medium from your profile.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'This platform is for adults preparing for a teacher recruitment examination. It is not intended for children, and we do not knowingly collect information from them.',
      ],
    },
    {
      heading: 'Security, honestly stated',
      body: [
        'Passwords are never stored because sign-in goes through Google. Sessions use short-lived tokens, refresh tokens are stored hashed, and IP addresses are hashed. No system is perfectly secure, and we will tell you if a breach affects your data.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'If we change what we collect or why, we will update this page and say so in the application.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        'For a copy of your data, deletion, or any privacy question, contact rsdeducationplatform@gmail.com.',
      ],
    },
  ],
}

const telugu: LegalDocument = {
  title: 'గోప్యతా విధానం',
  updated: 'చివరిగా నవీకరించబడింది: 15 సెప్టెంబర్ 2026',
  intro: [
    'rsdeducation మీ గురించి ఏమి సేకరిస్తుంది, ఎందుకు సేకరిస్తుంది, మరియు మీరు ఏమి చేయగలరు అనేది ఇక్కడ వివరించబడింది. ఇది ఒక నమూనా పత్రం కాదు — అప్లికేషన్ నిజంగా ఏమి నిల్వ చేస్తుందో అదే ఇక్కడ ఉంది.',
  ],
  sections: [
    {
      heading: 'మేము ఏమి సేకరిస్తాము',
      items: [
        'మీరు సైన్ ఇన్ చేసినప్పుడు గూగుల్ నుండి: మీ పేరు, ఈమెయిల్ చిరునామా మరియు ప్రొఫైల్ ఫోటో. మీ గూగుల్ పాస్‌వర్డ్ మాకు ఎప్పుడూ అందదు, మేము అడగము.',
        'ఆన్‌బోర్డింగ్‌లో మీరు చెప్పేది: మీ మాధ్యమం (తెలుగు లేదా ఇంగ్లీష్) మరియు మీ లక్ష్యాలు.',
        'మీ చదువు కార్యకలాపం: మీరు ప్రాక్టీస్ చేసిన ప్రశ్నలు, ఇచ్చిన సమాధానాలు, మాక్ టెస్ట్ ప్రయత్నాలు, స్కోర్లు, తీసుకున్న సమయం మరియు అంశాల వారీ ప్రదర్శన.',
        'పరికరం మరియు సెషన్ సమాచారం: పరికర గుర్తింపు, బ్రౌజర్ వివరాలు, మరియు మీరు సైన్ ఇన్ చేసిన ప్లాట్‌ఫామ్. ఇతర పరికరాల నుండి సైన్ అవుట్ చేయగలగడానికి ఇది అవసరం.',
        'మీ ఐపీ చిరునామా యొక్క హాష్ రూపం. మేము చిరునామాను కాక, ఒక వన్-వే హాష్‌ను మాత్రమే నిల్వ చేస్తాము — ఇది రేట్ లిమిటింగ్ మరియు అనుమానాస్పద సైన్ ఇన్‌లను గుర్తించడానికి వాడతాము; దాన్ని తిరిగి మీ ఐపీగా మార్చలేము.',
        'చెల్లింపు రికార్డులు: ప్లాన్, మొత్తం, వాడిన కూపన్, మరియు Razorpay ఇచ్చిన ఆర్డర్ మరియు చెల్లింపు గుర్తింపులు.',
      ],
    },
    {
      heading: 'మేము ఎప్పుడూ సేకరించనివి',
      items: [
        'మీ కార్డు నంబరు, సీవీవీ, యూపీఐ పిన్ లేదా బ్యాంకు వివరాలు. చెల్లింపులు Razorpay లోపల జరుగుతాయి; ఆ వివరాలు మా సర్వర్లకు ఎప్పుడూ చేరవు.',
        'మీ గూగుల్ పాస్‌వర్డ్.',
        'మీ ఖచ్చితమైన లొకేషన్, కాంటాక్టులు, ఫోటోలు లేదా ఫైళ్లు.',
      ],
    },
    {
      heading: 'ఎందుకు సేకరిస్తాము',
      items: [
        'మిమ్మల్ని సైన్ ఇన్ చేయడానికి, మీ పరికరాల్లో సైన్ ఇన్ కొనసాగించడానికి.',
        'మీ ప్రాక్టీస్ చరిత్ర, స్కోర్లు, బలహీన అంశాలు చూపడానికి మరియు తర్వాతి మాడ్యూల్ ఎప్పుడు తెరవాలో నిర్ణయించడానికి.',
        'మీరు చెల్లించిన ప్లాన్‌కు ప్రవేశం ఇవ్వడానికి, చెల్లింపులో సమస్య వస్తే సహాయం చేయడానికి.',
        'ఖాతాల భద్రత కోసం — అసాధారణ సైన్ ఇన్‌లను గుర్తించడం, పదేపదే ప్రయత్నాలను నియంత్రించడం, వాడని పరికరాల సెషన్లను ముగించడం.',
      ],
    },
    {
      heading: 'ఇంకెవరు చూస్తారు',
      body: [
        'మేము మీ డేటాను అమ్మము, ప్రకటనల కోసం పంచము. వేదిక వీటిపై నడుస్తున్నందున మాత్రమే ఈ సేవా ప్రదాతలకు చేరుతుంది:',
      ],
      items: [
        'గూగుల్ — సైన్ ఇన్ కోసం మాత్రమే.',
        'Supabase — మీ ఖాతా మరియు చదువు రికార్డులు నిల్వ ఉండే డేటాబేస్.',
        'Razorpay — చెల్లింపుల ప్రాసెసింగ్. మీ చెల్లింపు వివరాలను వారి సొంత విధానం ప్రకారం నిర్వహిస్తారు.',
        'Vercel — అప్లికేషన్ హోస్టింగ్.',
        'Upstash — రేట్ లిమిటింగ్ మరియు మాక్ పేపర్లను వేగంగా అందించడానికి తాత్కాలిక కాష్.',
        'చట్టం కోరితే సమాచారాన్ని వెల్లడించాల్సి ఉంటుంది.',
      ],
    },
    {
      heading: 'ఎంతకాలం ఉంచుతాము',
      body: [
        'మీ ఖాతా ఉన్నంత వరకు మీ ఖాతా మరియు చదువు చరిత్ర ఉంటాయి — ఫోన్ మారినా మీ పురోగతి నిలిచి ఉండటమే ఈ ఉత్పత్తి ఉద్దేశం. చెల్లింపు రికార్డులు లెక్కల అవసరం మేరకు ఉంచుతాము. సైన్ ఇన్ సెషన్లు వాటంతట అవే గడువు ముగుస్తాయి; భద్రతా లాగ్‌లు పరిమిత కాలం ఉంచుతాము.',
      ],
    },
    {
      heading: 'మీ ఎంపికలు',
      items: [
        'ప్రొఫైల్ మెనూ నుండి అన్ని పరికరాల నుండి ఒకేసారి సైన్ అవుట్ చేయవచ్చు.',
        'మీ డేటా కాపీ అడగవచ్చు, లేదా మీ ఖాతాను మరియు దానికి సంబంధించిన అన్నింటినీ తొలగించమని ఈమెయిల్ ద్వారా కోరవచ్చు. తొలగింపు శాశ్వతం — మీ ప్రాక్టీస్ చరిత్ర మరియు స్కోర్లు కూడా పోతాయి.',
        'మీ పేరు లేదా మాధ్యమాన్ని ప్రొఫైల్ నుండి సరిచేసుకోవచ్చు.',
      ],
    },
    {
      heading: 'పిల్లలు',
      body: [
        'ఈ వేదిక ఉపాధ్యాయ నియామక పరీక్షకు సిద్ధమవుతున్న పెద్దల కోసం. ఇది పిల్లల కోసం ఉద్దేశించినది కాదు; వారి నుండి సమాచారాన్ని తెలిసి సేకరించము.',
      ],
    },
    {
      heading: 'భద్రత — నిజాయితీగా',
      body: [
        'సైన్ ఇన్ గూగుల్ ద్వారా జరుగుతుంది కాబట్టి పాస్‌వర్డ్‌లు నిల్వ చేయబడవు. సెషన్లు స్వల్పకాలిక టోకెన్లను వాడతాయి, రిఫ్రెష్ టోకెన్లు హాష్ రూపంలో ఉంటాయి, ఐపీ చిరునామాలు హాష్ చేయబడతాయి. ఏ వ్యవస్థా పూర్తిగా సురక్షితం కాదు; మీ డేటాకు భంగం కలిగితే మీకు తెలియజేస్తాము.',
      ],
    },
    {
      heading: 'మార్పులు',
      body: [
        'మేము ఏమి సేకరిస్తామో లేదా ఎందుకు సేకరిస్తామో మారితే, ఈ పేజీని నవీకరిస్తాము మరియు అప్లికేషన్‌లో తెలియజేస్తాము.',
      ],
    },
    {
      heading: 'సంప్రదింపు',
      body: [
        'మీ డేటా కాపీ, తొలగింపు, లేదా గోప్యతకు సంబంధించిన ఏ ప్రశ్నకైనా rsdeducationplatform@gmail.com కు సంప్రదించండి.',
      ],
    },
  ],
}

export default function PrivacyPage() {
  return <LegalPage english={english} telugu={telugu} />
}
