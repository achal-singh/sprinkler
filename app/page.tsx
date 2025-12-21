import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
          Sprinkler ⛲
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          An Interactive Web3 Workshop Platform
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <Link
            href="/workshop/create"
            className="p-8 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-gray-800"
          >
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">
              Host Workshop
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Create a new workshop session for your attendees
            </p>
          </Link>

          <Link
            href="/workshop/join"
            className="p-8 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-green-500 dark:hover:border-green-400 transition-colors bg-white dark:bg-gray-800"
          >
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">
              Join Workshop
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Enter a session code to join a workshop
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
