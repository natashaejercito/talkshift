import { useState } from 'react'
import { useStaffList, type StaffMember } from '../../features/staff/useStaff'
import { StaffForm } from '../../features/staff/StaffForm'

const ROLE_LABEL = {
  STAFF: 'Staff',
  ASSISTANT_STORE_MANAGER: 'Assistant manager',
  STORE_MANAGER: 'Store manager',
} as const

function typeLabel(s: StaffMember) {
  return s.employmentType === 'FULL_TIME' ? `Full-time · ${s.targetDaysPerWeek}/7` : 'Part-time'
}

function Status({ s }: { s: StaffMember }) {
  if (!s.active) return <span className="rounded-full bg-wash px-2.5 py-0.5 text-xs font-bold text-muted">Inactive</span>
  if (!s.hasSignedIn) return <span className="rounded-full bg-pending-tint px-2.5 py-0.5 text-xs font-bold text-pending">Not signed in yet</span>
  return <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-bold text-brand">Active</span>
}

export function StaffPage() {
  const { data: staff, isLoading, error } = useStaffList()
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null)

  if (isLoading) return <p className="text-muted">Loading staff…</p>
  if (error) return <p className="text-alert">Couldn't load staff: {error.message}</p>

  const activeCount = staff?.filter((s) => s.active).length ?? 0

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Staff</h1>
            <p className="text-sm text-muted">{activeCount} active</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="min-h-11 rounded-[10px] bg-brand px-4 font-bold text-white hover:bg-brand-dark"
          >
            Add staff
          </button>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">Name</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Role</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {staff?.map((s) => (
                <tr key={s.id} className={`border-b border-line last:border-0 ${s.active ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-3">
                    <div className="font-bold">{s.name}</div>
                    <div className="text-muted">{s.email}</div>
                  </td>
                  <td className="px-4 py-3">{typeLabel(s)}</td>
                  <td className="px-4 py-3">{ROLE_LABEL[s.role]}</td>
                  <td className="px-4 py-3"><Status s={s} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="min-h-11 rounded-[10px] px-3 font-bold text-brand hover:bg-brand-tint"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <StaffForm
          key={editing === 'new' ? 'new' : editing.id}
          member={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  )
}