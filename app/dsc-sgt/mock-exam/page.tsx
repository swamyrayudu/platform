'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Timer,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  Trophy,
  Award,
  Sparkles,
  ArrowRight,
  Eye,
  Check,
  X,
  HelpCircle,
  Maximize2,
} from 'lucide-react'
import { toast } from 'sonner'

interface ExamQuestion {
  id: number
  section: string
  qTe: string
  qEn: string
  options: { key: 'A' | 'B' | 'C' | 'D'; te: string; en: string }[]
  correct: 'A' | 'B' | 'C' | 'D'
}

const SECTIONS = [
  'General Knowledge & CA',
  'Perspectives in Education',
  'Classroom Psychology',
  'Telugu (Language I)',
  'English (Language II)',
  'Mathematics',
  'Science',
  'Social Studies',
]

const EXAM_QUESTIONS: ExamQuestion[] = [
  {
    id: 1,
    section: 'General Knowledge & CA',
    qTe: 'ఆంధ్రప్రదేశ్ రాష్ట్ర చిహ్నంలో (State Emblem) ఉన్న పూర్ణకుంభం ఏ బౌద్ధ స్తూపం కళాకృతికి చెందినది?',
    qEn: 'The Poorna Kumbham depicted in the Andhra Pradesh State Emblem belongs to the artwork of which Buddhist Stupa?',
    options: [
      { key: 'A', te: 'నాగార్జునకొండ స్తూపం', en: 'Nagarjunakonda Stupa' },
      { key: 'B', te: 'అమరావతి మహాస్తూపం', en: 'Amaravati Maha Stupa' },
      { key: 'C', te: 'భట్టిప్రోలు స్తూపం', en: 'Bhattiprolu Stupa' },
      { key: 'D', te: 'శాలిహుండం స్తూపం', en: 'Salihundam Stupa' },
    ],
    correct: 'B',
  },
  {
    id: 2,
    section: 'General Knowledge & CA',
    qTe: 'ఇటీవల వార్తల్లో నిలిచిన AP DSC ఉచిత కోచింగ్ పథకం ఏ పోర్టల్ ద్వారా నిర్వహించబడుతుంది?',
    qEn: 'Through which official portal is the state digital coaching program hosted?',
    options: [
      { key: 'A', te: 'జ్ఞానభూమి (JnanaBhumi)', en: 'JnanaBhumi Portal' },
      { key: 'B', te: 'దీక్ష (DIKSHA AP)', en: 'DIKSHA AP Portal' },
      { key: 'C', te: 'మన మిత్ర (Mana Mitra)', en: 'Mana Mitra' },
      { key: 'D', te: 'ఈ-సాధన (e-Sadhana)', en: 'e-Sadhana' },
    ],
    correct: 'B',
  },
  {
    id: 3,
    section: 'Perspectives in Education',
    qTe: 'జాతీయ విద్యా విధానం 2020 (NEP 2020) ప్రకారం నూతన పాఠశాల విద్యా నిర్మాణ నమూనా (Curricular Structure) ఏది?',
    qEn: 'What is the new pedagogical and curricular structure proposed under National Education Policy (NEP 2020)?',
    options: [
      { key: 'A', te: '10 + 2 + 3', en: '10 + 2 + 3 structure' },
      { key: 'B', te: '5 + 3 + 3 + 4', en: '5 + 3 + 3 + 4 structure' },
      { key: 'C', te: '5 + 4 + 3 + 2', en: '5 + 4 + 3 + 2 structure' },
      { key: 'D', te: '3 + 5 + 3 + 4', en: '3 + 5 + 3 + 4 structure' },
    ],
    correct: 'B',
  },
  {
    id: 4,
    section: 'Classroom Psychology',
    qTe: 'కోల్‌బర్గ్ నైతిక వికాస సిద్ధాంతం ప్రకారం "మంచి బాలుడు / మంచి బాలిక" అనే స్థోమత ఏ స్థాయికి చెందినది?',
    qEn: 'According to Kohlberg\'s theory of moral development, "Good boy / Good girl" orientation belongs to which level?',
    options: [
      { key: 'A', te: 'పూర్వ సాంప్రదాయక స్థాయి (Pre-conventional)', en: 'Pre-conventional Level' },
      { key: 'B', te: 'సాంప్రదాయక స్థాయి (Conventional)', en: 'Conventional Level' },
      { key: 'C', te: 'ఉత్తర సాంప్రదాయక స్థాయి (Post-conventional)', en: 'Post-conventional Level' },
      { key: 'D', te: 'స్వయం ప్రతిపత్తి స్థాయి (Autonomous)', en: 'Autonomous Level' },
    ],
    correct: 'B',
  },
  {
    id: 5,
    section: 'Telugu (Language I)',
    qTe: '"వసుధ" పదానికి గల నానార్థాలు ఏవి?',
    qEn: 'What are the multiple meanings (Nanarthalu) for the word "Vasudha"?',
    options: [
      { key: 'A', te: 'భూమి, బంగారము', en: 'Bhumi, Bangaramu (Earth, Gold)' },
      { key: 'B', te: 'నీరు, పాలు', en: 'Water, Milk' },
      { key: 'C', te: 'సూర్యుడు, చంద్రుడు', en: 'Sun, Moon' },
      { key: 'D', te: 'ఆకాశం, గాలి', en: 'Sky, Air' },
    ],
    correct: 'A',
  },
  {
    id: 6,
    section: 'English (Language II)',
    qTe: 'Identify the grammatically correct passive voice of: "The teacher evaluated the answer sheets."',
    qEn: 'Identify the grammatically correct passive voice of: "The teacher evaluated the answer sheets."',
    options: [
      { key: 'A', te: 'The answer sheets are evaluated by the teacher.', en: 'The answer sheets are evaluated by the teacher.' },
      { key: 'B', te: 'The answer sheets were evaluated by the teacher.', en: 'The answer sheets were evaluated by the teacher.' },
      { key: 'C', te: 'The answer sheets had been evaluated by the teacher.', en: 'The answer sheets had been evaluated by the teacher.' },
      { key: 'D', te: 'The teacher was evaluated by the answer sheets.', en: 'The teacher was evaluated by the answer sheets.' },
    ],
    correct: 'B',
  },
  {
    id: 7,
    section: 'Mathematics',
    qTe: 'ఒక త్రిభుజం యొక్క మూడు కోణాల నిష్పత్తి 2 : 3 : 5 అయితే, ఆ త్రిభుజంలోని అతిపెద్ద కోణం ఎంత?',
    qEn: 'If the three angles of a triangle are in the ratio 2 : 3 : 5, what is the measure of the largest angle?',
    options: [
      { key: 'A', te: '60°', en: '60°' },
      { key: 'B', te: '75°', en: '75°' },
      { key: 'C', te: '90°', en: '90° (Right-angled triangle)' },
      { key: 'D', te: '100°', en: '100°' },
    ],
    correct: 'C',
  },
  {
    id: 8,
    section: 'Science',
    qTe: 'కిరణజన్య సంయోగక్రియలో (Photosynthesis) కాంతి చర్య (Light reaction) హరితరేణువులో ఏ భాగంలో జరుగుతుంది?',
    qEn: 'In photosynthesis, in which part of chloroplast does the light reaction take place?',
    options: [
      { key: 'A', te: 'స్ట్రోమా (Stroma)', en: 'Stroma' },
      { key: 'B', te: 'గ్రానా థైలకాయిడ్స్ (Grana Thylakoids)', en: 'Grana Thylakoids' },
      { key: 'C', te: 'మైటోకాండ్రియా (Mitochondria)', en: 'Mitochondria' },
      { key: 'D', te: 'కణద్రవ్యం (Cytoplasm)', en: 'Cytoplasm' },
    ],
    correct: 'B',
  },
  {
    id: 9,
    section: 'Social Studies',
    qTe: 'భారత రాజ్యాంగంలో ప్రాథమిక విధులను (Fundamental Duties) ఏ రాజ్యాంగ సవరణ ద్వారా చేర్చారు?',
    qEn: 'By which Constitutional Amendment Act were the Fundamental Duties incorporated into the Indian Constitution?',
    options: [
      { key: 'A', te: '42వ రాజ్యాంగ సవరణ (1976)', en: '42nd Amendment Act (1976)' },
      { key: 'B', te: '44వ రాజ్యాంగ సవరణ (1978)', en: '44th Amendment Act (1978)' },
      { key: 'C', te: '73వ రాజ్యాంగ సవరణ (1992)', en: '73rd Amendment Act (1992)' },
      { key: 'D', te: '86వ రాజ్యాంగ సవరణ (2002)', en: '86th Amendment Act (2002)' },
    ],
    correct: 'A',
  },
  {
    id: 10,
    section: 'Mathematics',
    qTe: 'ఒక వస్తువును ₹720కి అమ్మడం వలన 20% లాభం వచ్చింది. ఆ వస్తువు కొన్నవెల ఎంత?',
    qEn: 'A person gains 20% by selling an article for ₹720. What is the Cost Price (CP) of the article?',
    options: [
      { key: 'A', te: '₹550', en: '₹550' },
      { key: 'B', te: '₹600', en: '₹600' },
      { key: 'C', te: '₹620', en: '₹620' },
      { key: 'D', te: '₹640', en: '₹640' },
    ],
    correct: 'B',
  },
]

