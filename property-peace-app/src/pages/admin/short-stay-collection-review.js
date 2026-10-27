// Keep client controls aligned with the admin service's allowed transitions.
export const reasonCodes = ['scope_changed', 'payee_ineligible', 'identity_failed', 'authority_revoked', 'policy_mismatch', 'other'];
export const validCaseReference = (value) => typeof value === 'string' && /^[A-Za-z0-9]{4,64}$/.test(value);
export const availableActions = (status) => ({
  submitted: ['suspend', 'reject'],
  identityPending: ['suspend', 'reject'],
  identityVerified: ['begin-review', 'suspend', 'reject'],
  underReview: ['approve', 'suspend', 'reject'],
  payoutApproved: ['suspend'],
  suspended: ['reject']
})[status] || [];
