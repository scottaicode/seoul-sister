import type { SpecialistType } from './database'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  specialist_type: SpecialistType | null
  image_urls: string[]
  timestamp: string
  isStreaming?: boolean
}

export interface ConversationSummary {
  id: string
  title: string | null
  specialist_type: SpecialistType | null
  message_count: number
  last_message_preview: string | null
  updated_at: string
}

export interface SpecialistAgent {
  type: SpecialistType
  name: string
  role: string
  icon: string
  description: string
}

export const SPECIALIST_AGENTS: SpecialistAgent[] = [
  {
    type: 'ingredient_analyst',
    name: 'Ingredient Analyst',
    role: 'Deep ingredient science and safety analysis',
    icon: 'flask',
    description: 'Analyzes ingredient interactions, concentrations, and safety profiles for your skin type.',
  },
  {
    type: 'routine_architect',
    name: 'Routine Architect',
    role: 'Personalized routine builder',
    icon: 'layers',
    description: 'Builds optimized AM/PM routines with proper layering order and skin cycling schedules.',
  },
  {
    type: 'authenticity_investigator',
    name: 'Authenticity Investigator',
    role: 'Counterfeit detection expert',
    icon: 'shield-check',
    description: 'Identifies counterfeit markers and verifies product authenticity through packaging analysis.',
  },
  {
    type: 'trend_scout',
    name: 'Trend Scout',
    role: 'Korean beauty trend tracker',
    icon: 'trending-up',
    description: 'Tracks emerging Korean beauty trends and explains which ones matter for your skin.',
  },
  {
    type: 'budget_optimizer',
    name: 'Budget Optimizer',
    role: 'Value-maximizing advisor',
    icon: 'piggy-bank',
    description: 'Finds affordable alternatives with the same key ingredients as premium products.',
  },
  {
    type: 'sensitivity_guardian',
    name: 'Sensitivity Guardian',
    role: 'Allergy and reaction prevention',
    icon: 'heart-pulse',
    description: 'Monitors for allergens and potential irritants based on your sensitivity profile.',
  },
]
