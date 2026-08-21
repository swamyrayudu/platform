// ============================================================
// app/components/home/examData.ts — Exam list data & types
// ============================================================

import {
  GraduationCap,
  ClipboardList,
  TrainTrack,
  Landmark,
  Shield,
  Building2,
  type LucideIcon,
} from 'lucide-react'

export interface ExamItem {
  id: string
  label: string
  sublabel: string
  tag: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  badgeVariant: 'live' | 'soon'
  available: boolean
  meta: string
}

export const EXAMS: ExamItem[] = [
  {
    id: 'dsc-sgt-ap',
    label: 'DSC / SGT',
    sublabel: 'School Grade Teacher',
    tag: 'Andhra Pradesh',
    icon: GraduationCap,
    iconBg: 'bg-primary text-primary-foreground',
    iconColor: '',
    badgeVariant: 'live',
    available: true,
    meta: 'Govt. of AP · Latest Syllabus',
  },
  {
    id: 'dsc-tet-ap',
    label: 'DSC / TET',
    sublabel: 'Teacher Eligibility Test',
    tag: 'Andhra Pradesh',
    icon: ClipboardList,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    badgeVariant: 'soon',
    available: false,
    meta: 'Paper I & Paper II',
  },
  {
    id: 'railway-scr',
    label: 'Railway',
    sublabel: 'RRB / RRC Recruitment',
    tag: 'South Central Railway',
    icon: TrainTrack,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    badgeVariant: 'soon',
    available: false,
    meta: 'Group D · NTPC · ALP',
  },
  {
    id: 'appsc-ap',
    label: 'APPSC',
    sublabel: 'AP Public Service Commission',
    tag: 'Andhra Pradesh',
    icon: Landmark,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    badgeVariant: 'soon',
    available: false,
    meta: 'Group 1 · 2 · 3 · Panchayat Sec',
  },
  {
    id: 'ap-police',
    label: 'AP Police',
    sublabel: 'Police Recruitment',
    tag: 'Andhra Pradesh',
    icon: Shield,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    badgeVariant: 'soon',
    available: false,
    meta: 'Constable · SI · DSP',
  },
  {
    id: 'banking',
    label: 'Banking',
    sublabel: 'IBPS · SBI · RRB',
    tag: 'All India',
    icon: Building2,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    badgeVariant: 'soon',
    available: false,
    meta: 'PO · Clerk · SO',
  },
]
