import { getSession } from '@/lib/auth'
import LogoutButton from '@/components/LogoutButton'
import Navigation from '@/components/Navigation'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <Navigation />
            </div>
            <div className="flex items-center">
              {session ? (
                <>
                  <span className="mr-4 text-sm text-black">
                    Logged in as <strong>{session.username}</strong>
                    {session.isAdmin && (
                      <span className="ml-2 rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-black">
                        Admin
                      </span>
                    )}
                  </span>
                  <LogoutButton />
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
