export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getDateRange = (option: string): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();

  switch (option) {
    case 'last15':
      start.setDate(end.getDate() - 15);
      break;
    case 'currentMonth':
      start.setDate(1);
      break;
    case 'lastMonth':
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end.setDate(0); // Último dia do mês anterior
      break;
    case 'last3Months':
      start.setMonth(end.getMonth() - 3);
      break;
    case 'last6Months':
      start.setMonth(end.getMonth() - 6);
      break;
    case 'last12Months':
      start.setMonth(end.getMonth() - 12);
      break;
    default:
      // Default to current month if unknown option
      start.setDate(1);
  }

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
};

export const DATE_RANGE_OPTIONS = [
  { value: 'last15', label: 'Últimos 15 dias' },
  { value: 'currentMonth', label: 'Mês atual' },
  { value: 'lastMonth', label: 'Mês anterior' },
  { value: 'last3Months', label: 'Últimos 3 meses' },
  { value: 'last6Months', label: 'Últimos 6 meses' },
  { value: 'last12Months', label: 'Últimos 12 meses' },
];