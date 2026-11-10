// ============================================================
// app/terms/page.tsx — Terms of Service
// ============================================================
// Written against what the application actually does, not a template. The
// disclaimers the owner asked for are the substance of it: the question bank
// is prepared material and can contain mistakes, and nothing here promises
// anybody a teaching post.
// ============================================================

import type { Metadata } from 'next'
import LegalPage, { type LegalDocument } from '@/app/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service — RSD Education',
  description:
    'The terms you agree to when using RSD Education, including what the platform does and does not promise.',
}

const english: LegalDocument = {
  title: 'Terms of Service',
  updated: 'Last updated 10 November 2026',
  intro: [
    'RSD Education is a practice platform for the AP DSC SGT examination, run by the RSD Education developer: the "RSD Education" Android app on Google Play, the app downloaded from our website, and the website rsdeducation.vercel.app. By creating an account or using the platform you agree to these terms. Please read the section on what we do not promise — it is the most important part of this document.',
  ],
  sections: [
    {
      heading: 'What this platform is',
      body: [
        'RSD Education gives you practice questions, full-length mock papers, an exam roadmap with study notes, and a record of how you performed, in Telugu and English medium. It is a study aid. It is not a coaching institute, not a recruitment service, and not connected to any government body.',
        'Some features need Pro. In the Android app, subject-wise and topic-wise practice is available only with Pro. What each plan includes is shown before you pay.',
        'Some study notes, questions and explanations are prepared with the help of AI tools and then checked by us. The section below on mistakes applies to them as it does to everything else.',
      ],
    },
    {
      heading: 'What we do not promise',
      body: [
        'This is the part we want you to read carefully before you pay us anything.',
      ],
      items: [
        'We do not guarantee that you will pass the DSC examination, be selected, or obtain a teaching post. No practice platform can promise that, and anyone who does is misleading you. Your result depends on your own preparation, the competition in that year, and the recruitment process itself.',
        'We do not guarantee that our questions will appear in the actual examination. Our papers follow the official pattern as we understand it, but they are prepared by us and are not official papers.',
        'We do not guarantee that every question, answer or explanation is free of mistakes. The bank contains tens of thousands of questions prepared from syllabus material, and some of them will contain errors, outdated facts or debatable answers. Always check anything important against the official syllabus and standard textbooks.',
        'We do not guarantee that the syllabus, examination pattern, or the number of marks we show will match the official notification for your year. Recruitment rules change. The official notification is the only authority.',
        'We are not affiliated with, endorsed by, or connected to the Government of Andhra Pradesh, the School Education Department, or any examination authority. Names of examinations are used only to describe what the practice material covers.',
      ],
    },
    {
      heading: 'If you find a mistake',
      body: [
        'Every question in practice and in a mock test has a Report button. Please use it. Reports are reviewed and corrected questions are updated for everyone, usually within a few days. Reporting a mistake is genuinely useful to other candidates and costs you one tap.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'Students sign in with Google; accounts we create ourselves may sign in with an email and password. One account is meant for one person, and a student account is signed in on one device at a time: signing in on a new device signs out the previous one. Sharing your account, or signing in from many devices to give other people access, may result in the account being suspended without a refund.',
        'You are responsible for what happens under your account. Signing out of all devices is available in your profile menu if you think someone else has access.',
      ],
    },
    {
      heading: 'Payments, plans and refunds',
      body: [
        'Pro is a one-time payment for a fixed period, whether you buy it in the app or on the website. Nothing renews by itself: there is no subscription that charges you again, no auto-pay and no standing instruction on your card or UPI. You are only charged again if you deliberately buy more time. The price, the duration and what is included are shown before you pay.',
      ],
      items: [
        'In the Android app from Google Play: you buy a Pro pass for 1 month, 3 months or 1 year through Google Play. It is charged once to your Google Play account, and Google shows the price before you confirm.',
        'On the website (and the Android app downloaded directly from our website): you buy a Pro plan through Razorpay.',
        'Because nothing renews, there is nothing to cancel. Access ends on its expiry date and you return to the free plan — no reminder, no action and no contact with us is needed.',
        'Buying again while Pro is active adds more time: in the app, Google adds the new pass to your Google Play time; on the website, the new days are added to your website time. A website plan and a Google Play pass are separate purchases — if you have both, you have Pro until the later of the two ends.',
        'No refunds: once a payment succeeds and Pro is active on your account, we do not refund it, in full or for unused time. The full question bank unlocks the moment payment succeeds.',
        'Google Play may still refund a payment under its own policies (for example an unauthorised charge, or a request made to Google shortly after purchase). That decision is Google\'s, not ours. If a payment is refunded or reversed by Google or your bank, the Pro access that payment was for ends.',
        'If you were charged twice, or charged in error without receiving Pro, contact us and we will help put it right.',
        'We never see or store your card, UPI or bank details. Google Play and Razorpay handle them under their own policies.',
        'We may change prices for future purchases. A plan or pass you have already paid for is not affected.',
      ],
    },
    {
      heading: 'Using the material',
      body: [
        'The questions, explanations and papers on this platform are for your personal preparation. You may not copy, republish, sell, or distribute them, including by sharing screenshots or exports in groups or on other platforms.',
      ],
    },
    {
      heading: 'Availability',
      body: [
        'We try to keep the platform running, but we cannot promise it will always be available. Maintenance, a failure at one of our providers, or something we did not foresee may interrupt it. If an interruption loses you a significant part of a paid plan, tell us and we will extend it.',
      ],
    },
    {
      heading: 'Ending your use',
      body: [
        'You can stop using the platform at any time and ask us to delete your account. We may suspend an account that shares access, attempts to extract the question bank, or interferes with the service for others.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        'If we change these terms in a way that matters, we will say so in the application. Continuing to use the platform after that means you accept the change.',
      ],
    },
    {
      heading: 'Governing law',
      body: [
        'These terms are governed by the laws of India. If you have a complaint, please write to us first and we will try to resolve it. If it cannot be resolved, it will be settled by the competent courts in India.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        'For anything about your account, a payment, a complaint, or a mistake in a question, contact rsdeducationplatform@gmail.com.',
      ],
    },
  ],
}

