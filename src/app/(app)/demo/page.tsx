'use client'

/**
 * Yuri Scenario Mode — demo studio (Jul 5 2026)
 *
 * A gated, self-serve page for producing marketing/demo content: pick a skin
 * persona (curated preset or freeform), ask the REAL Yuri, and get a real,
 * verified, screenshot-ready response. Nothing is persisted; nothing trains the
 * learning loop. This is DEMONSTRATION content ("here's what Yuri does for skin
 * like yours"), never a fabricated persona/testimonial.
 *
 * Access: is_demo OR is_admin accounts only.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SCENARIO_PRESETS, type ScenarioPreset } from '@/lib/yuri/scenario-presets'

type YuriScenarioInput = {
  skin_type?: string | null
  skin_concerns?: string[]
  fitzpatrick_scale?: string | null
  climate?: string | null
  age_range?: string | null
  budget_range?: string | null
  experience_level?: string | null
  allergies?: string[]
  persona_note?: string | null
}

export default function ScenarioDemoPage() {
  const { user, loading: authLoading } = useAuth()
  const [accessChecked, setAccessChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [personaNote, setPersonaNote] = useState('')
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Gate: is_demo OR is_admin
  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('ss_user_profiles')
        .select('is_demo, is_admin')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      setAllowed(data?.is_demo === true || data?.is_admin === true)
      setAccessChecked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const selectedPreset: ScenarioPreset | null =
    SCENARIO_PRESETS.find((p) => p.id === selectedPresetId) ?? null

  function applyPreset(preset: ScenarioPreset) {
    setSelectedPresetId(preset.id)
    setPersonaNote(preset.persona_note ?? '')
    setQuestion(preset.suggested_question ?? '')
    setResponse('')
    setError(null)
  }

  const runScenario = useCallback(async () => {
    if (!question.trim()) {
      setError('Enter a question for Yuri to answer.')
      return
    }
    // Build the scenario from the selected preset (if any) overlaid with the
    // freeform persona note. A freeform-only persona (no preset) is allowed.
    const base: YuriScenarioInput = selectedPreset
      ? {
          skin_type: selectedPreset.skin_type,
          skin_concerns: selectedPreset.skin_concerns,
          fitzpatrick_scale: selectedPreset.fitzpatrick_scale,
          climate: selectedPreset.climate,
          age_range: selectedPreset.age_range,
          budget_range: selectedPreset.budget_range,
          experience_level: selectedPreset.experience_level,
          allergies: selectedPreset.allergies,
        }
      : {}
    const scenario: YuriScenarioInput = {
      ...base,
      persona_note: personaNote.trim() || base.persona_note || null,
    }

    setStreaming(true)
    setResponse('')
    setError(null)
    setCopied(false)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError('Session expired. Please sign in again.')
        setStreaming(false)
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch('/api/yuri/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: question.trim(), scenario }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || `Request failed (${res.status}).`)
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text') {
              acc += event.content
              setResponse(acc)
            } else if (event.type === 'done') {
              if (event.message) setResponse(event.message)
            } else if (event.type === 'error') {
              setError(event.message || 'Yuri hit an error. Try again.')
            }
          } catch {
            /* ignore malformed keep-alive lines */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Something went wrong. Try again.')
      }
    } finally {
      setStreaming(false)
    }
  }, [question, personaNote, selectedPreset])

  function copyResponse() {
    navigator.clipboard.writeText(response).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  // --- Render ---------------------------------------------------------------
  if (authLoading || (!accessChecked && user)) {
    return <div className="p-8 text-sm text-white/50">Loading…</div>
  }
  if (!user || !allowed) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-white">Not available</h1>
        <p className="mt-2 text-sm text-white/60">
          The Scenario demo studio is only available to demo/internal accounts.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">Yuri Scenario Studio</h1>
        <p className="mt-1 text-sm text-white/60">
          Ask the <strong className="text-white/90">real</strong> Yuri as any skin type or persona,
          then screenshot the answer for content. Responses are real and verified, and nothing here
          is saved to your profile or the learning system. Show what Yuri does for skin like your
          viewer&rsquo;s.
        </p>
      </header>

      {/* Persona presets */}
      <section>
        <h2 className="text-sm font-medium text-white/70">1 · Pick a skin persona</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SCENARIO_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded-lg border p-3 text-left transition ${
                selectedPresetId === p.id
                  ? 'border-white bg-white/10'
                  : 'border-white/15 hover:border-white/40'
              }`}
            >
              <div className="text-sm font-semibold text-white">{p.label}</div>
              <div className="mt-0.5 text-xs text-white/50">{p.blurb}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Freeform persona */}
      <section>
        <h2 className="text-sm font-medium text-white/70">
          2 · Or describe any persona (freeform)
        </h2>
        <textarea
          value={personaNote}
          onChange={(e) => {
            setPersonaNote(e.target.value)
            // Freeform edit means we're no longer strictly on the preset's facts.
            if (selectedPresetId) setSelectedPresetId(null)
          }}
          rows={2}
          placeholder="e.g. 27, oily skin, lives in a very humid climate, main concern is closed comedones and a tight budget"
          className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
        />
        <p className="mt-1 text-xs text-white/50">
          Editing this clears the preset selection, so your freeform persona takes over. Covers any
          skin type, not just the presets.
        </p>
      </section>

      {/* Question */}
      <section>
        <h2 className="text-sm font-medium text-white/70">3 · Ask Yuri</h2>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="The question this persona would ask Yuri…"
          className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={runScenario}
          disabled={streaming}
          className="mt-3 rounded-lg bg-gradient-to-r from-gold to-gold-light px-4 py-2 text-sm font-semibold text-seoul-dark transition hover:opacity-90 disabled:opacity-50"
        >
          {streaming ? 'Yuri is answering…' : 'Ask Yuri'}
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Response */}
      {(response || streaming) && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/70">Yuri&rsquo;s response</h2>
            {response && !streaming && (
              <button
                type="button"
                onClick={copyResponse}
                className="text-xs text-white/60 underline hover:text-white/90"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="mt-2 whitespace-pre-wrap rounded-lg border border-white/15 bg-white/5 p-4 text-sm leading-relaxed text-white/90">
            {response || <span className="text-white/40">…</span>}
          </div>
          <p className="mt-2 text-xs text-white/50">
            This is a live, verified Yuri answer for the persona above. Screenshot it as-is: every
            product/ingredient fact came from the real catalog. Nothing was saved.
          </p>
        </section>
      )}
    </div>
  )
}
