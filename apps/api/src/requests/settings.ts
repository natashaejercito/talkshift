// Thursday 6 PM the week before, in the store's time zone.
export const defaultStoreSettings = () => ({
  id: 1,
  timeZone: process.env.STORE_TIMEZONE ?? 'America/Toronto',
  cutoffWeekday: 3,
  cutoffMin: 1080,
})