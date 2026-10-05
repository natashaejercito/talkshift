import { NavLink, Outlet } from 'react-router'

const tabs = [
  { to: '/schedule', label: 'Schedule' },
  { to: '/availability', label: 'Availability' },
  { to: '/requests', label: 'Requests' },
]

export function StaffLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pb-24 pt-5">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-line bg-surface pb-5 pt-2"
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex min-h-11 min-w-20 items-center justify-center rounded-xl text-sm font-medium ${
                isActive ? 'bg-brand-tint text-brand font-bold' : 'text-muted'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}