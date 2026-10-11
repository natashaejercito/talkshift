// 0 = Monday … 6 = Sunday. Minutes since midnight: 600 = 10 AM, 1260 = 9 PM.
export const DEFAULT_STORE_HOURS = [
  { weekday: 0, openMin: 600, closeMin: 1260 },
  { weekday: 1, openMin: 600, closeMin: 1260 },
  { weekday: 2, openMin: 600, closeMin: 1260 },
  { weekday: 3, openMin: 600, closeMin: 1260 },
  { weekday: 4, openMin: 600, closeMin: 1260 },
  { weekday: 5, openMin: 600, closeMin: 1260 },
  { weekday: 6, openMin: 660, closeMin: 1140 }, // Sunday 11 AM – 7 PM
]