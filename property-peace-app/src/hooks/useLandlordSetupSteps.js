import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchAllTenants from 'hooks/useFetchAllTenants';
import { useSubscription, useSubscriptionStatus } from 'hooks/useSubscription';
import { selectTenants } from 'store/tenant/tenant.selector';
import { selectCurrentUser } from 'store/user/user.selector';
import axiosServices from 'utils/axios';
import { organizationSmsNumberAPI } from 'api/organizationSmsNumber';

export default function useLandlordSetupSteps(onClose) {
  const { user: authUser } = useAuth();
  const userFromStore = useSelector(selectCurrentUser);
  const user = useMemo(() => ({ ...(authUser || {}), ...(userFromStore || {}) }), [authUser, userFromStore]);
  const navigate = useNavigate();
  const { properties, isLoading: propertiesLoading } = useFetchProperties();
  const { isLoading: tenantsLoading } = useFetchAllTenants();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const { subscription } = useSubscription();
  const tenants = useSelector(selectTenants);
  const [smsNumberStatus, setSmsNumberStatus] = useState(null);
  const [smsNumberStatusLoading, setSmsNumberStatusLoading] = useState(true);
  const [paymentAccountStatus, setPaymentAccountStatus] = useState(null);
  const [paymentAccountStatusLoading, setPaymentAccountStatusLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;

    const loadPaymentAccountStatus = async () => {
      setPaymentAccountStatusLoading(true);
      if (!user?.id && !user?.Id) {
        setPaymentAccountStatus(null);
        setPaymentAccountStatusLoading(false);
        return;
      }

      try {
        const response = await axiosServices.get('/api/stripe/account-status');
        const data = response?.data?.success ? response?.data?.data : null;
        if (!cancelled) setPaymentAccountStatus(data || null);
      } catch (error) {
        if (!cancelled) setPaymentAccountStatus(null);
      } finally {
        if (!cancelled) setPaymentAccountStatusLoading(false);
      }
    };

    loadPaymentAccountStatus();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.Id]);

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
    return propertyType.toString().toLowerCase() === 'singlefamily';
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

  const hasPremiumOrLifetimeSubscription = useMemo(() => {
    const primarySubscription = subscription || subscriptionStatus?.subscription || subscriptionStatus?.Subscription;
    const planName = String(primarySubscription?.plan?.name || primarySubscription?.Plan?.Name || '').toLowerCase();
    const billingCycle = String(primarySubscription?.billingCycle || primarySubscription?.BillingCycle || '').toLowerCase();

    return (
      planName === 'premium' ||
      planName.includes('lifetime') ||
      billingCycle === 'lifetime' ||
      primarySubscription?.cancelAtPeriodEnd === true ||
      primarySubscription?.CancelAtPeriodEnd === true
    );
  }, [subscription, subscriptionStatus]);

  const effectiveSmsNumberStatus = useMemo(
    () => ({
      ...(smsNumberStatus || {}),
      hasPremiumAccess: Boolean(smsNumberStatus?.hasPremiumAccess || hasPremiumOrLifetimeSubscription)
    }),
    [smsNumberStatus, hasPremiumOrLifetimeSubscription]
  );

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
          ? 'Single-family properties are ready to manage without extra units.'
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
            : 'Premium',
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

  return { steps, completedCount, totalCount, isComplete, isLoading };
}