const telugu: LegalDocument = {
  title: 'నిబంధనలు మరియు షరతులు',
  updated: 'చివరిగా నవీకరించబడింది: 10 నవంబర్ 2026',
  intro: [
    'RSD Education అనేది ఏపీ డీఎస్సీ ఎస్‌జీటీ పరీక్ష కోసం ఒక ప్రాక్టీస్ వేదిక — RSD Education డెవలపర్ నడుపుతారు: గూగుల్ ప్లేలోని "RSD Education" ఆండ్రాయిడ్ యాప్, మా వెబ్‌సైట్ నుండి డౌన్‌లోడ్ చేసే యాప్, మరియు rsdeducation.vercel.app వెబ్‌సైట్. ఖాతా తెరిచినప్పుడు లేదా ఈ వేదికను ఉపయోగించినప్పుడు మీరు ఈ నిబంధనలకు అంగీకరిస్తున్నారు. "మేము ఏమి హామీ ఇవ్వము" అనే భాగాన్ని తప్పకుండా చదవండి — ఈ పత్రంలో అదే అత్యంత ముఖ్యమైనది.',
  ],
  sections: [
    {
      heading: 'ఈ వేదిక ఏమిటి',
      body: [
        'RSD Education మీకు ప్రాక్టీస్ ప్రశ్నలు, పూర్తి నిడివి మాక్ పేపర్లు, స్టడీ నోట్స్‌తో కూడిన పరీక్ష రోడ్‌మ్యాప్, మరియు మీ ప్రదర్శన రికార్డును తెలుగు మరియు ఇంగ్లీష్ మాధ్యమాల్లో అందిస్తుంది. ఇది ఒక చదువు సహాయకం మాత్రమే. ఇది కోచింగ్ సెంటర్ కాదు, నియామక సంస్థ కాదు, ఏ ప్రభుత్వ విభాగంతోనూ సంబంధం లేదు.',
        'కొన్ని సౌకర్యాలకు Pro అవసరం. ఆండ్రాయిడ్ యాప్‌లో సబ్జెక్ట్ వారీ మరియు అంశాల వారీ ప్రాక్టీస్ Pro తో మాత్రమే లభిస్తుంది. ప్రతి ప్లాన్‌లో ఏమి ఉందో చెల్లించే ముందే చూపబడుతుంది.',
        'కొన్ని స్టడీ నోట్స్, ప్రశ్నలు మరియు వివరణలు AI సాధనాల సహాయంతో తయారు చేసి, తర్వాత మేము పరిశీలిస్తాము. తప్పుల గురించి కింద ఉన్న భాగం వాటికి కూడా వర్తిస్తుంది.',
      ],
    },
    {
      heading: 'మేము ఏమి హామీ ఇవ్వము',
      body: ['డబ్బు చెల్లించే ముందు ఈ భాగాన్ని జాగ్రత్తగా చదవమని కోరుతున్నాము.'],
      items: [
        'మీరు డీఎస్సీ పరీక్షలో ఉత్తీర్ణులవుతారని, ఎంపిక అవుతారని, లేదా ఉపాధ్యాయ ఉద్యోగం పొందుతారని మేము హామీ ఇవ్వము. ఏ ప్రాక్టీస్ వేదికా అలాంటి హామీ ఇవ్వలేదు; ఇస్తామని చెప్పేవారు మిమ్మల్ని తప్పుదారి పట్టిస్తున్నారు. మీ ఫలితం మీ సొంత సన్నద్ధత, ఆ సంవత్సరం పోటీ, మరియు నియామక ప్రక్రియపై ఆధారపడి ఉంటుంది.',
        'మా ప్రశ్నలు అసలు పరీక్షలో వస్తాయని మేము హామీ ఇవ్వము. మా పేపర్లు అధికారిక నమూనాను అనుసరిస్తాయి, కానీ అవి మేము తయారు చేసినవి — అధికారిక పేపర్లు కావు.',
        'ప్రతి ప్రశ్న, సమాధానం లేదా వివరణ తప్పులు లేకుండా ఉంటుందని మేము హామీ ఇవ్వము. ఈ బ్యాంకులో పదివేల సంఖ్యలో ప్రశ్నలు ఉన్నాయి; వాటిలో కొన్నింటిలో పొరపాట్లు, పాత సమాచారం లేదా చర్చనీయమైన సమాధానాలు ఉండవచ్చు. ముఖ్యమైన విషయాలను ఎప్పుడూ అధికారిక సిలబస్ మరియు ప్రామాణిక పాఠ్యపుస్తకాలతో సరిచూసుకోండి.',
        'సిలబస్, పరీక్షా విధానం, లేదా మేము చూపే మార్కులు మీ సంవత్సరపు అధికారిక నోటిఫికేషన్‌తో సరిపోతాయని మేము హామీ ఇవ్వము. నియామక నిబంధనలు మారుతూ ఉంటాయి. అధికారిక నోటిఫికేషన్ మాత్రమే ప్రామాణికం.',
        'మేము ఆంధ్రప్రదేశ్ ప్రభుత్వం, పాఠశాల విద్యా శాఖ, లేదా ఏ పరీక్షా సంస్థతోనూ అనుబంధం కలిగి లేము, వారి ఆమోదం పొందలేదు. పరీక్షల పేర్లను కేవలం ప్రాక్టీస్ విషయాన్ని వివరించడానికి మాత్రమే ఉపయోగించాము.',
      ],
    },
    {
      heading: 'తప్పు కనిపిస్తే',
      body: [
        'ప్రాక్టీస్‌లో మరియు మాక్ టెస్ట్‌లో ప్రతి ప్రశ్నకు "Report" బటన్ ఉంది. దయచేసి దాన్ని ఉపయోగించండి. నివేదికలు పరిశీలించబడతాయి, సరిదిద్దిన ప్రశ్నలు అందరికీ నవీకరించబడతాయి — సాధారణంగా కొన్ని రోజుల్లో. ఒక తప్పును నివేదించడం మీకు ఒక టాప్ మాత్రమే, ఇతర అభ్యర్థులకు నిజంగా ఉపయోగపడుతుంది.',
      ],
    },
    {
      heading: 'మీ ఖాతా',
      body: [
        'విద్యార్థులు గూగుల్‌తో సైన్ ఇన్ చేస్తారు; మేమే తయారుచేసే ఖాతాలు ఈమెయిల్ మరియు పాస్‌వర్డ్‌తో సైన్ ఇన్ చేయవచ్చు. ఒక ఖాతా ఒక వ్యక్తికి మాత్రమే, మరియు విద్యార్థి ఖాతా ఒకేసారి ఒక పరికరంలో మాత్రమే సైన్ ఇన్ అయి ఉంటుంది: కొత్త పరికరంలో సైన్ ఇన్ చేస్తే పాత పరికరం నుండి సైన్ అవుట్ అవుతుంది. ఖాతాను పంచుకోవడం, లేదా ఇతరులకు ప్రవేశం ఇవ్వడానికి అనేక పరికరాల నుండి సైన్ ఇన్ చేయడం వలన ఖాతా రద్దు కావచ్చు — డబ్బు తిరిగి ఇవ్వబడదు.',
        'మీ ఖాతా కింద జరిగే దానికి మీరే బాధ్యులు. ఎవరైనా మీ ఖాతాను వాడుతున్నారని అనిపిస్తే, ప్రొఫైల్ మెనూలో "అన్ని పరికరాల నుండి సైన్ అవుట్" ఎంపిక ఉంది.',
      ],
    },
    {
      heading: 'చెల్లింపులు, ప్లాన్లు మరియు రీఫండ్‌లు',
      body: [
        'యాప్‌లో కొన్నా, వెబ్‌సైట్‌లో కొన్నా — Pro అనేది నిర్ణీత కాలానికి ఒక్కసారి చేసే చెల్లింపు. ఏదీ వాటంతట అదే రెన్యూ కాదు: మళ్లీ డబ్బు కట్ చేసే సబ్‌స్క్రిప్షన్ లేదు, ఆటో-పే లేదు, మీ కార్డు లేదా యూపీఐపై స్టాండింగ్ ఇన్‌స్ట్రక్షన్ లేదు. మీరు స్వయంగా మరింత సమయం కొంటేనే మళ్లీ చెల్లింపు జరుగుతుంది. ధర, కాలవ్యవధి మరియు ఏమి ఉన్నాయో చెల్లించే ముందే చూపబడతాయి.',
      ],
      items: [
        'గూగుల్ ప్లే నుండి తీసుకున్న ఆండ్రాయిడ్ యాప్‌లో: 1 నెల, 3 నెలలు లేదా 1 సంవత్సరం Pro పాస్‌ను గూగుల్ ప్లే ద్వారా కొంటారు. మీ గూగుల్ ప్లే ఖాతా నుండి ఒక్కసారి మాత్రమే చెల్లింపు జరుగుతుంది; మీరు నిర్ధారించే ముందే గూగుల్ ధర చూపిస్తుంది.',
        'వెబ్‌సైట్‌లో (మరియు మా వెబ్‌సైట్ నుండి నేరుగా డౌన్‌లోడ్ చేసిన ఆండ్రాయిడ్ యాప్‌లో): Pro ప్లాన్‌ను Razorpay ద్వారా కొంటారు.',
        'ఏదీ రెన్యూ కానందున, రద్దు చేయాల్సింది ఏమీ లేదు. గడువు తేదీన ప్రవేశం ముగుస్తుంది, మీరు ఉచిత ప్లాన్‌కు తిరిగి వస్తారు — రిమైండర్ అవసరం లేదు, మీ వైపు చర్య అవసరం లేదు, మమ్మల్ని సంప్రదించనవసరం లేదు.',
        'Pro యాక్టివ్‌గా ఉండగా మళ్లీ కొంటే మరింత సమయం కలుస్తుంది: యాప్‌లో, కొత్త పాస్‌ను గూగుల్ మీ గూగుల్ ప్లే సమయానికి కలుపుతుంది; వెబ్‌సైట్‌లో, కొత్త రోజులు మీ వెబ్‌సైట్ సమయానికి కలుస్తాయి. వెబ్‌సైట్ ప్లాన్ మరియు గూగుల్ ప్లే పాస్ వేర్వేరు కొనుగోళ్లు — రెండూ ఉంటే, రెండింటిలో ఏది ఆలస్యంగా ముగుస్తుందో అప్పటి వరకు Pro ఉంటుంది.',
        'రీఫండ్ లేదు: చెల్లింపు విజయవంతమై మీ ఖాతాలో Pro యాక్టివ్ అయిన తర్వాత మేము పూర్తిగా గానీ, వాడని సమయానికి గానీ రీఫండ్ ఇవ్వము. చెల్లింపు విజయవంతమైన క్షణమే పూర్తి ప్రశ్న బ్యాంకు తెరవబడుతుంది.',
        'గూగుల్ ప్లే తన సొంత విధానాల ప్రకారం ఇప్పటికీ రీఫండ్ ఇవ్వవచ్చు (ఉదాహరణకు అనధికార చెల్లింపు, లేదా కొనుగోలు చేసిన కొద్దిసేపటికే గూగుల్‌ను అడిగితే). ఆ నిర్ణయం గూగుల్‌దే, మాది కాదు. గూగుల్ లేదా మీ బ్యాంకు ఏదైనా చెల్లింపును రీఫండ్ చేసినా లేదా వెనక్కి తీసుకున్నా, ఆ చెల్లింపుకు సంబంధించిన Pro ప్రవేశం ముగుస్తుంది.',
        'రెండుసార్లు డబ్బు కట్ అయినా, లేదా Pro రాకుండా పొరపాటున డబ్బు కట్ అయినా, మమ్మల్ని సంప్రదించండి — సరిచేయడానికి సహాయం చేస్తాము.',
        'మీ కార్డు, యూపీఐ లేదా బ్యాంకు వివరాలను మేము చూడము, నిల్వ చేయము. వాటిని గూగుల్ ప్లే మరియు Razorpay తమ సొంత విధానాల ప్రకారం నిర్వహిస్తాయి.',
        'భవిష్యత్ కొనుగోళ్లకు ధరలు మారవచ్చు. మీరు ఇప్పటికే చెల్లించిన ప్లాన్ లేదా పాస్‌పై ప్రభావం ఉండదు.',
      ],
    },
    {
      heading: 'విషయ వినియోగం',
      body: [
        'ఈ వేదికలోని ప్రశ్నలు, వివరణలు మరియు పేపర్లు మీ వ్యక్తిగత సన్నద్ధత కోసం మాత్రమే. వాటిని కాపీ చేయడం, తిరిగి ప్రచురించడం, అమ్మడం లేదా పంచడం — స్క్రీన్‌షాట్‌లు లేదా ఎగుమతులను గ్రూపుల్లో పంచడంతో సహా — అనుమతించబడదు.',
      ],
    },
    {
      heading: 'లభ్యత',
      body: [
        'వేదికను నిరంతరం నడిపేందుకు ప్రయత్నిస్తాము, కానీ ఎల్లప్పుడూ అందుబాటులో ఉంటుందని హామీ ఇవ్వలేము. నిర్వహణ, సేవా ప్రదాత వైఫల్యం, లేదా ఊహించని కారణాల వల్ల అంతరాయం కలగవచ్చు. చెల్లించిన ప్లాన్‌లో గణనీయమైన భాగం అంతరాయం వల్ల నష్టపోతే, మాకు తెలియజేయండి — పొడిగిస్తాము.',
      ],
    },
    {
      heading: 'వినియోగం ముగించడం',
      body: [
        'మీరు ఎప్పుడైనా వాడటం ఆపవచ్చు, ఖాతాను తొలగించమని అడగవచ్చు. ప్రవేశాన్ని పంచుకునే, ప్రశ్న బ్యాంకును తీసుకోవడానికి ప్రయత్నించే, లేదా ఇతరులకు సేవను ఆటంకపరిచే ఖాతాలను మేము నిలిపివేయవచ్చు.',
      ],
    },
    {
      heading: 'నిబంధనల మార్పులు',
      body: [
        'ముఖ్యమైన మార్పులు చేస్తే అప్లికేషన్‌లో తెలియజేస్తాము. ఆ తర్వాత వేదికను వాడటం కొనసాగిస్తే మీరు ఆ మార్పును అంగీకరించినట్టే.',
      ],
    },
    {
      heading: 'వర్తించే చట్టం',
      body: [
        'ఈ నిబంధనలకు భారతదేశ చట్టాలు వర్తిస్తాయి. ఏదైనా ఫిర్యాదు ఉంటే ముందుగా మాకు రాయండి — పరిష్కరించడానికి ప్రయత్నిస్తాము. పరిష్కారం కాకపోతే, భారతదేశంలోని సంబంధిత న్యాయస్థానాలు నిర్ణయిస్తాయి.',
      ],
    },
    {
      heading: 'సంప్రదింపు',
      body: [
        'ఖాతా, చెల్లింపు, ఫిర్యాదు, లేదా ప్రశ్నలో తప్పు గురించి ఏదైనా ఉంటే rsdeducationplatform@gmail.com కు సంప్రదించండి.',
      ],
    },
  ],
}

export default function TermsPage() {
  return <LegalPage english={english} telugu={telugu} />
}
