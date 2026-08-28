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
  assert.equal(draft.displayName, 'Morgan Rentals');
  assert.deepEqual(draft.propertyIds, []);
  assert.equal(draft.authorityRelationship, '');
  assert.equal(draft.authorityAttested, false);
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
    displayName: 'Morgan Rentals',
    propertyIds: ['11', '12'],
    authorityRelationship: 'property-manager',
    authorityAttested: false
  });
});

test('business profile step requires the landlord or company name', () => {
  assert.deepEqual(
    validateConnectOnboardingStep(0, { operatingType: 'business', displayName: '   ' }),
    { displayName: 'Enter the landlord or business name that tenants recognize.' }
  );
});

test('property authority step requires property scope, relationship, and explicit attestation', () => {
  assert.deepEqual(validateConnectOnboardingStep(1, { propertyIds: [], authorityRelationship: '', authorityAttested: false }), {
    propertyIds: 'Select at least one property that will use online rent payments.',
    authorityRelationship: 'Choose how you are authorized to manage rent for these properties.',
    authorityAttested: 'Confirm that you are authorized to manage rent collection for the selected properties.'
  });
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
