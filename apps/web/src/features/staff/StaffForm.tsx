import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSaveStaff, type StaffMember } from './useStaff'
import { useMe } from '../../auth/useMe'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['STAFF', 'ASSISTANT_STORE_MANAGER', 'STORE_MANAGER']),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME']),
  targetDays: z.string(),
})
type FormValues = z.infer<typeof schema>

const input = 'min-h-11 w-full rounded-[10px] border border-line bg-surface px-3'
const label = 'text-sm font-bold'

export function StaffForm({ member, onDone }: { member?: StaffMember; onDone: () => void }) {
  const save = useSaveStaff()
  const { data: me } = useMe()
  const isSelf = member?.id === me?.id

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: member?.name ?? '',
      email: member?.email ?? '',
      role: member?.role ?? 'STAFF',
      employmentType: member?.employmentType ?? 'PART_TIME',
      targetDays: String(member?.targetDaysPerWeek ?? 5),
    },
  })
  const fullTime = watch('employmentType') === 'FULL_TIME'

  const onSubmit = (v: FormValues) =>
    save.mutate(
      {
        id: member?.id,
        name: v.name,
        email: v.email,
        role: v.role,
        employmentType: v.employmentType,
        targetDaysPerWeek: v.employmentType === 'FULL_TIME' ? Number(v.targetDays) : null,
      },
      { onSuccess: onDone },
    )

  const setActive = (active: boolean) => {
    if (member) save.mutate({ id: member.id, active }, { onSuccess: onDone })
  }

  return (
    <aside className="h-fit rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-extrabold">{member ? `Edit ${member.name}` : 'Add staff'}</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={label}>Name</label>
          <input id="name" className={input} {...register('name')} />
          {errors.name && <p className="text-sm text-alert">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={label}>Email</label>
          <input id="email" type="email" className={input} {...register('email')} />
          {errors.email && <p className="text-sm text-alert">{errors.email.message}</p>}
          <p className="text-xs text-muted">They sign in with this email. No invite is sent yet.</p>
        </div>

        {isSelf ? (
          <p className="text-sm text-muted">You can't change your own role.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className={label}>Role</label>
            <select id="role" className={input} {...register('role')}>
              <option value="STAFF">Staff</option>
              <option value="ASSISTANT_STORE_MANAGER">Assistant store manager</option>
              <option value="STORE_MANAGER">Store manager</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="employmentType" className={label}>Type</label>
            <select id="employmentType" className={input} {...register('employmentType')}>
              <option value="PART_TIME">Part-time</option>
              <option value="FULL_TIME">Full-time</option>
            </select>
          </div>
          {fullTime && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="targetDays" className={label}>Days per week</label>
              <select id="targetDays" className={input} {...register('targetDays')}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>{n} of 7</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {save.error && <p className="text-sm text-alert">{save.error.message}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="min-h-11 flex-1 rounded-[10px] bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {save.isPending ? 'Saving…' : member ? 'Save changes' : 'Add to staff'}
          </button>
          <button type="button" onClick={onDone} className="min-h-11 rounded-[10px] border border-line px-4 font-medium">
            Cancel
          </button>
        </div>

        {member && !isSelf && (
          <button
            type="button"
            onClick={() => setActive(!member.active)}
            className="text-left text-sm font-bold text-alert"
          >
            {member.active ? `Deactivate ${member.name}` : `Reactivate ${member.name}`}
          </button>
        )}
      </form>
    </aside>
  )
}