/**
 * What a brand-new member sees (Nov 11 2026, from the first real trials).
 *
 * Seen: "Welcome back, Scott" seconds after joining; the routine offer only as
 * text in the input box; the trial notice hidden under the top bar on the chat
 * page; a membership page promising "your routine" in a fixed form. A second
 * model then found the first fix's pointer line could never render (the input
 * takes the text before the greeting data arrives), a failed count brought
 * "Welcome back" straight back, and "Continue last thread" pointed at the setup
 * chat. The greeting choice is a pure function and is executed here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const dir = mkdtempSync(join(tmpdir(), 'ss-welcome-'))
writeFileSync(join(dir, 'w.mjs'), ts.transpileModule(read('src', 'lib', 'yuri', 'welcome-variant.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
const { welcomeVariant: v, isRecentSetup } = await import(pathToFileURL(join(dir, 'w.mjs')).href)

test('executed: the greeting never says "Welcome back" or "You\'re in" unless that is known', () => {
  assert.equal(v(null), 'meet')
  assert.equal(v({ total_conversations: 0, member_conversations: 0, new_member: false }), 'meet')
  // Just joined: only a recent setup chat.
  assert.equal(v({ total_conversations: 1, member_conversations: 0, new_member: true }), 'first_member_chat')
  // Has chatted as a member.
  assert.equal(v({ total_conversations: 3, member_conversations: 2, new_member: false }), 'returning')
  // The count could not be read: claim nothing (this used to fall back to "Welcome back").
  for (const unknown of [null, undefined]) assert.equal(v({ total_conversations: 1, member_conversations: unknown, new_member: null }), 'neutral')
  // Only an OLD setup chat (deleted their chats, or a comped account): not "You're in", not "Welcome back".
  for (const nm of [false, null, undefined]) assert.equal(v({ total_conversations: 1, member_conversations: 0, new_member: nm }), 'neutral')
  // A member chat exists: new_member cannot override it.
  assert.equal(v({ total_conversations: 2, member_conversations: 1, new_member: true }), 'returning')
})

test('executed: "just joined" needs a setup chat active in the last 48 hours', () => {
  const now = Date.parse('2026-11-11T06:12:00Z')
  assert.equal(isRecentSetup('2026-11-11T05:59:06Z', now), true)
  assert.equal(isRecentSetup('2026-11-09T06:13:00Z', now), true, '47h59m')
  assert.equal(isRecentSetup('2026-11-09T06:11:00Z', now), false, '48h01m')
  assert.equal(isRecentSetup('2026-08-01T00:00:00Z', now), false)
  for (const bad of [null, undefined, '', 'x']) assert.equal(isRecentSetup(bad, now), false)
})

test('the page uses the variant, points at the ready message, and never continues the setup chat', () => {
  const page = read('src', 'app', '(app)', 'yuri', 'page.tsx')
  assert.match(page, /const \[arrivedWithAsk\] = useState\(\(\) => Boolean\(askParam\)\)\n\s*const variant = welcomeVariant\(welcomeContext\)/)
  assert.match(page, /\{variant === 'first_member_chat' \? \(/)
  assert.match(page, /\{arrivedWithAsk\s*\? 'Your first message is in the box below\. Send it, or change it, and we start on your routine from what you told me in setup\.'/)
  assert.match(page, /\) : variant === 'neutral' \? \(/)
  assert.match(page, /\) : variant === 'returning' && welcomeContext \? \(/)
  const returning = page.slice(page.indexOf(") : variant === 'returning' && welcomeContext ? ("))
  assert.equal((page.match(/[`']Welcome back/g) ?? []).length, 2, 'rendered in two strings only (with and without a name)')
  assert.equal((returning.match(/[`']Welcome back/g) ?? []).length, 2, 'and both are inside the returning branch')
  const route = read('src', 'app', 'api', 'yuri', 'welcome-context', 'route.ts')
  assert.equal((route.match(/\.or\('conversation_type\.is\.null,conversation_type\.neq\.onboarding'\)/g) ?? []).length, 2, 'the member count AND the thread to continue both leave the setup chat out')
  assert.match(route, /if \(memberCountRes\.error\) console\.error\(/)
  assert.match(route, /new_member: newMember,/)
})

test('the trial notice is in the page flow and the chat page makes room for it', () => {
  const notice = read('src', 'components', 'layout', 'TrialNotice.tsx')
  const shell = notice.match(/const shell = '([^']+)'/)[1]
  assert.doesNotMatch(shell, /sticky|fixed|\bz-/, 'pinned, it covered the open mobile menu and the setup header')
  assert.match(notice, /root\.style\.setProperty\(TRIAL_NOTICE_HEIGHT_VAR, `\$\{el\.offsetHeight\}px`\)/)
  assert.equal((notice.match(/root\.style\.removeProperty\(TRIAL_NOTICE_HEIGHT_VAR\)/g) ?? []).length, 2, 'cleared when nothing shows and on unmount')
  assert.equal((notice.match(/ref=\{shellRef\}/g) ?? []).length, 4, 'every state of the notice is measured')
  const page = read('src', 'app', '(app)', 'yuri', 'page.tsx')
  for (const h of ['h-[calc(100vh-64px-5rem-var(--trial-notice-h,0px))]', 'md:h-[calc(100vh-64px-var(--trial-notice-h,0px))]', 'supports-[height:100dvh]:h-[calc(100dvh-64px-5rem-var(--trial-notice-h,0px))]', 'md:supports-[height:100dvh]:h-[calc(100dvh-64px-var(--trial-notice-h,0px))]']) {
    assert.ok(page.includes(h), h)
  }
  assert.match(read('src', 'app', '(app)', 'onboarding', 'page.tsx'), /<div className="sticky top-16 z-10 bg-seoul-card\/90/)
})

test('the membership page promises a routine built from setup, not a fixed format', () => {
  const page = read('src', 'app', '(auth)', 'subscribe', 'page.tsx')
  assert.ok(page.includes(`"I have what I need from our setup chat. Once you're a member, we start by building your routine from it, morning and night where you need both. Then, most weeks, I check in and adjust it from how your skin is doing."`))
  assert.doesNotMatch(page, /full morning and night routine|step by step|your routine is the first thing we build/)
})

test('nowhere is a name taken from an email address', () => {
  assert.ok(read('src', 'app', 'api', 'widget', 'chat', 'route.ts').includes("An email address is not a name: the part before the @ is often a role, a shared inbox, a nickname or someone else's name, so it says nothing about what this person is called. You know their name only if they told you."))
  assert.ok(read('src', 'lib', 'email', 'lead-email.ts').includes("The address they typed is not a name: the part before the @ is often a nickname, a role or someone else's name. Use a name only if they told you one in the conversation."))
  assert.ok(read('src', 'lib', 'yuri', 'onboarding.ts').includes('A name only Yuri used, and the user never typed, is not volunteered.'))
  assert.ok(read('src', 'lib', 'yuri', 'widget-carryover.ts').includes('A name you used in the preview is not one they gave unless they typed it.'))
})
