// ============================================================
// app/components/landing/DashboardIllustration.tsx — 3D App Mockup Graphic
// ============================================================
'use client'

import React from 'react'

export default function DashboardIllustration() {
  return (
    <div className="my-7 flex items-center justify-center rounded-2xl border border-border/70 bg-card p-6 shadow-2xs">
      <div className="relative flex w-full max-w-md items-center justify-center">
        
        {/* Soft decorative ambient glow */}
        <div className="absolute -left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-xl" />
        <div className="absolute -right-4 bottom-2 h-28 w-28 rounded-full bg-primary/10 blur-xl" />

        <svg
          className="relative h-44 w-auto drop-shadow-md sm:h-52"
          viewBox="0 0 360 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Laptop Frame */}
          <rect x="50" y="20" width="260" height="155" rx="10" fill="#0F172A" />
          <rect x="55" y="25" width="250" height="145" rx="6" fill="#F8FAFC" />

          {/* App Header Bar */}
          <rect x="55" y="25" width="250" height="24" fill="#FFFFFF" />
          <circle cx="68" cy="37" r="5" fill="#2563EB" />
          <rect x="80" y="34" width="40" height="6" rx="3" fill="#94A3B8" />
          <rect x="250" y="32" width="45" height="10" rx="5" fill="#EFF6FF" />

          {/* Sidebar Navigation */}
          <rect x="55" y="49" width="35" height="121" fill="#FFFFFF" />
          <rect x="62" y="60" width="20" height="4" rx="2" fill="#CBD5E1" />
          <rect x="62" y="72" width="20" height="4" rx="2" fill="#CBD5E1" />
          <rect x="62" y="84" width="20" height="4" rx="2" fill="#CBD5E1" />
          <rect x="62" y="96" width="20" height="4" rx="2" fill="#CBD5E1" />

          {/* Content Cards */}
          {/* Mock Tests Card */}
          <rect x="98" y="58" width="60" height="45" rx="6" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="104" y="64" width="30" height="4" rx="2" fill="#64748B" />
          <text x="104" y="84" fill="#0F172A" fontSize="13" fontWeight="bold">24</text>
          <rect x="135" y="74" width="18" height="8" rx="4" fill="#DCFCE7" />

          {/* PYQs Solved Card */}
          <rect x="164" y="58" width="60" height="45" rx="6" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="170" y="64" width="35" height="4" rx="2" fill="#64748B" />
          <text x="170" y="84" fill="#0F172A" fontSize="13" fontWeight="bold">120</text>
          <rect x="200" y="74" width="18" height="8" rx="4" fill="#DCFCE7" />

          {/* Performance Chart Card */}
          <rect x="98" y="110" width="126" height="52" rx="6" fill="#FFFFFF" stroke="#E2E8F0" />
          <rect x="104" y="116" width="45" height="4" rx="2" fill="#64748B" />
          <text x="104" y="132" fill="#2563EB" fontSize="12" fontWeight="bold">85%</text>
          <rect x="104" y="142" width="16" height="14" rx="2" fill="#93C5FD" />
          <rect x="126" y="136" width="16" height="20" rx="2" fill="#3B82F6" />
          <rect x="148" y="130" width="16" height="26" rx="2" fill="#2563EB" />
          <rect x="170" y="125" width="16" height="31" rx="2" fill="#1D4ED8" />
          <rect x="192" y="134" width="16" height="22" rx="2" fill="#60A5FA" />

          {/* Laptop Base */}
          <path d="M25 175H335L310 190H50L25 175Z" fill="#CBD5E1" />
          <rect x="150" y="177" width="60" height="4" rx="2" fill="#94A3B8" />

          {/* Books Stack */}
          <path d="M12 155L45 150L45 160L12 165Z" fill="#3B82F6" />
          <path d="M12 162L45 157L45 167L12 172Z" fill="#10B981" />
          <path d="M12 169L45 164L45 174L12 179Z" fill="#F59E0B" />

          {/* Plant Pot */}
          <path d="M36 142H48L46 153H38L36 142Z" fill="#64748B" />
          <circle cx="42" cy="138" r="4" fill="#10B981" />
          <circle cx="45" cy="135" r="3" fill="#34D399" />
        </svg>
      </div>
    </div>
  )
}
