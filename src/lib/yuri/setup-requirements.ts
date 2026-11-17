/**
 * What the setup chat must hold before it can be finished, and who is still
 * in it. No imports: the app gate, the server and the tests all read this.
 *
 * Why this exists (Nov 17 2026, the owner's rule: nobody uses the member
 * features without going through setup). Creating an account now starts the
 * free week, so a new person is a member before the setup chat begins, and
 * three things let a member past it:
 *   - a "Skip this chat" link (a stranger used it 23 seconds in, uploaded a
 *     photo and had a routine saved with nothing asked about their health);
 *   - "Finish setup" needed only a skin type, a concern and an age range, so
 *     it appeared before the medical question (one member finished after two
 *     messages and was never asked);
 *   - a member with a skin type on file could open any page mid-chat, and no
 *     server route checked setup at all.
 *
 * The safety answers are required as ANSWERS, not as findings: "none" counts.
 * What matters is that the question was put and the person replied. A fact on
 * file does NOT stand in for the answer: "I saw a derm for acne once" would
 * otherwise close the medical question with skin cancer and prescriptions
 * never raised (second-model review, Nov 17 2026).
 *
 * Nobody is held for declining. Age, place, sun reaction and both safety
 * questions can each be met by "I'd rather not say". Skin type and a concern
 * cannot: without them there is nothing to advise on.
 */

/** The parts of the setup record these rules read. A subset of ExtractedSkinProfile. */
export interface SetupRecord {
  skin_type?: string | null
  skin_concerns?: string[] | null
  age_range?: string | null
  age_years?: number | null
  location_text?: string | null
  climate?: string | null
  sun_history?: string | null
  medical_history?: string[] | null
  medical_question_answered?: boolean | null
  allergies?: string[] | null
  reactions_question_answered?: boolean | null
  /** Things they were asked and chose not to say: 'age' | 'where' | 'sun'. */
  declined_to_say?: string[] | null
}

export interface SetupRequirement {
  key: 'skin_type' | 'skin_concerns' | 'age' | 'where' | 'sun' | 'medical' | 'reactions'
  /** In Yuri's turn state: what has not been learned yet. */
  label: string
  met: (record: SetupRecord) => boolean
}

const has = (list: string[] | null | undefined) => Array.isArray(list) && list.length > 0
const declined = (r: SetupRecord, key: string) => Array.isArray(r.declined_to_say) && r.declined_to_say.includes(key)

export const SETUP_REQUIREMENTS: readonly SetupRequirement[] = [
  { key: 'skin_type', label: 'their skin type', met: (r) => !!r.skin_type },
  { key: 'skin_concerns', label: 'at least one thing about their skin they want changed', met: (r) => has(r.skin_concerns) },
  { key: 'age', label: 'their age or age range', met: (r) => !!r.age_range || typeof r.age_years === 'number' || declined(r, 'age') },
  { key: 'where', label: 'where they live (a place, or at least the climate)', met: (r) => !!r.location_text || !!r.climate || declined(r, 'where') },
  { key: 'sun', label: 'how their skin reacts to sun (burns, tans, or both)', met: (r) => !!r.sun_history || declined(r, 'sun') },
  {
    key: 'medical',
    label: 'their answer about skin conditions, skin cancer or precancers, and anything prescribed for their skin (an answer of "none" counts)',
    met: (r) => r.medical_question_answered === true,
  },
  {
    key: 'reactions',
    label: 'their answer about bad reactions to a product and ingredients they avoid (an answer of "none" counts)',
    met: (r) => r.reactions_question_answered === true,
  },
]

export function missingSetupRequirements(record: SetupRecord | null | undefined): SetupRequirement[] {
  const r = record ?? {}
  return SETUP_REQUIREMENTS.filter((req) => !req.met(r))
}

/**
 * Is this account still in the setup chat?
 *
 * `setupStatus` is ss_onboarding_progress.onboarding_status: `null` when there
 * is no row, `undefined` when it could not be read. `hasProfile` is
 * ss_user_profiles.onboarding_completed, which turns true as soon as a skin
 * type is known and so cannot answer this by itself.
 *
 *   in_progress           -> still in setup, whatever else is on file
 *   completed | skipped   -> out ('skipped' is from before the link was removed)
 *   no row                -> in setup unless a profile exists (members from
 *                            before setup records were kept have one)
 *   unreadable            -> the same as no row: a failed read must not send a
 *                            member with a profile back into setup
 */
export function stillInSetup(setupStatus: string | null | undefined, hasProfile: boolean): boolean {
  if (setupStatus === 'in_progress') return true
  if (setupStatus === 'completed' || setupStatus === 'skipped') return false
  return !hasProfile
}

/** Whether each safety question was ever answered, read from ss_onboarding_progress.skin_profile_data. */
export interface SetupSafety {
  medicalAnswered: boolean
  reactionsAnswered: boolean
  /**
   * This member got into the member chat with a safety question unanswered:
   * they used the skip link while it existed, finished under the old
   * three-field rule, or finished at the message limit. Set on the setup
   * record (`safety_followup`), by hand for the first two and by the finish
   * route for the third. Members from before any of this do not carry it, and
   * are not asked again on its account.
   */
  followUp: boolean
}

export function parseSetupSafety(skinProfileData: unknown): SetupSafety {
  const d = (skinProfileData ?? {}) as { medical_question_answered?: unknown; reactions_question_answered?: unknown; safety_followup?: unknown }
  return { medicalAnswered: d.medical_question_answered === true, reactionsAnswered: d.reactions_question_answered === true, followUp: d.safety_followup === true }
}

/** What a member route answers while setup is unfinished. */
export const SETUP_REQUIRED_MESSAGE = 'Finish your setup chat with Yuri first. It is where she learns your skin, and everything else is built on it.'
