import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConnectOnboardingContext,
  createConnectOnboardingDraft,
  deriveConnectOnboardingStage,
  validateConnectOnboardingContext,
  validateConnectOnboardingStep
} from './connectOnboarding.js';

const properties = [
  { id: 11, name: 'Maple House' },
  { id: 12, name: 'Oak Court' }
];

test('a new onboarding draft uses safe profile defaults without selecting authority for the landlord', () => {
  const draft = createConnectOnboardingDraft({
    user: { firstName: 'Taylor', lastName: 'Morgan', companyName: 'Morgan Rentals' },
    properties
  });

  assert.equal(draft.operatingType, 'business');
  assert.deepEqual(draft.displayNames, { individual: 'Taylor Morgan', business: 'Morgan Rentals' });
  assert.deepEqual(draft.propertyIds, []);
  assert.equal(draft.authorityRelationship, '');
  assert.equal(draft.authorityAttested, false);
});

test('individual display name uses first and last name from the signed-in user', () => {
  for (const user of [
    { firstname: '  John ', lastname: ' Doe  ', companyName: 'Doe Rentals' },
    { Firstname: 'John', Lastname: 'Doe', companyName: 'Doe Rentals' }
  ]) {
    const draft = createConnectOnboardingDraft({ user });
    assert.deepEqual(draft.displayNames, { individual: 'John Doe', business: 'Doe Rentals' });
  }
});

test('resuming individual setup keeps the saved display name for that account type', () => {
  const draft = createConnectOnboardingDraft({
    user: { firstname: 'John', lastname: 'Doe', companyName: 'Doe Rentals' },
    savedPreparation: { operatingType: 'individual', displayName: 'John D.' }
  });
  assert.deepEqual(draft.displayNames, { individual: 'John D.', business: 'Doe Rentals' });
});

test('a saved server preparation resumes without trusting extra response fields', () => {
  const draft = createConnectOnboardingDraft({
    user: { firstName: 'Taylor', lastName: 'Morgan' },
    savedPreparation: {
      operatingType: 'business',
      displayName: 'Morgan Rentals',
      propertyIds: [11, '12', 11],
      authorityRelationship: 'property-manager',
      authorityAttested: true,
      ssn: '000-00-0000'
    }
  });

  assert.deepEqual(draft, {
    operatingType: 'business',
    displayNames: { individual: 'Taylor Morgan', business: 'Morgan Rentals' },
    propertyIds: ['11', '12'],
    authorityRelationship: 'property-manager',
    authorityAttested: false
  });
});

test('account type is required before continuing to account details', () => {
  assert.deepEqual(validateConnectOnboardingStep(0, {}), { operatingType: 'Select an account type.' });
  assert.deepEqual(validateConnectOnboardingStep(0, { operatingType: 'individual' }), {});
  assert.deepEqual(validateConnectOnboardingStep(0, { operatingType: 'business' }), {});
});

test('account details require a nonblank name for either account type', () => {
  assert.deepEqual(
    validateConnectOnboardingStep(1, { operatingType: 'individual', displayName: '   ' }),
    { displayName: 'Enter the landlord or business name that tenants recognize.' }
  );
  assert.deepEqual(validateConnectOnboardingStep(1, { operatingType: 'individual', displayName: 'Taylor Morgan' }), {});
  assert.deepEqual(
    validateConnectOnboardingStep(1, { operatingType: 'business', displayName: '   ' }, '12-3456789'),
    { displayName: 'Enter the landlord or business name that tenants recognize.' }
  );
});

test('business account details require a complete EIN even when the name is present', () => {
  const draft = { operatingType: 'business', displayName: 'Morgan Rentals' };
  for (const ein of ['', '12-345678']) {
    assert.deepEqual(validateConnectOnboardingStep(1, draft, ein), { ein: 'Enter a valid 9-digit EIN.' });
  }
  assert.deepEqual(validateConnectOnboardingStep(1, draft, '12-3456789'), {});
});

test('property authority step requires property scope, relationship, and explicit attestation', () => {
  assert.deepEqual(validateConnectOnboardingStep(2, { propertyIds: [], authorityRelationship: '', authorityAttested: false }), {
    propertyIds: 'Select at least one property that will use online rent payments.',
    authorityRelationship: 'Choose how you are authorized to manage rent for these properties.',
    authorityAttested: 'Confirm that you are authorized to manage rent collection for the selected properties.'
  });
  assert.deepEqual(validateConnectOnboardingStep(2, { propertyIds: ['11'], authorityRelationship: 'owner', authorityAttested: true }), {});
});

test('the handoff context strictly excludes raw KYC and banking fields', () => {
  const context = buildConnectOnboardingContext({
    operatingType: 'business',
    displayName: 'Morgan Rentals',
    propertyIds: [11, '12', 11],
    authorityRelationship: 'property-manager',
    authorityAttested: true,
    ssn: '000-00-0000',
    taxId: '12-3456789',
    dateOfBirth: '1990-01-01',
    bankAccountNumber: '123456789',
    identityDocument: 'passport.pdf'
  });

  assert.deepEqual(context, {
    operatingType: 'business',
    displayName: 'Morgan Rentals',
    propertyIds: [11, 12],
    authorityRelationship: 'property-manager',
    authorityAttested: true
  });
  assert.deepEqual(Object.keys(context).sort(), [
    'authorityAttested',
    'authorityRelationship',
    'displayName',
    'operatingType',
    'propertyIds'
  ]);
});

test('final handoff validation rejects malformed and out-of-scope context', () => {
  assert.deepEqual(
    validateConnectOnboardingContext(
      {
        operatingType: 'trust',
        displayName: '',
        propertyIds: ['999'],
        authorityRelationship: 'friend',
        authorityAttested: false
      },
      [11, 12]
    ),
    {
      operatingType: 'Choose a valid operating type.',
      displayName: 'Enter a landlord or business name.',
      propertyIds: 'One or more selected properties are not available in this account.',
      authorityRelationship: 'Choose a valid authority relationship.',
      authorityAttested: 'Property authority must be confirmed.'
    }
  );
});

test('account readiness never treats Stripe details submitted as payout approval', () => {
  assert.equal(deriveConnectOnboardingStage(null), 'property-peace');
  assert.equal(deriveConnectOnboardingStage({ AccountId: 'acct_1', DetailsSubmitted: false }), 'stripe');
  assert.equal(
    deriveConnectOnboardingStage({ AccountId: 'acct_1', DetailsSubmitted: true, IsAccountReadyForRentTransfers: false }),
    'review'
  );
  assert.equal(
    deriveConnectOnboardingStage({ AccountId: 'acct_1', DetailsSubmitted: true, IsAccountReadyForRentTransfers: true }),
    'ready'
  );
  assert.equal(deriveConnectOnboardingStage({ accountId: 'acct_2', detailsSubmitted: true }), 'review');
});
