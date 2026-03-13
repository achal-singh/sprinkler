import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen px-6 py-12 flex items-center">
      <div className="mx-auto max-w-5xl space-y-12 w-full">
        <section className="neo-section text-center space-y-6">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-gray-900 dark:text-white">
            Sprinkler
          </h1>
          <p className="neo-muted text-lg md:text-xl max-w-2xl mx-auto">
            An interactive Web3 workshops platform with focused interfaces for
            hosts and participants
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/workshop/create"
            className="neo-card p-6 md:p-8 flex flex-col gap-4 text-left"
            style={{ ['--accent' as string]: '#2f6df6' }}
          >
            <div className="neo-pill w-fit">For hosts</div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Host Workshop
            </h2>
            <p className="neo-muted">
              Create a new session, invite attendees, and guide milestones in
              real time.
            </p>
            <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold neo-link">
              Get started <span aria-hidden="true">-&gt;</span>
            </div>
          </Link>

          <Link
            href="/workshop/join"
            className="neo-card p-6 md:p-8 flex flex-col gap-4 text-left"
            style={{ ['--accent' as string]: '#22c55e' }}
          >
            <div className="neo-pill w-fit">For attendees</div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Join Workshop
            </h2>
            <p className="neo-muted">
              Enter your session code, connect your wallet, and stay synced with
              the group.
            </p>
            <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold neo-link">
              Enter code <span aria-hidden="true">-&gt;</span>
            </div>
          </Link>
        </section>
      </div>
    </div>
  )
}
