const parseDateOnly = (value) => {
  if (!value) return null;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getCurrentRentPresentation = ({ dueDate, isOverdue }) => {
  const parsedDueDate = parseDateOnly(dueDate);

  if (!parsedDueDate) {
    return {
      label: 'Rent Due',
      dueLabel: null,
      isOverdue: Boolean(isOverdue)
    };
  }

  return {
    label: 'Rent Due',
    dueLabel: `Due ${parsedDueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
    isOverdue: Boolean(isOverdue)
  };
};
