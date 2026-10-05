import { NavLink, Outlet } from 'react-router'
import { useAuth0 } from '@auth0/auth0-react'

const STORE_NAME = import.meta.env.VITE_STORE_NAME ?? 'Your store'

const links = [
  { to: '/manager/schedule', label: 'Schedule' },
  { to: '/manager/staff', label: 'Staff' },
]

export function ManagerLayout() {
  const { logout } = useAuth0()
  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-8 border-b border-line bg-surface px-8 py-4">
        <div>
          <div className="font-display text-xl font-extrabold">TalkShift</div>
          <div className="text-xs text-muted">{STORE_NAME} · Manager</div>
        </div>
        <nav aria-label="Manager" className="flex gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-[10px] px-4 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-tint text-brand font-bold' : 'text-muted hover:bg-wash'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })}
          className="ml-auto min-h-11 rounded-[10px] border border-line px-4 text-sm font-medium"
        >
          Sign out
        </button>
      </header>
      <main className="mx-auto max-w-[1440px] p-8">
        <Outlet />
      </main>
    </div>
  )
}