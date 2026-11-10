// ============================================================
// app/privacy/page.tsx — Privacy Policy
// ============================================================
// Written from the schema rather than from a template: the tables behind this
// are users, user_passwords (admin-made email accounts), devices, sessions,
// security_events, question_feedback_reports, resource_views, payment_orders
// and play_subscriptions (Google Play), plus Expo for app updates, and the
// policy says what is actually in them. Two facts are worth stating plainly
// because they are unusually good and most policies bury them — IP addresses
// are stored hashed, never raw, and no card detail ever reaches this server.
// ============================================================

import type { Metadata } from 'next'
import LegalPage, { type LegalDocument } from '@/app/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy — RSD Education',
  description:
    'What RSD Education collects, why, who it is shared with, and how to have it deleted.',
}

const english: LegalDocument = {
  title: 'Privacy Policy',
  updated: 'Last updated 10 November 2026',
  intro: [
    'This explains what RSD Education collects about you, why, and what you can do about it. It covers the "RSD Education" Android app on Google Play, the RSD Education app downloaded from our website, and the website rsdeducation.vercel.app, all run by the RSD Education developer. It describes what the application actually stores, not what a policy template would say.',
  ],
  sections: [
    {
      heading: 'What we collect',
      items: [
        'From Google, when you sign in: your name, email address and profile picture. We never receive or ask for your Google password.',
        'Email sign-in, only for accounts we create ourselves (for example for staff or for app store review): the email address and a one-way hash of the password, never the password itself. Students sign in with Google and have no password with us.',
        'What you tell us during onboarding: your preferred medium (Telugu or English) and your learning goals.',
        'Your study activity: which questions you practised, what you answered, your mock test attempts, scores, time taken and topic performance.',
        'Tests you create: the questions you upload in My Tests for your own practice. They are stored privately in your account, never shown to anyone else, and deleted with your account.',
        'Question reports: when you tap Report on a question, which question it was, the reason you chose and any note you write.',
        'Study files you open: which study notes and files you open or download, and when. It counts how often each file is used and shows us when a free account tries to open a Pro file.',
        'Device and session information: a device identifier (a random code the app creates, not your phone\'s hardware ID), your browser or app user agent, and the platform you signed in from. This is what lets you sign out of other devices.',
        'A hashed form of your IP address. We store a one-way hash, not the address itself — it is used for rate limiting and to spot suspicious sign-ins, and it cannot be turned back into your IP.',
        'Website payment records: the plan, amount, coupon used, and the order and payment identifiers returned by Razorpay. These are records of a completed one-time purchase, not a stored payment method — there is no card on file, no UPI mandate and no standing instruction with us.',
        'Google Play purchase records, if you buy Pro in the Android app: the pass, its status (for example pending, active, expired or refunded), its expiry date, and the purchase token and order identifier Google gives us, which we use to confirm the purchase with Google. To link a purchase to your account we give Google a random account code — never your name or email.',
      ],
    },
    {
      heading: 'What we never collect',
      items: [
        'Your card number, CVV, UPI PIN or bank credentials. Payments happen inside Google Play or Razorpay and those details never reach our servers.',
        'Your Google password.',
        'Your location, contacts or photos. We read a file from your device only when you choose one to upload in My Tests.',
      ],
    },
    {
      heading: 'Why we collect it',
      items: [
        'To sign you in, and to keep your progress when you change phones. A student account is signed in on one device at a time: signing in on a new device signs out the previous one.',
        'To fix mistakes you report in questions, and to see which study files are useful.',
        'To show your practice history, scores and weak topics, and to decide which module unlocks next.',
        'To give you access to the plan you paid for, to keep Google Play access in step with refunds, and to support you if a payment goes wrong.',
        'To keep accounts secure — detecting unusual sign-ins, limiting repeated attempts, and letting you end sessions on devices you no longer use.',
      ],
    },
    {
      heading: 'Who else sees it',
      body: [
        'We do not sell your data and we do not share it for advertising. It reaches these service providers only because the platform runs on them:',
      ],
      items: [
        'Google — sign-in, and Google Play billing for Pro bought in the Android app. Google Play tells us the status of your purchase and handles your payment details under its own policy.',
        'Supabase — the database where your account and study records are stored.',
        'Razorpay — payment processing. They handle your payment details under their own policy.',
        'Vercel — hosting and delivery of the application.',
        'Upstash — a temporary cache used for rate limiting and to serve mock papers quickly.',
        'Expo — delivers updates to the Android app. When the app checks for an update, Expo receives your IP address, basic device details (the platform and app version) and a random installation code. It does not receive your name, email or study records.',
        'Other learners — mock test leaderboards show your first name, the initial of your surname and your score.',
        'We will also disclose information if the law requires it.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'Your account and study history stay while your account exists, because that record is the point of the product — it is how your progress survives changing phones. Payment records are kept as long as required for accounting. If you delete your account, we keep only the Razorpay payment reference and date of each website purchase, no longer linked to you; Razorpay keeps its own record of the payment. Your Google Play purchase records are deleted with your account; Google keeps its own record of the purchase, and notices Google sent us (order identifiers and dates, not linked to your name or email) may remain in our logs. Sign-in sessions expire on their own, and security event logs are kept for a limited period.',
      ],
    },
    {
      heading: 'Your choices',
      items: [
        'You can sign out of every device at once from your profile menu.',
        'You can delete your account and everything attached to it yourself: in the app under Profile → Account → Delete account, or on the website at /delete-account. Deletion is immediate and permanent and includes your practice history and scores.',
        'You can also ask for a copy of your data, or for deletion, by emailing us.',
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
        'Students sign in with Google, so we hold no password for them. Accounts we create for email sign-in keep only a one-way hash of the password, never the password itself. Sessions use short-lived tokens, refresh tokens are stored hashed, and IP addresses are hashed. No system is perfectly secure, and we will tell you if a breach affects your data.',
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
        'RSD Education is run by the RSD Education developer. For a copy of your data, deletion, or any privacy question, contact rsdeducationplatform@gmail.com.',
      ],
    },
  ],
}

