// Compare calendar dates, not instants: API dates may carry UTC offsets while occupancy is day-based.
const dayKey = value => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const occupancyForDay = (unit, date) => {
  const key = dayKey(date);
  const lease = (unit?.leasePeriods || []).find(period => dayKey(period.startDate) <= key && key <= dayKey(period.endDate));
  if (lease) return { occupied: true, lease };
  const occupiedPeriod = (unit?.availabilityPeriods || []).find(period =>
    !period.isVacant && period.status?.toLowerCase() === 'occupied' && dayKey(period.startDate) <= key && key <= dayKey(period.endDate)
  );
  return { occupied: Boolean(occupiedPeriod), lease: null };
};

export const daysInOccupancyMonth = (unit, month) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1);
    return { date, ...occupancyForDay(unit, date) };
  });
};
