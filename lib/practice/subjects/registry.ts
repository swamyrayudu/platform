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
import { GKSubjectProvider } from './gk'

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
    new GKSubjectProvider(),
  ]

  defaults.forEach((p) => {
    providersMap.set(p.metadata.id.toLowerCase(), p)
    providersMap.set(p.metadata.name.toLowerCase(), p)
  })

  // Aliases for Mathematics
  const mathProvider = defaults.find((p) => p.metadata.id === 'Mathematics')
  if (mathProvider) {
    providersMap.set('math', mathProvider)
    providersMap.set('maths', mathProvider)
    providersMap.set('గణితం', mathProvider)
    providersMap.set('గణిత శాస్త్రం', mathProvider)
    providersMap.set('telugu medium math', mathProvider)
    providersMap.set('telugu medium mathematics', mathProvider)
  }

  // Aliases for Pedagogy / CDP / Educational Psychology + Perspectives in Education
  const pedProvider = defaults.find(
    (p) =>
      p.metadata.id === 'Educational Psychology + Perspectives in Education' ||
      p.metadata.id === 'Pedagogy'
  )
  if (pedProvider) {
    providersMap.set('pedagogy', pedProvider)
    providersMap.set('educational psychology', pedProvider)
    providersMap.set('perspectives in education', pedProvider)
    providersMap.set('educational psychology + perspectives in education', pedProvider)
    providersMap.set('educational psychology & perspectives in education', pedProvider)
    providersMap.set('educational psychology and perspectives in education', pedProvider)
    providersMap.set('psychology', pedProvider)
    providersMap.set('cdp', pedProvider)
    providersMap.set('child development', pedProvider)
    providersMap.set('సైకాలజీ & బోధన', pedProvider)
    providersMap.set('సైకాలజీ', pedProvider)
    providersMap.set('విద్యా దృక్పథాలు', pedProvider)
    providersMap.set('విద్యా మనోవిజ్ఞాన శాస్త్రం', pedProvider)
    providersMap.set('విద్యా మనోవిజ్ఞాన శాస్త్రం & విద్యా దృక్పథాలు', pedProvider)
  }

  // Aliases for Science (Telugu & English Medium)
  const sciProvider = defaults.find((p) => p.metadata.id === 'Science')
  if (sciProvider) {
    providersMap.set('sci', sciProvider)
    providersMap.set('general science', sciProvider)
    providersMap.set('సైన్స్', sciProvider)
    providersMap.set('సాధారణ సైన్స్', sciProvider)
    providersMap.set('భౌతిక రసాయన శాస్త్రాలు', sciProvider)
    providersMap.set('జీవశాస్త్రం', sciProvider)
    providersMap.set('biological science', sciProvider)
    providersMap.set('physical science', sciProvider)
    providersMap.set('telugu medium science', sciProvider)
    providersMap.set('english medium science', sciProvider)
    providersMap.set('evs', sciProvider)
    providersMap.set('పరిసరాల విజ్ఞానం', sciProvider)
  }

  // Aliases for GK & Current Affairs
  const gkProvider = defaults.find((p) => p.metadata.id === 'GK & Current Affairs')
  if (gkProvider) {
    providersMap.set('gk', gkProvider)
    providersMap.set('current affairs', gkProvider)
    providersMap.set('general knowledge', gkProvider)
    providersMap.set('general knowledge & current affairs', gkProvider)
    providersMap.set('gk & current affairs', gkProvider)
    providersMap.set('gk & ca', gkProvider)
    providersMap.set('gk and current affairs', gkProvider)
    providersMap.set('సాధారణ జ్ఞానం', gkProvider)
    providersMap.set('సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు', gkProvider)
    providersMap.set('వర్తమాన వ్యవహారాలు', gkProvider)
    providersMap.set('gk_english_medium', gkProvider)
    providersMap.set('gk_telugu_medium', gkProvider)
  }
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
