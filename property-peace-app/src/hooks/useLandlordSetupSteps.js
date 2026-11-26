import { isDetachedSingleUnitType } from 'utils/propertyType';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchAllTenants from 'hooks/useFetchAllTenants';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { selectTenants } from 'store/tenant/tenant.selector';
import { selectCurrentUser } from 'store/user/user.selector';
import axiosServices from 'utils/axios';
import { organizationSmsNumberAPI } from 'api/organizationSmsNumber';
import { makeRentPaymentAccessScopeKey } from 'utils/rentPaymentAccess';
import { readStripeAccountStatus } from 'utils/stripeOrganizationRequestLifecycle';

export default function useLandlordSetupSteps(onClose) {
  const { user: authUser } = useAuth();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const userFromStore = useSelector(selectCurrentUser);
  const user = useMemo(() => ({ ...(authUser || {}), ...(userFromStore || {}) }), [authUser, userFromStore]);
  const navigate = useNavigate();
  const { properties, isLoading: propertiesLoading } = useFetchProperties();
  const { isLoading: tenantsLoading } = useFetchAllTenants();
  const { status: subscriptionStatus } = useSubscriptionStatus();

  const tenants = useSelector(selectTenants);
  const [smsNumberStatus, setSmsNumberStatus] = useState(null);
  const [smsNumberStatusLoading, setSmsNumberStatusLoading] = useState(true);
  const paymentScope = makeRentPaymentAccessScopeKey({
    userId: authUser?.id ?? authUser?.Id,
    organizationId: currentOrganization?.id ?? currentOrganization?.Id
  });
  const canLoadPaymentStatus = Boolean(paymentScope) && !organizationLoading;
  const [paymentAccount, setPaymentAccount] = useState(null);
  const paymentAccountStatus = canLoadPaymentStatus && paymentAccount?.scope === paymentScope ? paymentAccount.status : null;
  const paymentAccountStatusLoading = organizationLoading || (canLoadPaymentStatus && paymentAccount?.scope !== paymentScope);
  useEffect(() => {
    if (!canLoadPaymentStatus) return;
    const controller = new AbortController();
    const publishStatus = (status) => {
      if (!controller.signal.aborted) setPaymentAccount({ scope: paymentScope, status });
    };
    axiosServices.get('/api/stripe/account-status', { signal: controller.signal })
      .then(({ data }) => publishStatus(readStripeAccountStatus(data)))
      .catch(() => publishStatus(null));
    return () => controller.abort();
  }, [canLoadPaymentStatus, paymentScope]);

  useEffect(() => {
    let cancelled = false;

    const loadSmsNumberStatus = async () => {
      setSmsNumberStatusLoading(true);
      if (!user?.id && !user?.Id) {
        setSmsNumberStatus(null);
        setSmsNumberStatusLoading(false);
        return;
      }

      try {
        const response = await organizationSmsNumberAPI.getStatus();
        if (!cancelled) setSmsNumberStatus(response?.data || null);
      } catch (error) {
        if (!cancelled) setSmsNumberStatus(null);
      } finally {
        if (!cancelled) setSmsNumberStatusLoading(false);
      }
    };

    loadSmsNumberStatus();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.Id]);

  const activeProperties = useMemo(
    () => (properties || []).filter((property) => property.isActive ?? property.IsActive ?? true),
    [properties]
  );

  const allUnits = useMemo(() => activeProperties.flatMap((property) => property.units || property.Units || []), [activeProperties]);

  const activeLeases = useMemo(
    () => allUnits.map((unit) => unit.lease || unit.Lease).filter((lease) => lease && (lease.isActive ?? lease.IsActive ?? true)),
    [allUnits]
  );

  const firstPropertyIsSingleFamily = useMemo(() => {
    const firstProperty = activeProperties[0];
    const propertyType = firstProperty?.propertyType || firstProperty?.PropertyType || '';
    return isDetachedSingleUnitType(propertyType);
  }, [activeProperties]);

  const hasPaymentAccount = Boolean(
    paymentAccountStatus?.accountId ||
      paymentAccountStatus?.AccountId ||
      paymentAccountStatus?.isEnabled ||
      paymentAccountStatus?.IsEnabled ||
      paymentAccountStatus?.chargesEnabled ||
      paymentAccountStatus?.ChargesEnabled ||
      paymentAccountStatus?.payoutsEnabled ||
      paymentAccountStatus?.PayoutsEnabled ||
      paymentAccountStatus?.detailsSubmitted ||
      paymentAccountStatus?.DetailsSubmitted ||
      subscriptionStatus?.stripeAccountId ||
      subscriptionStatus?.StripeAccountId ||
      subscriptionStatus?.chargesEnabled ||
      subscriptionStatus?.ChargesEnabled ||
      subscriptionStatus?.payoutsEnabled ||
      subscriptionStatus?.PayoutsEnabled ||
      subscriptionStatus?.detailsSubmitted ||
      subscriptionStatus?.DetailsSubmitted
  );

  const hasRentPreferences = useMemo(
    () =>
      activeLeases.some((lease) => {
        const rentAmount = lease.rentAmount || lease.RentAmount || lease.monthlyRent || lease.MonthlyRent;
        const dueDay = lease.rentDueDay || lease.RentDueDay || lease.dueDay || lease.DueDay || lease.paymentDueDay || lease.PaymentDueDay;
        return Boolean(rentAmount && dueDay);
      }),
    [activeLeases]
  );

  const hasTenantInvite = useMemo(
    () =>
      (tenants || []).some((tenant) =>
        Boolean(
          tenant.inviteSent ||
            tenant.InviteSent ||
            tenant.invitationSent ||
            tenant.InvitationSent ||
            tenant.invitedAt ||
            tenant.InvitedAt ||
            tenant.userId ||
            tenant.UserId ||
            tenant.hasPortalAccess ||
            tenant.HasPortalAccess
        )
      ),
    [tenants]
  );

  // SMS provisioning eligibility comes from the server; a subscription label is not authority.
  const effectiveSmsNumberStatus = smsNumberStatus;

  const steps = useMemo(() => {
    const go = (path) => () => {
      onClose?.();
      navigate(path);
    };

    return [
      {
        id: 'profile',
        group: 'Account',
        title: 'Complete landlord profile',
        description: 'Add your name, phone, and landlord identity.',
        completed: Boolean((user?.firstname || user?.Firstname) && (user?.lastname || user?.Lastname) && (user?.email || user?.Email)),
        required: true,
        onClick: go('/landlord/settings?tab=profile')
      },
      {
        id: 'notifications',
        group: 'Account',
        title: 'Configure notifications',
        description: 'Choose how you want to receive reminders and tenant updates.',
        completed: Boolean(user?.notificationPreferencesConfigured || user?.NotificationPreferencesConfigured),
        onClick: go('/landlord/settings?tab=notifications')
      },
      {
        id: 'property',
        group: 'Portfolio',
        title: 'Add first property',
        description: 'Create the rental property you want to manage.',
        completed: activeProperties.length > 0,
        required: true,
        onClick: go('/landlord/properties')
      },
      {
        id: 'units',
        group: 'Portfolio',
        title: 'Add units',
        description: firstPropertyIsSingleFamily
          ? 'Single-unit properties are ready to manage without extra units.'
          : 'Set up the unit or units tenants will occupy.',
        completed: allUnits.length > 0 || firstPropertyIsSingleFamily,
        required: true,
        onClick: go('/landlord/properties')
      },
      {
        id: 'tenant',
        group: 'Tenant & Lease',
        title: 'Add first tenant',
        description: 'Add at least one renter to your account.',
        completed: (tenants || []).length > 0,
        required: true,
        onClick: go('/landlord/tenants')
      },
      {
        id: 'lease-details',
        group: 'Tenant & Lease',
        title: 'Add lease details',
        description: 'Enter lease dates, rent amount, and lease status.',
        completed: activeLeases.length > 0,
        required: true,
        onClick: go('/landlord/leases')
      },
      {
        id: 'tenant-invite',
        group: 'Tenant & Lease',
        title: 'Invite tenant to portal',
        description: 'Send the tenant an invite so they can log in.',
        completed: hasTenantInvite,
        onClick: go('/landlord/tenants')
      },
      {
        id: 'rent-preferences',
        group: 'Rent & Payments',
        title: 'Set rent collection preferences',
        description: 'Confirm rent amount, due day, and collection settings.',
        completed: hasRentPreferences,
        required: true,
        onClick: go('/landlord/leases')
      },
      {
        id: 'payment-account',
        group: 'Rent & Payments',
        title: 'Connect payout/payment account',
        description: 'Connect Stripe/bank settings for online rent collection.',
        completed: hasPaymentAccount,
        onClick: go('/landlord/settings?tab=payments')
      },
      {
        id: 'sms-number',
        kind: 'sms-number',
        group: 'Operations',
        title: 'Set up SMS number',
        description: 'Give tenants a dedicated number while keeping communication grouped inside Property Peace.',
        completed: Boolean(effectiveSmsNumberStatus?.hasActiveNumber),
        badge: effectiveSmsNumberStatus?.hasActiveNumber
          ? 'Active'
          : effectiveSmsNumberStatus?.hasPremiumAccess
            ? 'Recommended'
            : 'Check availability',
        smsNumberStatus: effectiveSmsNumberStatus
      },
      {
        id: 'dashboard-review',
        group: 'Operations',
        title: 'Review dashboard insights',
        description: 'Come back to the dashboard once your core data is in place.',
        completed: Boolean(user?.HasSeenTutorial || user?.hasSeenTutorial || activeProperties.length > 0),
        onClick: go('/landlord/dashboard')
      }
    ];
  }, [
    user,
    activeProperties,
    allUnits,
    tenants,
    activeLeases,
    firstPropertyIsSingleFamily,
    hasPaymentAccount,
    hasRentPreferences,
    hasTenantInvite,
    effectiveSmsNumberStatus,
    navigate,
    onClose
  ]);

  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const isComplete = totalCount > 0 && completedCount === totalCount;
  const isLoading = Boolean(propertiesLoading || tenantsLoading || paymentAccountStatusLoading || smsNumberStatusLoading);

  return { steps, completedCount, totalCount, isComplete, isLoading, paymentAccountStatus };
}
