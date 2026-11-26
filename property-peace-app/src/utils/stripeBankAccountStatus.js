export function getStripeBankAccountStatus(account) {
  if (!account.AccountId) {
    return {
      label: 'Not connected',
      message: 'Connect Stripe to set up online rent payments and add a payout bank account.',
      setupRequired: true
    };
  }

  if (account.HasPastDueRequirements) {
    return {
      label: 'Action required',
      message: 'Review and complete all past-due requirements in Stripe.',
      requirements: account.PastDueRequirementLabels,
      color: 'warning',
      actionLabel: 'Review in Stripe',
      setupRequired: account.Status === 'onboarding'
    };
  }

  if (account.Status === 'onboarding') {
    return {
      label: 'Setup incomplete',
      message: 'Continue in Stripe to finish submitting your account details.',
      color: 'warning',
      setupRequired: true
    };
  }

  if (account.DetailsSubmitted && account.CardPaymentsCapabilityStatus === 'pending') {
    return {
      label: 'Verification pending',
      message: 'Stripe received your details and is reviewing your account.',
      color: 'primary',
      setupRequired: false
    };
  }

  if (account.DetailsSubmitted && account.ChargesEnabled && account.PayoutsEnabled && account.CardPaymentsCapabilityStatus === 'active') {
    return {
      label: 'Charges and payouts enabled',
      message: 'View your account details and manage payout bank accounts in Stripe.',
      color: 'success',
      setupRequired: false
    };
  }

  return {
    label: 'Check Stripe status',
    message: 'Check your Stripe Dashboard for the latest status and any remaining requirements.',
    setupRequired: false
  };
}
