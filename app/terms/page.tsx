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
  title: 'Terms of Service — rsdeducation',
  description:
    'The terms you agree to when using rsdeducation, including what the platform does and does not promise.',
}

const english: LegalDocument = {
  title: 'Terms of Service',
  updated: 'Last updated 15 September 2026',
  intro: [
    'rsdeducation is a practice platform for the AP DSC SGT examination. By creating an account or using the platform you agree to these terms. Please read the section on what we do not promise — it is the most important part of this document.',
  ],
  sections: [
    {
      heading: 'What this platform is',
      body: [
        'rsdeducation gives you practice questions, full-length mock papers and a record of how you performed on them, in Telugu and English medium. It is a study aid. It is not a coaching institute, not a recruitment service, and not connected to any government body.',
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
        'You sign in with Google. One account is meant for one person. Sharing your account, or signing in from many devices to give other people access, may result in the account being suspended without a refund.',
        'You are responsible for what happens under your account. Signing out of all devices is available in your profile menu if you think someone else has access.',
      ],
    },
    {
      heading: 'Payments, plans, cancellation and refunds',
      body: [
        'Plans are a one-time payment for a fixed period. There is no subscription, no auto-renewal and no standing instruction on your card or UPI — nothing is ever charged again unless you deliberately buy another plan.',
      ],
      items: [
        'The price, the duration and what is included are all shown before you pay.',
        'Because nothing renews, there is nothing to cancel. Access ends on its expiry date and you return to the free plan — no reminder, no action and no contact with us is needed.',
        'A plan cannot be cancelled part-way through for a partial refund. Once it is active it runs to its expiry date.',
        'Because the full question bank is unlocked the moment payment succeeds, we do not offer refunds once a plan is active. If a payment was taken in error, or you were charged twice, contact us and we will put it right.',
        'Buying another plan while one is still running adds its days to what you already have; it does not replace or shorten it.',
        'Payments are handled by Razorpay. We never see or store your card, UPI or bank details.',
        'We may change prices for future purchases. A plan you have already paid for is not affected.',
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
      heading: 'Contact',
      body: [
        'For anything about your account, a payment, or a mistake in a question, contact rsdeducationplatform@gmail.com.',
      ],
    },
  ],
}

const telugu: LegalDocument = {
  title: 'నిబంధనలు మరియు షరతులు',
  updated: 'చివరిగా నవీకరించబడింది: 15 సెప్టెంబర్ 2026',
  intro: [
    'rsdeducation అనేది ఏపీ డీఎస్సీ ఎస్‌జీటీ పరీక్ష కోసం ఒక ప్రాక్టీస్ వేదిక. ఖాతా తెరిచినప్పుడు లేదా ఈ వేదికను ఉపయోగించినప్పుడు మీరు ఈ నిబంధనలకు అంగీకరిస్తున్నారు. "మేము ఏమి హామీ ఇవ్వము" అనే భాగాన్ని తప్పకుండా చదవండి — ఈ పత్రంలో అదే అత్యంత ముఖ్యమైనది.',
  ],
  sections: [
    {
      heading: 'ఈ వేదిక ఏమిటి',
      body: [
        'rsdeducation మీకు ప్రాక్టీస్ ప్రశ్నలు, పూర్తి నిడివి మాక్ పేపర్లు, మరియు మీ ప్రదర్శన రికార్డును తెలుగు మరియు ఇంగ్లీష్ మాధ్యమాల్లో అందిస్తుంది. ఇది ఒక చదువు సహాయకం మాత్రమే. ఇది కోచింగ్ సెంటర్ కాదు, నియామక సంస్థ కాదు, ఏ ప్రభుత్వ విభాగంతోనూ సంబంధం లేదు.',
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
        'మీరు గూగుల్‌తో సైన్ ఇన్ చేస్తారు. ఒక ఖాతా ఒక వ్యక్తికి మాత్రమే. ఖాతాను పంచుకోవడం, లేదా ఇతరులకు ప్రవేశం ఇవ్వడానికి అనేక పరికరాల నుండి సైన్ ఇన్ చేయడం వలన ఖాతా రద్దు కావచ్చు — డబ్బు తిరిగి ఇవ్వబడదు.',
        'మీ ఖాతా కింద జరిగే దానికి మీరే బాధ్యులు. ఎవరైనా మీ ఖాతాను వాడుతున్నారని అనిపిస్తే, ప్రొఫైల్ మెనూలో "అన్ని పరికరాల నుండి సైన్ అవుట్" ఎంపిక ఉంది.',
      ],
    },
    {
      heading: 'చెల్లింపులు, ప్లాన్లు, రద్దు మరియు రీఫండ్‌లు',
      body: [
        'ప్లాన్లు నిర్ణీత కాలానికి ఒక్కసారి చేసే చెల్లింపు. ఇది సబ్‌స్క్రిప్షన్ కాదు — ఆటో-రెన్యువల్ లేదు, మీ కార్డు లేదా యూపీఐపై ఎలాంటి స్టాండింగ్ ఇన్‌స్ట్రక్షన్ ఉండదు. మీరు స్వయంగా మరో ప్లాన్ కొనకపోతే మళ్లీ ఎప్పుడూ డబ్బు కట్ కాదు.',
      ],
      items: [
        'ధర, కాలవ్యవధి మరియు ఏమి ఉన్నాయో చెల్లించే ముందే చూపబడతాయి.',
        'ఏదీ రెన్యూ కానందున, రద్దు చేయాల్సిన అవసరమే లేదు. గడువు తేదీన ప్రవేశం ముగుస్తుంది, మీరు ఉచిత ప్లాన్‌కు తిరిగి వస్తారు — రిమైండర్ అవసరం లేదు, మీ వైపు చర్య అవసరం లేదు, మమ్మల్ని సంప్రదించనవసరం లేదు.',
        'ప్లాన్ మధ్యలో రద్దు చేసి పాక్షిక రీఫండ్ పొందడం సాధ్యం కాదు. ఒకసారి యాక్టివ్ అయిన తర్వాత అది గడువు తేదీ వరకు కొనసాగుతుంది.',
        'చెల్లింపు విజయవంతమైన క్షణమే పూర్తి ప్రశ్న బ్యాంకు తెరవబడుతుంది కాబట్టి, ప్లాన్ యాక్టివ్ అయిన తర్వాత రీఫండ్ ఇవ్వము. పొరపాటున చెల్లింపు జరిగితే లేదా రెండుసార్లు డబ్బు కట్ అయితే మమ్మల్ని సంప్రదించండి, సరిచేస్తాము.',
        'ఒక ప్లాన్ నడుస్తుండగా మరో ప్లాన్ కొంటే, దాని రోజులు మీ ప్రస్తుత కాలానికి కలుపబడతాయి — అది మార్చబడదు లేదా తగ్గించబడదు.',
        'చెల్లింపులను Razorpay నిర్వహిస్తుంది. మీ కార్డు, యూపీఐ లేదా బ్యాంకు వివరాలను మేము చూడము, నిల్వ చేయము.',
        'భవిష్యత్ కొనుగోళ్లకు ధరలు మారవచ్చు. మీరు ఇప్పటికే చెల్లించిన ప్లాన్‌పై ప్రభావం ఉండదు.',
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
      heading: 'సంప్రదింపు',
      body: [
        'ఖాతా, చెల్లింపు, లేదా ప్రశ్నలో తప్పు గురించి ఏదైనా ఉంటే rsdeducationplatform@gmail.com కు సంప్రదించండి.',
      ],
    },
  ],
}

export default function TermsPage() {
  return <LegalPage english={english} telugu={telugu} />
}
