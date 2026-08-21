'use client'

import React, { useState, useMemo } from 'react'
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Crown,
  Lock,
  Search,
  Filter,
  Check,
  Flame,
  Lightbulb,
} from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'

interface Question {
  id: number
  subject: string
  topic: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  isPro: boolean
  questionTe: string
  questionEn: string
  options: {
    key: 'A' | 'B' | 'C' | 'D'
    textTe: string
    textEn: string
  }[]
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  explanationTe: string
  explanationEn: string
}

const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 1,
    subject: 'Child Development & Pedagogy',
    topic: 'Learning Theories (Piaget & Vygotsky)',
    difficulty: 'Medium',
    isPro: false,
    questionTe: 'పియాజే సంజ్ఞానాత్మక వికాస సిద్ధాంతం ప్రకారం, పిల్లవాడు "వస్తు స్థిరత్వ భావన" (Object Permanence) ను ఏ దశలో సాధిస్తాడు?',
    questionEn: 'According to Piaget\'s Theory of Cognitive Development, in which stage does a child attain the concept of "Object Permanence"?',
    options: [
      { key: 'A', textTe: 'ఇంద్రియ చాలక దశ (Sensori-motor stage)', textEn: 'Sensori-motor stage (0 - 2 years)' },
      { key: 'B', textTe: 'పూర్వ ప్రచాలక దశ (Pre-operational stage)', textEn: 'Pre-operational stage (2 - 7 years)' },
      { key: 'C', textTe: 'మూర్త ప్రచాలక దశ (Concrete operational stage)', textEn: 'Concrete operational stage (7 - 11 years)' },
      { key: 'D', textTe: 'అమూర్త ప్రచాలక దశ (Formal operational stage)', textEn: 'Formal operational stage (11+ years)' },
    ],
    correctAnswer: 'A',
    explanationTe: 'పియాజే సిద్ధాంతం ప్రకారం ఇంద్రియ చాలక దశ (0-2 సంవత్సరాలు) చివరి నాటికి అనగా సుమారు 8-12 నెలల వయస్సులో శిశువు వస్తువు కంటికి కనబడకపోయినా అది ఉనికిలో ఉంటుందని గుర్తిస్తాడు. దీనినే "వస్తు స్థిరత్వ భావన" అంటారు.',
    explanationEn: 'In Piaget\'s sensori-motor stage (0–2 years), infants develop object permanence—the understanding that objects continue to exist even when they cannot be seen or heard.',
  },
  {
    id: 2,
    subject: 'Mathematics',
    topic: 'Number System & Arithmetic',
    difficulty: 'Medium',
    isPro: false,
    questionTe: 'రెండు సంఖ్యల గ.సా.భా (HCF) 12 మరియు వాటి క.సా.గు (LCM) 240. వాటిలో ఒక సంఖ్య 48 అయితే, రెండవ సంఖ్య ఎంత?',
    questionEn: 'The HCF of two numbers is 12 and their LCM is 240. If one of the numbers is 48, what is the second number?',
    options: [
      { key: 'A', textTe: '50', textEn: '50' },
      { key: 'B', textTe: '60', textEn: '60' },
      { key: 'C', textTe: '72', textEn: '72' },
      { key: 'D', textTe: '80', textEn: '80' },
    ],
    correctAnswer: 'B',
    explanationTe: 'సూత్రం: మొదటి సంఖ్య × రెండవ సంఖ్య = క.సా.గు × గ.సా.భా.\n48 × రెండవ సంఖ్య = 240 × 12\nరెండవ సంఖ్య = (240 × 12) / 48 = 240 / 4 = 60.',
    explanationEn: 'Formula: Product of two numbers = LCM × HCF.\nLet the second number be x.\n48 × x = 240 × 12\nx = (240 × 12) / 48 = 2880 / 48 = 60.',
  },
  {
    id: 3,
    subject: 'Language I (Telugu)',
    topic: 'Vyakaranam & Chandassu',
    difficulty: 'Hard',
    isPro: false,
    questionTe: '"రాముడు మంచి బాలుడు" - ఈ వాక్యంలో "మంచి" అనేది ఏ రకమైన విశేషణం?',
    questionEn: 'In the sentence "Ramudu manchi baludu", what type of adjective (Visheshana) is "manchi"?',
    options: [
      { key: 'A', textTe: 'గుణవాచక విశేషణం', textEn: 'Guna Vachaka Visheshana (Quality Adjective)' },
      { key: 'B', textTe: 'సంఖ్యావాచక విశేషణం', textEn: 'Sankhya Vachaka Visheshana (Numeral Adjective)' },
      { key: 'C', textTe: 'పరిమాణవాచక విశేషణం', textEn: 'Parimana Vachaka Visheshana (Quantity Adjective)' },
      { key: 'D', textTe: 'సర్వనామిక విశేషణం', textEn: 'Sarvanamika Visheshana (Pronominal Adjective)' },
    ],
    correctAnswer: 'A',
    explanationTe: 'నామవాచకం యొక్క గుణాన్ని (మంచి, చెడు, అందమైన, నల్లని మొ.) తెలిపే పదాన్ని "గుణవాచక విశేషణం" అంటారు. ఇక్కడ \'మంచి\' అనేది రాముడి స్వభావాన్ని తెలుపుతుంది.',
    explanationEn: 'Guna Vachaka Visheshanam refers to adjectives depicting quality, virtue, or characteristics of a noun.',
  },
  {
    id: 4,
    subject: 'General Science',
    topic: 'Living World & Human Physiology',
    difficulty: 'Easy',
    isPro: true,
    questionTe: 'మానవ శరీరంలో అతిపెద్ద అంతఃస్రావి గ్రంథి (Endocrine Gland) ఏది?',
    questionEn: 'Which is the largest endocrine gland in the human body?',
    options: [
      { key: 'A', textTe: 'పిట్యూటరీ గ్రంథి', textEn: 'Pituitary gland' },
      { key: 'B', textTe: 'థైరాయిడ్ గ్రంథి', textEn: 'Thyroid gland' },
      { key: 'C', textTe: 'అడ్రినల్ గ్రంథి', textEn: 'Adrenal gland' },
      { key: 'D', textTe: 'క్లోమం', textEn: 'Pancreas' },
    ],
    correctAnswer: 'B',
    explanationTe: 'మానవ శరీరంలో అతిపెద్ద అంతఃస్రావి గ్రంథి థైరాయిడ్ గ్రంథి (Thyroid gland). ఇది గొంతు భాగంలో వాయునాళానికి ఇరువైపులా సీతాకోకచిలుక ఆకారంలో ఉంటుంది. (గమనిక: శరీరంలో అతిపెద్ద సాధారణ గ్రంథి కాలేయం).',
    explanationEn: 'The thyroid gland is the largest purely endocrine gland in the human body. (Note: Liver is the largest gland overall).',
  },
  {
    id: 5,
    subject: 'Perspectives in Education',
    topic: 'RTE Act 2009 & NEP 2020',
    difficulty: 'Medium',
    isPro: true,
    questionTe: 'విద్యాహక్కు చట్టం (RTE - 2009) ప్రకారం ప్రాథమిక పాఠశాలలో (1-5 తరగతులు) 60 మంది విద్యార్థులకు ఎంతమంది ఉపాధ్యాయులు ఉండాలి?',
    questionEn: 'According to RTE Act 2009, how many teachers are mandated for up to 60 students in a Primary School (Classes 1-5)?',
    options: [
      { key: 'A', textTe: '1 ఉపాధ్యాయుడు', textEn: '1 Teacher' },
      { key: 'B', textTe: '2 ఉపాధ్యాయులు', textEn: '2 Teachers' },
      { key: 'C', textTe: '3 ఉపాధ్యాయులు', textEn: '3 Teachers' },
      { key: 'D', textTe: '4 ఉపాధ్యాయులు', textEn: '4 Teachers' },
    ],
    correctAnswer: 'B',
    explanationTe: 'RTE 2009 సెక్షన్ ప్రకారం ప్రాథమిక పాఠశాలల్లో విద్యార్థి-ఉపాధ్యాయ నిష్పత్తి:\n- 60 మంది వరకు: 2 ఉపాధ్యాయులు\n- 61 నుండి 90 వరకు: 3 ఉపాధ్యాయులు\n- 91 నుండి 120 వరకు: 4 ఉపాధ్యాయులు\n- 121 నుండి 200 వరకు: 5 ఉపాధ్యాయులు.',
    explanationEn: 'Under RTE 2009 Pupil-Teacher Ratio (PTR) norms for Primary Schools, 2 teachers are required for student enrollments up to 60.',
  },
  {
    id: 6,
    subject: 'Social Studies',
    topic: 'AP Geography & Natural Resources',
    difficulty: 'Medium',
    isPro: true,
    questionTe: 'ఆంధ్రప్రదేశ్‌లో అత్యధిక అటవీ విస్తీర్ణం కలిగిన జిల్లా ఏది?',
    questionEn: 'Which district in Andhra Pradesh has the largest forest cover area?',
    options: [
      { key: 'A', textTe: 'అల్లూరి సీతారామరాజు జిల్లా', textEn: 'Alluri Sitharama Raju district' },
      { key: 'B', textTe: 'కడప జిల్లా', textEn: 'YSR Kadapa district' },
      { key: 'C', textTe: 'చిత్తూరు జిల్లా', textEn: 'Chittoor district' },
      { key: 'D', textTe: 'కర్నూలు జిల్లా', textEn: 'Kurnool district' },
    ],
    correctAnswer: 'A',
    explanationTe: 'ఆంధ్రప్రదేశ్ పునర్వ్యవస్థీకరణ తరువాత తూర్పు కనుమలలో విస్తరించి ఉన్న అల్లూరి సీతారామరాజు జిల్లా అత్యధిక అటవీ విస్తీర్ణాన్ని కలిగి ఉంది.',
    explanationEn: 'Following Andhra Pradesh district reorganization, Alluri Sitharama Raju district holds the largest geographic forest cover in AP.',
  },
]

