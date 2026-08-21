'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { toast } from 'sonner'

export type PremiumPlan = 'free' | 'pro_sprint' | 'pro_full' | 'lifetime'

interface PremiumContextType {
  isPremium: boolean
  currentPlan: PremiumPlan
  isModalOpen: boolean
  openModal: (source?: string) => void
  closeModal: () => void
  upgradePlan: (plan: PremiumPlan) => void
  resetToFree: () => void
  modalSource: string
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined)

const STORAGE_KEY = 'rsd_dsc_sgt_premium_status'

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState<boolean>(false)
  const [currentPlan, setCurrentPlan] = useState<PremiumPlan>('free')
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [modalSource, setModalSource] = useState<string>('header')

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setIsPremium(parsed.isPremium ?? false)
        setCurrentPlan(parsed.currentPlan ?? 'free')
      }
    } catch {
      // ignore
    }
  }, [])

  const openModal = (source = 'header') => {
    setModalSource(source)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const upgradePlan = (plan: PremiumPlan) => {
    setIsPremium(true)
    setCurrentPlan(plan)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isPremium: true, currentPlan: plan }))
    } catch {
      // ignore
    }
    setIsModalOpen(false)
    toast.success('🎉 Welcome to DSC / SGT Pro!', {
      description: 'All 150+ Mock Tests, Grand Exams, and AI Explanations are now unlocked.',
      duration: 5000,
    })
  }

  const resetToFree = () => {
    setIsPremium(false)
    setCurrentPlan('free')
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    toast.info('Switched to Free Tier', {
      description: 'You are now previewing the standard free content.',
    })
  }

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        currentPlan,
        isModalOpen,
        openModal,
        closeModal,
        upgradePlan,
        resetToFree,
        modalSource,
      }}
    >
      {children}
    </PremiumContext.Provider>
  )
}

export function usePremium() {
  const context = useContext(PremiumContext)
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider')
  }
  return context
}