export default function MockExamPage() {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({})
  const [markedForReview, setMarkedForReview] = useState<number[]>([])
  const [visited, setVisited] = useState<number[]>([1])
  const [timeLeft, setTimeLeft] = useState<number>(150 * 60) // 150 mins
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Timer countdown
  useEffect(() => {
    if (isSubmitted) return
    const timer = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [isSubmitted])

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const currentQ = EXAM_QUESTIONS[currentIdx]

  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D') => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: key }))
    if (!visited.includes(currentQ.id)) {
      setVisited((prev) => [...prev, currentQ.id])
    }
  }

  const handleClear = () => {
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[currentQ.id]
      return next
    })
  }

  const handleMarkReview = () => {
    setMarkedForReview((prev) =>
      prev.includes(currentQ.id) ? prev.filter((id) => id !== currentQ.id) : [...prev, currentQ.id]
    )
    handleNext()
  }

  const handleNext = () => {
    if (currentIdx < EXAM_QUESTIONS.length - 1) {
      const nextId = EXAM_QUESTIONS[currentIdx + 1].id
      if (!visited.includes(nextId)) {
        setVisited((prev) => [...prev, nextId])
      }
      setCurrentIdx((i) => i + 1)
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1)
    }
  }

  const jumpToQuestion = (idx: number) => {
    const qId = EXAM_QUESTIONS[idx].id
    if (!visited.includes(qId)) {
      setVisited((prev) => [...prev, qId])
    }
    setCurrentIdx(idx)
  }

  // Calculate score
  const totalAttempted = Object.keys(answers).length
  const correctCount = Object.entries(answers).filter(([id, ans]) => {
    const q = EXAM_QUESTIONS.find((item) => item.id === Number(id))
    return q && q.correct === ans
  }).length
  const wrongCount = totalAttempted - correctCount
  const calculatedScore = correctCount * 1 // 1 mark per question for DSC SGT simulation
  const percentage = Math.round((correctCount / EXAM_QUESTIONS.length) * 100)

  // ── Render Post-Exam Report if Submitted ──
  if (isSubmitted) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card p-6 sm:p-10 shadow-xl">
          {/* Header Banner */}
          <div className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-xs">
              <Trophy className="h-8 w-8 stroke-[2.2]" />
            </div>
            <h1 className="mt-4 text-2xl sm:text-3xl font-black text-foreground">
              Mock Exam Result & Performance Scorecard
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              AP DSC / SGT Grand Mock Examination · Full Blueprint Simulation
            </p>
          </div>

          {/* Key Metrics Cards */}
          <div className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-4 text-center">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <span className="text-xs text-muted-foreground">Total Score</span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-primary">
                {calculatedScore} <span className="text-sm font-normal text-muted-foreground">/ {EXAM_QUESTIONS.length}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <span className="text-xs text-muted-foreground">Accuracy</span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-emerald-500">
                {totalAttempted > 0 ? `${Math.round((correctCount / totalAttempted) * 100)}%` : '0%'}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <span className="text-xs text-muted-foreground">State Rank (Est.)</span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-amber-500">
                #42 <span className="text-xs font-semibold text-muted-foreground">/ 14,280</span>
              </p>
            </div>
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
              <span className="text-xs text-muted-foreground">Percentile</span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
                {percentage > 70 ? '97.2%' : '84.5%'}
              </p>
            </div>
          </div>

          {/* Breakdown Pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" /> {correctCount} Correct
            </span>
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" /> {wrongCount} Incorrect
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" /> {EXAM_QUESTIONS.length - totalAttempted} Unattempted
            </span>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-border/60 pt-6">
            <button
              onClick={() => {
                setIsSubmitted(false)
                setAnswers({})
                setMarkedForReview([])
                setCurrentIdx(0)
                setTimeLeft(150 * 60)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition"
            >
              <RotateCcw className="h-4 w-4" /> Re-attempt Mock Exam
            </button>
            <Link
              href="/dsc-sgt/performance"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              <span>View In-depth Subject Analytics</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Detailed Question Review List */}
          <div className="mt-10">
            <h3 className="text-base font-bold text-foreground mb-4">Detailed Question Analysis & Solution Key</h3>
            <div className="space-y-4">
              {EXAM_QUESTIONS.map((q, idx) => {
                const userAns = answers[q.id]
                const isRight = userAns === q.correct
                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border p-4.5 transition ${
                      !userAns
                        ? 'border-border/70 bg-card'
                        : isRight
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-destructive/40 bg-destructive/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                      <span className="text-xs font-bold text-foreground">
                        Q{idx + 1}. <span className="text-muted-foreground font-normal">({q.section})</span>
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          !userAns
                            ? 'bg-muted text-muted-foreground'
                            : isRight
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-destructive/20 text-destructive'
                        }`}
                      >
                        {!userAns ? 'Skipped' : isRight ? 'Correct (+1)' : 'Incorrect (0)'}
                      </span>
                    </div>

                    <p className="mt-2.5 text-sm font-semibold text-foreground">{q.qTe}</p>
                    <p className="text-xs text-muted-foreground italic mt-0.5">{q.qEn}</p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                      {q.options.map((opt) => (
                        <div
                          key={opt.key}
                          className={`rounded-xl border p-2.5 flex items-center gap-2 ${
                            opt.key === q.correct
                              ? 'border-emerald-500 bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400'
                              : userAns === opt.key
                              ? 'border-destructive bg-destructive/10 font-bold text-destructive'
                              : 'border-border/60 bg-card text-muted-foreground'
                          }`}
                        >
                          <span className="font-bold">{opt.key}.</span>
                          <span>{opt.te}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </main>
    )
  }

  // ── Live Simulator Layout ──
  return (
    <main className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      
      {/* ── Top Simulator Toolbar ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs">
        <div>
          <h1 className="text-sm sm:text-base font-black text-foreground">
            AP DSC / SGT Live Grand Mock Exam 2026
          </h1>
          <span className="text-[11px] text-muted-foreground">Section: <strong>{currentQ.section}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          {/* Countdown Clock */}
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-mono font-bold text-red-500 animate-pulse">
            <Timer className="h-4 w-4" />
            <span>Time Left: {formatTimer(timeLeft)}</span>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Submit Exam</span>
          </button>
        </div>
      </div>

      {/* ── Main Exam Container: Question + Palette ── */}
      <div className="grid gap-5 lg:grid-cols-4">
        
        {/* Left: Question Box (3 cols) */}
        <div className="lg:col-span-3 flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 sm:p-8 shadow-xs min-h-[520px]">
          <div>
            {/* Question Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3.5">
              <span className="text-xs font-extrabold text-primary">
                Question {currentIdx + 1} of {EXAM_QUESTIONS.length}
              </span>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <span>Marks: +1.0</span>
                <span>·</span>
                <span>Negative: 0.0</span>
              </div>
            </div>

            {/* Question Content */}
            <div className="mt-5">
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-relaxed">
                {currentQ.qTe}
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground italic">
                {currentQ.qEn}
              </p>
            </div>

            {/* Options */}
            <div className="mt-6 space-y-3">
              {currentQ.options.map((opt) => {
                const isSelected = answers[currentQ.id] === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(opt.key)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                        : 'border-border/80 bg-card hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      {opt.key}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{opt.te}</p>
                      <p className="text-[11px] text-muted-foreground italic">{opt.en}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkReview}
                className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  markedForReview.includes(currentQ.id)
                    ? 'border-purple-500 bg-purple-500/10 text-purple-600'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {markedForReview.includes(currentQ.id) ? 'Marked for Review' : 'Mark for Review & Next'}
              </button>
              <button
                onClick={handleClear}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Clear Response
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIdx === 0}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={currentIdx === EXAM_QUESTIONS.length - 1}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save & Next
              </button>
            </div>
          </div>
        </div>

        {/* Right: Question Navigation Palette (1 col) */}
        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
            <h3 className="text-xs font-bold text-foreground mb-3">Question Palette</h3>
            
            {/* Palette Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground border-b border-border/60 pb-3 mb-4">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-emerald-500 text-white flex items-center justify-center font-bold text-[8px]">✓</span>
                Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-destructive text-white flex items-center justify-center font-bold text-[8px]">✗</span>
                Not Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-purple-500 text-white flex items-center justify-center font-bold text-[8px]">●</span>
                Marked Review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-muted text-muted-foreground border border-border flex items-center justify-center text-[8px]">-</span>
                Not Visited
              </span>
            </div>

            {/* Matrix Grid */}
            <div className="grid grid-cols-5 gap-2">
              {EXAM_QUESTIONS.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined
                const isMarked = markedForReview.includes(q.id)
                const isVisited = visited.includes(q.id)
                const isCurrent = idx === currentIdx

                let btnColor = 'bg-muted border-border text-muted-foreground'
                if (isMarked) {
                  btnColor = 'bg-purple-500 text-white font-bold'
                } else if (isAnswered) {
                  btnColor = 'bg-emerald-500 text-white font-bold'
                } else if (isVisited) {
                  btnColor = 'bg-destructive text-white font-bold'
                }

                if (isCurrent) {
                  btnColor += ' ring-2 ring-primary ring-offset-2'
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => jumpToQuestion(idx)}
                    className={`h-9 w-full rounded-xl text-xs font-semibold transition ${btnColor}`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick Summary Box */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs text-xs space-y-2">
            <h4 className="font-bold text-foreground mb-2">Summary</h4>
            <div className="flex justify-between text-muted-foreground">
              <span>Answered:</span>
              <span className="font-bold text-emerald-500">{Object.keys(answers).length}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Marked for Review:</span>
              <span className="font-bold text-purple-500">{markedForReview.length}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Remaining:</span>
              <span className="font-bold text-foreground">{EXAM_QUESTIONS.length - Object.keys(answers).length}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Submit Confirmation Dialog Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl text-foreground">
            <h3 className="text-lg font-black">Submit Mock Exam?</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              You have answered <strong className="text-foreground">{Object.keys(answers).length}</strong> out of {EXAM_QUESTIONS.length} questions. Are you sure you want to finalize your submission?
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Resume Test
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setIsSubmitted(true)
                  toast.success('Exam Submitted Successfully!')
                }}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
