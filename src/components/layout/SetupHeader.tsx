import Link from 'next/link'

/**
 * The top bar during the setup chat (`/onboarding`).
 *
 * Why it is not the member header (Nov 15 2026, Bailey, on a new account): the
 * member menu (Dashboard, Skin Profile, Library, Routine, Trending, More) was
 * shown above the setup chat, but none of those pages is open until setup is
 * finished. A tap flashed the page and came straight back to the chat, which
 * reads as broken. An earlier fix (v11.61.12) made that bounce land on the
 * chat instead of the pricing page; this removes the buttons that cause it.
 *
 * It offers the one thing that IS reachable at this point: the account page,
 * which has log out and account deletion. No link here may point at a page the
 * app gate would bounce; a test holds that.
 */
export default function SetupHeader() {
  return (
    <header className="sticky top-0 z-50 bg-seoul-dark/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Plain <img> with explicit size: an SVG with no intrinsic size renders nothing. */}
            <img
              src="/icons/icon-mark.svg"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className="w-9 h-9 rounded-lg"
            />
            <span className="font-display font-bold text-xl bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent whitespace-nowrap">
              Seoul Sister
            </span>
          </div>
          <Link href="/settings" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            Account
          </Link>
        </div>
      </div>
    </header>
  )
}
