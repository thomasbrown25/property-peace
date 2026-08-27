export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'lease-agreement', apiValue: 10, label: 'Lease agreement' },
  { value: 'condition-report', apiValue: 40, label: 'Condition report' },
  { value: 'forms', apiValue: 99, label: 'Forms' },
  { value: 'other', apiValue: 99, label: 'Other' }
];

export const getDocumentTypeApiValue = (value) =>
  DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value)?.apiValue ?? 99;

export const getDocumentTitleFromFile = (file) => {
  if (!file?.name) return '';
  return file.name.replace(/\.[^/.]+$/, '');
};
