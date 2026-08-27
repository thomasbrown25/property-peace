import type { LocalExpenseReceipt } from './expenseModel';

const maxReceiptBytes = 10 * 1024 * 1024;

const normalizeReceiptMime = (
  mimeType: string | null | undefined,
  fileName: string,
): LocalExpenseReceipt['mimeType'] | null => {
  const normalizedMime = mimeType?.trim().toLowerCase();
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/png' || normalizedMime === 'image/webp') return normalizedMime;
  const normalizedFileName = fileName.trim().toLowerCase();
  if (normalizedFileName.endsWith('.jpg') || normalizedFileName.endsWith('.jpeg')) return 'image/jpeg';
  if (normalizedFileName.endsWith('.png')) return 'image/png';
  if (normalizedFileName.endsWith('.webp')) return 'image/webp';
  return null;
};

export interface ExpenseReceiptAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
}

export function toLocalExpenseReceipt(
  asset: ExpenseReceiptAsset,
  now: () => number = Date.now,
): LocalExpenseReceipt {
  const fileName = asset.fileName?.trim() || `expense-receipt-${now()}.jpg`;
  const mimeType = normalizeReceiptMime(asset.mimeType, fileName);
  if (!mimeType) throw new Error('Use a JPEG, PNG, or WebP image.');

  const receipt: LocalExpenseReceipt = {
    uri: asset.uri,
    fileName,
    mimeType,
    fileSize: asset.fileSize,
  };
  if (receipt.fileSize !== undefined && receipt.fileSize > maxReceiptBytes) {
    throw new Error('Receipt images must be 10 MB or smaller.');
  }
  return receipt;
}