const SUBJECTS = [
  'All Subjects',
  'Child Development & Pedagogy',
  'Mathematics',
  'Language I (Telugu)',
  'Language II (English)',
  'General Science',
  'Social Studies',
  'Perspectives in Education',
]

export default function PracticePage() {
  const { isPremium, openModal } = usePremium()
  const [selectedSubject, setSelectedSubject] = useState('All Subjects')
  const [languageMedium, setLanguageMedium] = useState<'te' | 'en'>('te')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({})
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({})
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([])

  const filteredQuestions = useMemo(() => {
    if (selectedSubject === 'All Subjects') return SAMPLE_QUESTIONS
    return SAMPLE_QUESTIONS.filter((q) => q.subject === selectedSubject)
  }, [selectedSubject])

  const currentQ = filteredQuestions[currentIndex] || filteredQuestions[0]

  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQ) return
    if (currentQ.isPro && !isPremium) {
      openModal('practice_question_pro')
      return
    }
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: key }))
    setShowExplanation((prev) => ({ ...prev, [currentQ.id]: true }))
  }

  const toggleBookmark = (id: number) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const isAnswered = currentQ ? userAnswers[currentQ.id] !== undefined : false
  const selectedAnswer = currentQ ? userAnswers[currentQ.id] : undefined
  const isCorrect = isAnswered && selectedAnswer === currentQ.correctAnswer
  const isLocked = currentQ?.isPro && !isPremium

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <h1 className="text-xl font-black text-foreground sm:text-2xl">
              DSC / SGT Chapter Practice Bank
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Topic-wise practice questions with instant solutions & Telugu / English medium toggle
          </p>
        </div>

        {/* Medium Toggle & Pro status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-border/80 bg-card p-1 shadow-2xs">
            <button
              onClick={() => setLanguageMedium('te')}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                languageMedium === 'te'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              తెలుగు మీడియం
            </button>
            <button
              onClick={() => setLanguageMedium('en')}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                languageMedium === 'en'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              English Medium
            </button>
          </div>
        </div>
      </div>

      {/* ── Subject Filter Pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {SUBJECTS.map((sub) => (
          <button
            key={sub}
            onClick={() => {
              setSelectedSubject(sub)
              setCurrentIndex(0)
            }}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              selectedSubject === sub
                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
            }`}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* ── Main Question Panel ── */}
      {currentQ ? (
        <div className="grid gap-6 lg:grid-cols-4">
          
          {/* Left: Question Card (3 cols) */}
          <div className="lg:col-span-3 flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
            <div>
              {/* Question Metadata Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">
                    Q {currentIndex + 1} of {filteredQuestions.length}
                  </span>
                  <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {currentQ.subject}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      currentQ.difficulty === 'Easy'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : currentQ.difficulty === 'Medium'
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {currentQ.difficulty}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentQ.isPro && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                      <Crown className="h-3 w-3 fill-amber-500" /> Pro MCQ
                    </span>
                  )}
                  <button
                    onClick={() => toggleBookmark(currentQ.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition"
                    aria-label="Bookmark question"
                  >
                    {bookmarkedIds.includes(currentQ.id) ? (
                      <BookmarkCheck className="h-4 w-4 text-primary fill-primary" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Topic */}
              <div className="mt-3 text-xs text-muted-foreground font-medium">
                Topic: <span className="text-foreground font-semibold">{currentQ.topic}</span>
              </div>

              {/* Question Text */}
              <div className="mt-5">
                <p className="text-base sm:text-lg font-bold text-foreground leading-relaxed">
                  {languageMedium === 'te' ? currentQ.questionTe : currentQ.questionEn}
                </p>
                {/* Bilingual subtitle preview */}
                <p className="mt-1.5 text-xs text-muted-foreground italic">
                  {languageMedium === 'te' ? currentQ.questionEn : currentQ.questionTe}
                </p>
              </div>

              {/* Locked Overlay if Pro and User is Free */}
              {isLocked ? (
                <div className="my-8 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-6 text-center">
                  <Lock className="mx-auto h-8 w-8 text-amber-500" />
                  <h4 className="mt-3 text-base font-bold text-foreground">Pro Question Locked</h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                    This advanced AP DSC high-yield question & detailed AI video explanation is reserved for DSC Pro members.
                  </p>
                  <button
                    onClick={() => openModal('practice_lock')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-xs font-bold text-white shadow-md hover:brightness-105"
                  >
                    <Crown className="h-3.5 w-3.5" /> Unlock Pro (₹599)
                  </button>
                </div>
              ) : (
                /* Options List */
                <div className="mt-6 space-y-3">
                  {currentQ.options.map((opt) => {
                    const isChosen = selectedAnswer === opt.key
                    const isRightOption = opt.key === currentQ.correctAnswer

                    let optStyle = 'border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30'
                    if (isAnswered) {
                      if (isRightOption) {
                        optStyle = 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      } else if (isChosen && !isRightOption) {
                        optStyle = 'border-destructive bg-destructive/10 ring-1 ring-destructive/30'
                      } else {
                        optStyle = 'border-border/60 opacity-60'
                      }
                    }

                    return (
                      <button
                        key={opt.key}
                        onClick={() => handleSelectOption(opt.key)}
                        disabled={isAnswered}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${optStyle}`}
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                            isAnswered && isRightOption
                              ? 'bg-emerald-500 text-white'
                              : isAnswered && isChosen
                              ? 'bg-destructive text-white'
                              : 'border border-border bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          {opt.key}
                        </div>
                        <div className="flex-1 text-sm font-medium text-foreground">
                          {languageMedium === 'te' ? opt.textTe : opt.textEn}
                        </div>
                        {isAnswered && isRightOption && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        )}
                        {isAnswered && isChosen && !isRightOption && (
                          <XCircle className="h-5 w-5 text-destructive shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Explanation Section */}
              {isAnswered && (
                <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 animate-in fade-in-50">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Lightbulb className="h-4 w-4" />
                    <span>Detailed Solution & Concept Explanation:</span>
                  </div>
                  <p className="mt-2.5 text-xs sm:text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {languageMedium === 'te' ? currentQ.explanationTe : currentQ.explanationEn}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Nav Bar (Prev / Next) */}
            <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-5">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>

              <span className="text-xs text-muted-foreground">
                Question {currentIndex + 1} of {filteredQuestions.length}
              </span>

              <button
                onClick={() => setCurrentIndex((i) => Math.min(filteredQuestions.length - 1, i + 1))}
                disabled={currentIndex === filteredQuestions.length - 1}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right: Question Navigation Matrix & Stats (1 col) */}
          <div className="flex flex-col gap-4">
            
            {/* Quick Question Matrix */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
              <h3 className="text-xs font-bold text-foreground mb-3">Question Navigator</h3>
              <div className="grid grid-cols-4 gap-2">
                {filteredQuestions.map((q, idx) => {
                  const answered = userAnswers[q.id] !== undefined
                  const correct = answered && userAnswers[q.id] === q.correctAnswer
                  const isCurrent = idx === currentIndex

                  let boxClass = 'border-border/80 bg-muted/40 text-muted-foreground hover:border-border'
                  if (answered) {
                    boxClass = correct
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'border-destructive/50 bg-destructive/15 text-destructive font-bold'
                  }
                  if (isCurrent) {
                    boxClass += ' ring-2 ring-primary ring-offset-1 font-extrabold'
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative flex h-10 items-center justify-center rounded-xl border text-xs transition ${boxClass}`}
                    >
                      {idx + 1}
                      {q.isPro && (
                        <Crown className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Correct
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-destructive" /> Wrong
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Unattempted
                </span>
              </div>
            </div>

            {/* Practice Session Stats */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
              <h3 className="text-xs font-bold text-foreground mb-3">Session Performance</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attempted</span>
                  <span className="font-bold text-foreground">{Object.keys(userAnswers).length} / {filteredQuestions.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Correct Answers</span>
                  <span className="font-bold text-emerald-500">
                    {Object.entries(userAnswers).filter(([id, ans]) => {
                      const q = SAMPLE_QUESTIONS.find((item) => item.id === Number(id))
                      return q && q.correctAnswer === ans
                    }).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span className="font-bold text-primary">
                    {Object.keys(userAnswers).length > 0
                      ? `${Math.round(
                          (Object.entries(userAnswers).filter(([id, ans]) => {
                            const q = SAMPLE_QUESTIONS.find((item) => item.id === Number(id))
                            return q && q.correctAnswer === ans
                          }).length /
                            Object.keys(userAnswers).length) *
                            100
                        )}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              {!isPremium && (
                <button
                  onClick={() => openModal('practice_sidebar')}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105"
                >
                  <Crown className="h-3.5 w-3.5" /> Unlock 12,000+ MCQs
                </button>
              )}
            </div>

          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">No questions found in this category.</div>
      )}

    </main>
  )
}
