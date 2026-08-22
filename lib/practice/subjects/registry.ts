// ============================================================
// lib/practice/subjects/registry.ts — DSC Subject Provider Registry
// ============================================================

import type { SubjectMetadata, SubjectProvider } from './types'
import { EnglishSubjectProvider } from './english'
import { TeluguSubjectProvider } from './telugu'
import { MathematicsSubjectProvider } from './mathematics'
import { ScienceSubjectProvider } from './science'
import { SocialStudiesSubjectProvider } from './social-studies'
import { PedagogySubjectProvider } from './pedagogy'

// Registered subject providers map (keyed by lowercase subject id/name)
const providersMap: Map<string, SubjectProvider> = new Map()

// Register standard DSC subjects
function initRegistry() {
  const defaults: SubjectProvider[] = [
    new EnglishSubjectProvider(),
    new TeluguSubjectProvider(),
    new MathematicsSubjectProvider(),
    new ScienceSubjectProvider(),
    new SocialStudiesSubjectProvider(),
    new PedagogySubjectProvider(),
  ]

  defaults.forEach((p) => {
    providersMap.set(p.metadata.id.toLowerCase(), p)
    providersMap.set(p.metadata.name.toLowerCase(), p)
  })
}

initRegistry()

/**
 * Register a custom or third-party subject provider
 */
export function registerSubjectProvider(provider: SubjectProvider) {
  providersMap.set(provider.metadata.id.toLowerCase(), provider)
  providersMap.set(provider.metadata.name.toLowerCase(), provider)
}

/**
 * Get subject provider by subject name or id (case-insensitive)
 */
export function getSubjectProvider(subjectName: string): SubjectProvider | undefined {
  return providersMap.get(subjectName.toLowerCase())
}

/**
 * Get list of all registered unique subject providers
 */
export function getAllSubjectProviders(): SubjectProvider[] {
  const unique = new Map<string, SubjectProvider>()
  providersMap.forEach((provider) => {
    unique.set(provider.metadata.id, provider)
  })
  return Array.from(unique.values())
}

/**
 * Get metadata for all available subjects
 */
export function getAllSubjectMetadata(): SubjectMetadata[] {
  return getAllSubjectProviders().map((p) => p.metadata)
}