const telugu: LegalDocument = {
  title: 'గోప్యతా విధానం',
  updated: 'చివరిగా నవీకరించబడింది: 10 నవంబర్ 2026',
  intro: [
    'RSD Education మీ గురించి ఏమి సేకరిస్తుంది, ఎందుకు సేకరిస్తుంది, మరియు మీరు ఏమి చేయగలరు అనేది ఇక్కడ వివరించబడింది. ఇది గూగుల్ ప్లేలోని "RSD Education" ఆండ్రాయిడ్ యాప్, మా వెబ్‌సైట్ నుండి డౌన్‌లోడ్ చేసే RSD Education యాప్, మరియు rsdeducation.vercel.app వెబ్‌సైట్‌కు వర్తిస్తుంది — ఇవన్నీ RSD Education డెవలపర్ నడుపుతారు. ఇది ఒక నమూనా పత్రం కాదు — అప్లికేషన్ నిజంగా ఏమి నిల్వ చేస్తుందో అదే ఇక్కడ ఉంది.',
  ],
  sections: [
    {
      heading: 'మేము ఏమి సేకరిస్తాము',
      items: [
        'మీరు సైన్ ఇన్ చేసినప్పుడు గూగుల్ నుండి: మీ పేరు, ఈమెయిల్ చిరునామా మరియు ప్రొఫైల్ ఫోటో. మీ గూగుల్ పాస్‌వర్డ్ మాకు ఎప్పుడూ అందదు, మేము అడగము.',
        'ఈమెయిల్ సైన్ ఇన్ — మేమే తయారుచేసే ఖాతాలకు మాత్రమే (ఉదాహరణకు సిబ్బంది కోసం లేదా యాప్ స్టోర్ సమీక్ష కోసం): ఈమెయిల్ చిరునామా మరియు పాస్‌వర్డ్ యొక్క వన్-వే హాష్ మాత్రమే — పాస్‌వర్డ్ కాదు. విద్యార్థులు గూగుల్‌తో సైన్ ఇన్ చేస్తారు; వారి పాస్‌వర్డ్ ఏదీ మా వద్ద ఉండదు.',
        'ఆన్‌బోర్డింగ్‌లో మీరు చెప్పేది: మీ మాధ్యమం (తెలుగు లేదా ఇంగ్లీష్) మరియు మీ లక్ష్యాలు.',
        'మీ చదువు కార్యకలాపం: మీరు ప్రాక్టీస్ చేసిన ప్రశ్నలు, ఇచ్చిన సమాధానాలు, మాక్ టెస్ట్ ప్రయత్నాలు, స్కోర్లు, తీసుకున్న సమయం మరియు అంశాల వారీ ప్రదర్శన.',
        'మీరు తయారుచేసే టెస్టులు: My Tests లో మీ సొంత ప్రాక్టీస్ కోసం మీరు అప్‌లోడ్ చేసే ప్రశ్నలు. ఇవి మీ ఖాతాలో గోప్యంగా నిల్వ ఉంటాయి, ఇతరులకు కనిపించవు, మీ ఖాతాతో పాటు తొలగించబడతాయి.',
        'ప్రశ్న నివేదికలు: మీరు ఒక ప్రశ్నపై Report నొక్కినప్పుడు — ఏ ప్రశ్న, మీరు ఎంచుకున్న కారణం, మరియు మీరు రాసే ఏదైనా వివరణ.',
        'మీరు తెరిచే చదువు ఫైళ్లు: మీరు ఏ స్టడీ నోట్స్ మరియు ఫైళ్లను తెరిచారు లేదా డౌన్‌లోడ్ చేశారు, ఎప్పుడు. ప్రతి ఫైల్ ఎంతగా ఉపయోగపడుతుందో లెక్కించడానికి, మరియు ఉచిత ఖాతా Pro ఫైల్‌ను తెరవడానికి ప్రయత్నించినప్పుడు తెలుసుకోవడానికి.',
        'పరికరం మరియు సెషన్ సమాచారం: పరికర గుర్తింపు (యాప్ తయారుచేసే ఒక యాదృచ్ఛిక కోడ్ — మీ ఫోన్ హార్డ్‌వేర్ గుర్తింపు కాదు), బ్రౌజర్ లేదా యాప్ వివరాలు, మరియు మీరు సైన్ ఇన్ చేసిన ప్లాట్‌ఫామ్. ఇతర పరికరాల నుండి సైన్ అవుట్ చేయగలగడానికి ఇది అవసరం.',
        'మీ ఐపీ చిరునామా యొక్క హాష్ రూపం. మేము చిరునామాను కాక, ఒక వన్-వే హాష్‌ను మాత్రమే నిల్వ చేస్తాము — ఇది రేట్ లిమిటింగ్ మరియు అనుమానాస్పద సైన్ ఇన్‌లను గుర్తించడానికి వాడతాము; దాన్ని తిరిగి మీ ఐపీగా మార్చలేము.',
        'వెబ్‌సైట్ చెల్లింపు రికార్డులు: ప్లాన్, మొత్తం, వాడిన కూపన్, మరియు Razorpay ఇచ్చిన ఆర్డర్ మరియు చెల్లింపు గుర్తింపులు. ఇవి పూర్తయిన ఒక్కసారి కొనుగోలు రికార్డులు మాత్రమే — మా వద్ద కార్డు సేవ్ చేయబడదు, యూపీఐ మాండేట్ ఉండదు, స్టాండింగ్ ఇన్‌స్ట్రక్షన్ ఉండదు.',
        'గూగుల్ ప్లే కొనుగోలు రికార్డులు (ఆండ్రాయిడ్ యాప్‌లో Pro కొంటే): పాస్, దాని స్థితి (ఉదా: పెండింగ్, యాక్టివ్, గడువు ముగిసింది లేదా రీఫండ్), గడువు తేదీ, మరియు గూగుల్ ఇచ్చే పర్చేస్ టోకెన్ మరియు ఆర్డర్ గుర్తింపు — కొనుగోలును గూగుల్‌తో నిర్ధారించడానికి వీటిని వాడతాము. కొనుగోలును మీ ఖాతాతో జత చేయడానికి గూగుల్‌కు ఒక యాదృచ్ఛిక ఖాతా కోడ్ మాత్రమే ఇస్తాము — మీ పేరు లేదా ఈమెయిల్ ఎప్పుడూ ఇవ్వము.',
      ],
    },
    {
      heading: 'మేము ఎప్పుడూ సేకరించనివి',
      items: [
        'మీ కార్డు నంబరు, సీవీవీ, యూపీఐ పిన్ లేదా బ్యాంకు వివరాలు. చెల్లింపులు గూగుల్ ప్లే లేదా Razorpay లోపల జరుగుతాయి; ఆ వివరాలు మా సర్వర్లకు ఎప్పుడూ చేరవు.',
        'మీ గూగుల్ పాస్‌వర్డ్.',
        'మీ లొకేషన్, కాంటాక్టులు లేదా ఫోటోలు. My Tests లో అప్‌లోడ్ చేయడానికి మీరు స్వయంగా ఎంచుకున్న ఫైల్‌ను మాత్రమే చదువుతాము.',
      ],
    },
    {
      heading: 'ఎందుకు సేకరిస్తాము',
      items: [
        'మిమ్మల్ని సైన్ ఇన్ చేయడానికి, మరియు ఫోన్ మారినా మీ పురోగతి నిలిచి ఉండటానికి. విద్యార్థి ఖాతా ఒకేసారి ఒక పరికరంలో మాత్రమే సైన్ ఇన్ అయి ఉంటుంది: కొత్త పరికరంలో సైన్ ఇన్ చేస్తే పాత పరికరం నుండి సైన్ అవుట్ అవుతుంది.',
        'మీరు నివేదించిన ప్రశ్నల తప్పులను సరిచేయడానికి, మరియు ఏ చదువు ఫైళ్లు ఉపయోగపడుతున్నాయో తెలుసుకోవడానికి.',
        'మీ ప్రాక్టీస్ చరిత్ర, స్కోర్లు, బలహీన అంశాలు చూపడానికి మరియు తర్వాతి మాడ్యూల్ ఎప్పుడు తెరవాలో నిర్ణయించడానికి.',
        'మీరు చెల్లించిన ప్లాన్‌కు ప్రవేశం ఇవ్వడానికి, గూగుల్ ప్లే రీఫండ్‌లకు అనుగుణంగా ప్రవేశాన్ని సరిచేయడానికి, చెల్లింపులో సమస్య వస్తే సహాయం చేయడానికి.',
        'ఖాతాల భద్రత కోసం — అసాధారణ సైన్ ఇన్‌లను గుర్తించడం, పదేపదే ప్రయత్నాలను నియంత్రించడం, వాడని పరికరాల సెషన్లను ముగించడం.',
      ],
    },
    {
      heading: 'ఇంకెవరు చూస్తారు',
      body: [
        'మేము మీ డేటాను అమ్మము, ప్రకటనల కోసం పంచము. వేదిక వీటిపై నడుస్తున్నందున మాత్రమే ఈ సేవా ప్రదాతలకు చేరుతుంది:',
      ],
      items: [
        'గూగుల్ — సైన్ ఇన్ కోసం, మరియు ఆండ్రాయిడ్ యాప్‌లో కొన్న Pro కోసం గూగుల్ ప్లే బిల్లింగ్. గూగుల్ ప్లే మీ కొనుగోలు స్థితిని మాకు తెలియజేస్తుంది; మీ చెల్లింపు వివరాలను తన సొంత విధానం ప్రకారం నిర్వహిస్తుంది.',
        'Supabase — మీ ఖాతా మరియు చదువు రికార్డులు నిల్వ ఉండే డేటాబేస్.',
        'Razorpay — చెల్లింపుల ప్రాసెసింగ్. మీ చెల్లింపు వివరాలను వారి సొంత విధానం ప్రకారం నిర్వహిస్తారు.',
        'Vercel — అప్లికేషన్ హోస్టింగ్.',
        'Upstash — రేట్ లిమిటింగ్ మరియు మాక్ పేపర్లను వేగంగా అందించడానికి తాత్కాలిక కాష్.',
        'Expo — ఆండ్రాయిడ్ యాప్‌కు అప్‌డేట్‌లను అందిస్తుంది. యాప్ అప్‌డేట్ కోసం చూసినప్పుడు Expo కు మీ ఐపీ చిరునామా, ప్రాథమిక పరికర వివరాలు (ప్లాట్‌ఫామ్ మరియు యాప్ వెర్షన్), మరియు ఒక యాదృచ్ఛిక ఇన్‌స్టాలేషన్ కోడ్ అందుతాయి. మీ పేరు, ఈమెయిల్ లేదా చదువు రికార్డులు అందవు.',
        'ఇతర అభ్యర్థులు — మాక్ టెస్ట్ లీడర్‌బోర్డులో మీ మొదటి పేరు, ఇంటి పేరులోని మొదటి అక్షరం మరియు మీ స్కోరు కనిపిస్తాయి.',
        'చట్టం కోరితే సమాచారాన్ని వెల్లడించాల్సి ఉంటుంది.',
      ],
    },
    {
      heading: 'ఎంతకాలం ఉంచుతాము',
      body: [
        'మీ ఖాతా ఉన్నంత వరకు మీ ఖాతా మరియు చదువు చరిత్ర ఉంటాయి — ఫోన్ మారినా మీ పురోగతి నిలిచి ఉండటమే ఈ ఉత్పత్తి ఉద్దేశం. చెల్లింపు రికార్డులు లెక్కల అవసరం మేరకు ఉంచుతాము. మీరు ఖాతా తొలగిస్తే, ప్రతి వెబ్‌సైట్ కొనుగోలుకు సంబంధించిన Razorpay చెల్లింపు గుర్తింపు మరియు తేదీ మాత్రమే మీతో సంబంధం లేకుండా ఉంచుతాము; Razorpay తన సొంత చెల్లింపు రికార్డును ఉంచుకుంటుంది. మీ గూగుల్ ప్లే కొనుగోలు రికార్డులు మీ ఖాతాతో పాటు తొలగించబడతాయి; గూగుల్ తన సొంత కొనుగోలు రికార్డును ఉంచుకుంటుంది, గూగుల్ పంపిన నోటీసులు (మీ పేరు లేదా ఈమెయిల్‌తో సంబంధం లేని ఆర్డర్ గుర్తింపులు మరియు తేదీలు) మా లాగ్‌లలో ఉండవచ్చు. సైన్ ఇన్ సెషన్లు వాటంతట అవే గడువు ముగుస్తాయి; భద్రతా లాగ్‌లు పరిమిత కాలం ఉంచుతాము.',
      ],
    },
    {
      heading: 'మీ ఎంపికలు',
      items: [
        'ప్రొఫైల్ మెనూ నుండి అన్ని పరికరాల నుండి ఒకేసారి సైన్ అవుట్ చేయవచ్చు.',
        'మీ ఖాతాను మరియు దానికి సంబంధించిన అన్నింటినీ మీరే తొలగించవచ్చు: యాప్‌లో ప్రొఫైల్ → ఖాతా → Delete account లో, లేదా వెబ్‌సైట్‌లో /delete-account పేజీలో. తొలగింపు వెంటనే జరుగుతుంది, శాశ్వతం — మీ ప్రాక్టీస్ చరిత్ర మరియు స్కోర్లు కూడా పోతాయి.',
        'మీ డేటా కాపీ కావాలన్నా, తొలగింపు కోసమైనా ఈమెయిల్ ద్వారా కూడా కోరవచ్చు.',
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
        'విద్యార్థులు గూగుల్‌తో సైన్ ఇన్ చేస్తారు, కాబట్టి వారి పాస్‌వర్డ్ మా వద్ద ఉండదు. ఈమెయిల్ సైన్ ఇన్ కోసం మేము తయారుచేసే ఖాతాలకు పాస్‌వర్డ్ యొక్క వన్-వే హాష్ మాత్రమే ఉంచుతాము — పాస్‌వర్డ్‌ను కాదు. సెషన్లు స్వల్పకాలిక టోకెన్లను వాడతాయి, రిఫ్రెష్ టోకెన్లు హాష్ రూపంలో ఉంటాయి, ఐపీ చిరునామాలు హాష్ చేయబడతాయి. ఏ వ్యవస్థా పూర్తిగా సురక్షితం కాదు; మీ డేటాకు భంగం కలిగితే మీకు తెలియజేస్తాము.',
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
        'RSD Education ను RSD Education డెవలపర్ నడుపుతారు. మీ డేటా కాపీ, తొలగింపు, లేదా గోప్యతకు సంబంధించిన ఏ ప్రశ్నకైనా rsdeducationplatform@gmail.com కు సంప్రదించండి.',
      ],
    },
  ],
}

export default function PrivacyPage() {
  return <LegalPage english={english} telugu={telugu} />
}
