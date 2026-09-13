// ============================================================
// app/components/landing/DashboardIllustration.tsx — App mockup graphic
// ============================================================
// Recoloured to the Bloom palette and stripped of card chrome, so it can sit
// directly on a tinted surface the way the reference's 3D renders do.
'use client'

import React from 'react'

export default function DashboardIllustration() {
  return (
    <div className="relative flex w-full items-center justify-center">
      {/* Soft ambient glow behind the device */}
      <div className="absolute h-24 w-32 rounded-full bg-bloom-violet/25 blur-2xl" />

      <svg
        className="relative h-auto w-full drop-shadow-lg"
        viewBox="0 0 360 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Laptop frame */}
        <rect x="50" y="20" width="260" height="155" rx="12" fill="#2e2b55" />
        <rect x="56" y="26" width="248" height="143" rx="8" fill="#f7f6fc" />

        {/* App header bar */}
        <rect x="56" y="26" width="248" height="24" rx="8" fill="#ffffff" />
        <rect x="56" y="42" width="248" height="8" fill="#ffffff" />
        <circle cx="69" cy="38" r="5" fill="#7e71cd" />
        <rect x="80" y="35" width="40" height="6" rx="3" fill="#c9c4ee" />
        <rect x="250" y="33" width="46" height="10" rx="5" fill="#ebe9f7" />

        {/* Sidebar */}
        <rect x="56" y="50" width="36" height="119" fill="#ffffff" />
        <rect x="63" y="61" width="22" height="4" rx="2" fill="#2e2b55" />
        <rect x="63" y="73" width="22" height="4" rx="2" fill="#ddd9f5" />
        <rect x="63" y="85" width="22" height="4" rx="2" fill="#ddd9f5" />
        <rect x="63" y="97" width="22" height="4" rx="2" fill="#ddd9f5" />

        {/* Stat card — mock tests */}
        <rect x="100" y="59" width="60" height="45" rx="8" fill="#ffffff" stroke="#e9e7f8" />
        <rect x="106" y="65" width="30" height="4" rx="2" fill="#a9a3e4" />
        <text x="106" y="86" fill="#2e2b55" fontSize="13" fontWeight="600">24</text>
        <rect x="137" y="76" width="18" height="8" rx="4" fill="#ddd9f5" />

        {/* Stat card — papers solved */}
        <rect x="166" y="59" width="60" height="45" rx="8" fill="#ffffff" stroke="#e9e7f8" />
        <rect x="172" y="65" width="35" height="4" rx="2" fill="#a9a3e4" />
        <text x="172" y="86" fill="#2e2b55" fontSize="13" fontWeight="600">120</text>
        <rect x="202" y="76" width="18" height="8" rx="4" fill="#ddd9f5" />

        {/* Performance chart card */}
        <rect x="100" y="111" width="126" height="52" rx="8" fill="#ffffff" stroke="#e9e7f8" />
        <rect x="106" y="117" width="45" height="4" rx="2" fill="#a9a3e4" />
        <text x="106" y="133" fill="#7e71cd" fontSize="12" fontWeight="600">85%</text>
        <rect x="106" y="143" width="16" height="14" rx="3" fill="#ddd9f5" />
        <rect x="128" y="137" width="16" height="20" rx="3" fill="#c9c4ee" />
        <rect x="150" y="131" width="16" height="26" rx="3" fill="#a9a3e4" />
        <rect x="172" y="126" width="16" height="31" rx="3" fill="#7e71cd" />
        <rect x="194" y="135" width="16" height="22" rx="3" fill="#c9c4ee" />

        {/* Side panel */}
        <rect x="232" y="59" width="66" height="104" rx="8" fill="#ebe9f7" />
        <rect x="240" y="69" width="34" height="4" rx="2" fill="#a9a3e4" />
        <rect x="240" y="81" width="50" height="4" rx="2" fill="#ddd9f5" />
        <rect x="240" y="91" width="42" height="4" rx="2" fill="#ddd9f5" />
        <circle cx="265" cy="126" r="20" fill="none" stroke="#ddd9f5" strokeWidth="7" />
        <path
          d="M265 106a20 20 0 0 1 17.3 30"
          fill="none"
          stroke="#7e71cd"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Laptop base */}
        <path d="M25 175H335L310 191H50L25 175Z" fill="#c9c4ee" />
        <rect x="150" y="178" width="60" height="4" rx="2" fill="#a9a3e4" />

        {/* Stack of books */}
        <path d="M12 155L45 150V160L12 165Z" fill="#7e71cd" />
        <path d="M12 162L45 157V167L12 172Z" fill="#a9a3e4" />
        <path d="M12 169L45 164V174L12 179Z" fill="#c9c4ee" />

        {/* Bloom in a pot */}
        <path d="M36 142H48L46 153H38L36 142Z" fill="#2e2b55" />
        <circle cx="42" cy="137" r="4.5" fill="#7e71cd" />
        <circle cx="45.5" cy="133" r="3" fill="#a9a3e4" />
      </svg>
    </div>
  )
}
