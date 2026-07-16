import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList } from '../../navigation/types';
import moment from 'moment';

// Conditionally import useStripe to avoid errors in Expo Go
// Check if we're in Expo Go first (where native modules aren't available)
let useStripe: any = null;
let Constants: any = null;
try {
  Constants = require('expo-constants');
} catch (e) {
  // expo-constants not available
}

const isExpoGo = Constants?.executionEnvironment === 'storeClient' || 
                 (Constants?.appOwnership === 'expo' && !Constants?.isDevice);

if (!isExpoGo) {
  try {
    // Only require if not in Expo Go
    const stripeModule = require('@stripe/stripe-react-native');
    if (stripeModule && stripeModule.useStripe) {
      useStripe = stripeModule.useStripe;
    } else {
      useStripe = () => null;
    }
  } catch (error: any) {
    // Stripe not available - create a no-op hook
    // Suppress the OnrampSdk error as it's expected when native modules aren't available
    if (!error?.message?.includes('OnrampSdk')) {
      console.warn('⚠️ Stripe React Native not available:', error?.message || error);
    }
    useStripe = () => null;
  }
} else {
  // In Expo Go, Stripe won't work - return null hook
  useStripe = () => null;
}

// API Services
import { LeaseAPI, PaymentAPI, MaintenanceAPI } from '../../api';
import apiClient from '../../services/apiClient';

// Types
import { Lease, Payment, MaintenanceRequest, RentCollection, NextRentDue, Deposit } from '../../types/dashboard';

// Components
import RentStatusCard from '../../components/dashboard/RentStatusCard';
import FeesCard from '../../components/dashboard/FeesCard';
import RecentPaymentsCard from '../../components/dashboard/RecentPaymentsCard';
import MaintenanceRequestsCard from '../../components/dashboard/MaintenanceRequestsCard';

// Utils
import { calculateNextPaymentDate, formatCurrency } from '../../utils/formatters';
import { Ionicons } from '@expo/vector-icons';

type DashboardScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Dashboard'>;

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

// Helper function to calculate overdue amount
const calculateOverdueAmount = (lease: Lease, payments: Payment[], today: moment.Moment): number => {
  if (!lease || !lease.startDate) return 0;
  
  const leaseStart = moment(lease.startDate);
  const leaseEnd = lease.endDate ? moment(lease.endDate) : null;
  const effectiveEnd = leaseEnd && leaseEnd.isBefore(today) ? leaseEnd : today;
  
  // Calculate first due date
  const rentDueDay = lease.rentDueDay || 1;
  let firstDueDate = moment(lease.startDate);
  if (leaseStart.date() !== rentDueDay) {
    firstDueDate = moment(lease.startDate).date(rentDueDay);
    if (firstDueDate.isBefore(leaseStart)) {
      firstDueDate = firstDueDate.add(1, 'month');
    }
  }
  
  // Only calculate if we've reached the first due date
  if (today.isBefore(firstDueDate, 'day')) {
    return 0;
  }
  
  // Include current month if today is on or past the due day
  const includeCurrentMonth = today.date() >= rentDueDay;
  
  // Calculate months elapsed from first due date
  let monthsElapsed = (effectiveEnd.year() - firstDueDate.year()) * 12 + 
                     (effectiveEnd.month() - firstDueDate.month()) + 
                     (includeCurrentMonth ? 1 : 0);
  
  if (monthsElapsed < 0) monthsElapsed = 0;
  
  // Calculate total expected rent
  const totalExpectedRent = monthsElapsed * (lease.rentAmount || 0);
  
  // Calculate total paid
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  // Overdue = expected - paid (if positive)
  return Math.max(0, totalExpectedRent - totalPaid);
};

export default function DashboardScreen() {
  const { currentUser } = useAppSelector((state) => state.user);
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  
  // Always call the hook (it's a no-op if Stripe isn't available)
  const stripe = useStripe();
  const { initPaymentSheet: stripeInitPaymentSheet, presentPaymentSheet: stripePresentPaymentSheet } = stripe || {};
  
  // Log Stripe initialization status
  useEffect(() => {
    if (stripe) {
      console.log('✅ Stripe hook initialized in DashboardScreen');
    } else {
      console.warn('⚠️ Stripe hook not available in DashboardScreen - StripeProvider may not be initialized');
    }
  }, [stripe]);

  // State
  const [lease, setLease] = useState<Lease | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rentCollection, setRentCollection] = useState<RentCollection | null>(null);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDeposits, setLoadingDeposits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Payment modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch lease
      const leaseData = await LeaseAPI.getMyLease();
      setLease(leaseData);

      if (leaseData) {
        // Fetch payments
        const paymentsData = await PaymentAPI.getPaymentsByLease(leaseData.id);
        setPayments(paymentsData);

        // Fetch rent collection
        try {
          const rentResponse = await apiClient.get<ApiResponse<RentCollection>>('/api/rent-collection/tenant/my-rent');
          if (rentResponse.success && rentResponse.data) {
            setRentCollection(rentResponse.data);
          }
        } catch (err) {
          console.warn('Could not fetch rent collection:', err);
          setRentCollection(null);
        }

        // Fetch maintenance requests
        const maintenanceData = await MaintenanceAPI.getCurrentRequests();
        setMaintenanceRequests(maintenanceData);

        // Fetch deposits
        try {
          setLoadingDeposits(true);
          const depositsResponse = await apiClient.get<ApiResponse<Deposit[]>>(`/api/deposit/lease/${leaseData.id}`);
          if (depositsResponse.success && depositsResponse.data) {
            setDeposits(Array.isArray(depositsResponse.data) ? depositsResponse.data : []);
          }
        } catch (err) {
          console.warn('Could not fetch deposits:', err);
          setDeposits([]);
        } finally {
          setLoadingDeposits(false);
        }
      } else {
        // No lease, clear related data
        setPayments([]);
        setRentCollection(null);
        setMaintenanceRequests([]);
        setDeposits([]);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Calculate next rent due
  const nextRentDue = useMemo<NextRentDue | null>(() => {
    if (!lease) return null;

    const rentDueDay = lease.rentDueDay || 1;
    const today = moment();
    const leaseStartDate = moment(lease.startDate);
    
    // Use utility function to get base next payment date
    const baseNextPaymentDate = calculateNextPaymentDate(lease.startDate, rentDueDay, lease.endDate);
    if (!baseNextPaymentDate) return null;
    
    let nextDue = moment(baseNextPaymentDate);
    
    // Check if there's a payment for the current payment period
    const hasPaymentForPeriod = payments.some(p => {
      const paymentDate = moment(p.paymentDate);
      
      // If next due date is the start date (first payment)
      if (nextDue.isSame(leaseStartDate, 'day')) {
        return paymentDate.isSameOrAfter(leaseStartDate, 'day');
      }
      
      // For subsequent payments, check if payment was made in the same month and year
      return paymentDate.isSame(nextDue, 'year') && 
             paymentDate.isSame(nextDue, 'month') && 
             paymentDate.isSameOrBefore(nextDue, 'day');
    });
    
    // Determine if the payment is overdue
    const isOverdue = today.isAfter(leaseStartDate, 'day') && 
                      nextDue.isBefore(today, 'day') && 
                      !hasPaymentForPeriod;
    
    // If the base next payment date has passed and payment was made, calculate the next one
    if (nextDue.isBefore(today, 'day') && hasPaymentForPeriod) {
      if (nextDue.isSame(leaseStartDate, 'day')) {
        nextDue = moment().add(1, 'month').date(rentDueDay);
      } else {
        nextDue = nextDue.add(1, 'month').date(rentDueDay);
      }
      
      // Ensure we don't go past lease end date
      if (lease.endDate && nextDue.isAfter(moment(lease.endDate), 'day')) {
        nextDue = moment(lease.endDate);
      }
    }

    // Get rent record to match landlord portal calculation
    let overdueAmount = 0;
    let rentAmount = lease.rentAmount || 0;
    let leaseRecord: { amountDueNow?: number; overdueAmount?: number; OverdueAmount?: number; rentAmount?: number; RentAmount?: number } | null = null;

    const rentRecords = rentCollection?.rentRecords || rentCollection?.RentRecords || [];
    if (rentRecords && rentRecords.length > 0) {
      leaseRecord = rentRecords.find(r =>
        (r.leaseId === lease.id) || (r.LeaseId === lease.id)
      ) ?? null;
      if (leaseRecord) {
        overdueAmount = leaseRecord.overdueAmount ?? leaseRecord.OverdueAmount ?? 0;
        rentAmount = leaseRecord.rentAmount ?? leaseRecord.RentAmount ?? lease.rentAmount ?? 0;
      } else {
        overdueAmount = calculateOverdueAmount(lease, payments, today);
      }
    } else {
      overdueAmount = calculateOverdueAmount(lease, payments, today);
    }

    // Amount due: use amountDueNow (15-day charge window + overdue) when present; else rent + overdue
    const amountDue = (leaseRecord && leaseRecord.amountDueNow != null && leaseRecord.amountDueNow !== undefined)
      ? leaseRecord.amountDueNow
      : rentAmount + overdueAmount;

    return {
      date: nextDue.toDate(),
      amount: amountDue,
      overdueAmount: overdueAmount,
      nextPaymentAmount: lease.rentAmount || 0,
      daysUntil: nextDue.diff(today, 'days'),
      isOverdue: isOverdue || overdueAmount > 0
    };
  }, [lease, payments, rentCollection]);

  // Calculate if deposit is paid
  const depositPaid = useMemo(() => {
    if (!lease?.depositAmount || lease.depositAmount <= 0) return null;
    if (loadingDeposits) return null;
    if (!deposits || deposits.length === 0) return false;
    return deposits.some(d => d.receivedDate && !d.refundedDate);
  }, [deposits, lease?.depositAmount, loadingDeposits]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLoading(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Navigation handlers
  const handleMakePayment = () => {
    if (!lease) return;
    // Default to amount due if available, otherwise empty
    if (nextRentDue?.amount && nextRentDue.amount > 0) {
      setCustomAmount(String(nextRentDue.amount));
    } else {
      setCustomAmount('');
    }
    setPaymentModalVisible(true);
  };

  const handlePayDeposit = () => {
    if (!lease || !lease.depositAmount || lease.depositAmount <= 0) return;
    // Set custom amount to deposit amount
    setCustomAmount(String(lease.depositAmount));
    setPaymentModalVisible(true);
  };

  const handleProcessPayment = async () => {
    if (!lease?.id) return;

    // Check if Stripe is available
    if (!stripe || !stripeInitPaymentSheet || !stripePresentPaymentSheet) {
      console.error('❌ Stripe is not initialized:', { 
        hasStripe: !!stripe, 
        hasInitPaymentSheet: !!stripeInitPaymentSheet, 
        hasPresentPaymentSheet: !!stripePresentPaymentSheet 
      });
      
      // Check if we're in Expo Go
      let Constants: any = null;
      try {
        Constants = require('expo-constants');
      } catch (e) {
        // expo-constants not available
      }
      const isExpoGo = Constants?.executionEnvironment === 'storeClient' || 
                       (Constants?.appOwnership === 'expo' && !Constants?.isDevice);
      
      if (isExpoGo) {
        Alert.alert(
          'Payments Not Available',
          'Stripe payments require a development build and cannot be used in Expo Go. Please build and install a development build to use payment features.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Payment Error',
          'Payment system is not available. Please make sure the app is properly configured and rebuilt with native modules.'
        );
      }
      return;
    }

    // Get amount from custom amount input
    const parsedAmount = parseFloat(customAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    const amountToPay = parsedAmount;

    setProcessingPayment(true);
    try {
      if (!lease?.id) {
        Alert.alert('Error', 'Lease information is missing. Please try again.');
        setProcessingPayment(false);
        return;
      }

      const leaseId = typeof lease.id === 'string' ? parseInt(lease.id, 10) : lease.id;
      
      // Create payment intent
      const paymentIntent = await PaymentAPI.createPaymentIntent(leaseId, amountToPay);
      
      if (!paymentIntent || !paymentIntent.clientSecret) {
        Alert.alert('Error', 'Failed to create payment. Please try again.');
        setProcessingPayment(false);
        return;
      }

      // Initialize PaymentSheet
      const { error: initError } = await stripeInitPaymentSheet({
        merchantDisplayName: 'Brownstone Hub',
        paymentIntentClientSecret: paymentIntent.clientSecret,
      });

      if (initError) {
        console.error('Error initializing PaymentSheet:', initError);
        Alert.alert('Payment Error', initError.message || 'Failed to initialize payment. Please try again.');
        setProcessingPayment(false);
        return;
      }

      // Present PaymentSheet
      const { error: presentError } = await stripePresentPaymentSheet();

      if (presentError) {
        // User cancelled or payment failed
        if (presentError.code === 'Canceled') {
          // User cancelled - don't show error, just close modal
          setPaymentModalVisible(false);
        } else {
          Alert.alert('Payment Error', presentError.message || 'Payment failed. Please try again.');
        }
        setProcessingPayment(false);
        return;
      }

      // Payment succeeded - confirm with backend
      try {
        const paymentDate = new Date();
        const confirmed = await PaymentAPI.confirmPayment(
          paymentIntent.paymentIntentId,
          leaseId,
          amountToPay,
          paymentDate
        );

        if (confirmed) {
          Alert.alert(
            'Payment Successful',
            `Your payment of ${formatCurrency(amountToPay)} has been processed successfully.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  setPaymentModalVisible(false);
                  fetchDashboardData(); // Refresh data
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'Payment Processed',
            'Your payment was processed by Stripe, but there was an issue recording it. Please contact support if you don\'t see it reflected in your account.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setPaymentModalVisible(false);
                  fetchDashboardData(); // Refresh data anyway
                }
              }
            ]
          );
        }
      } catch (confirmError: any) {
        console.error('Error confirming payment:', confirmError);
        Alert.alert(
          'Payment Processed',
          'Your payment was processed by Stripe, but there was an issue recording it. Please contact support if you don\'t see it reflected in your account.',
          [
            {
              text: 'OK',
              onPress: () => {
                setPaymentModalVisible(false);
                fetchDashboardData(); // Refresh data anyway
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      Alert.alert('Payment Error', error?.message || 'Failed to process payment. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleViewLeaseDetails = () => {
    navigation.navigate('Lease');
  };

  const handleViewAllPayments = () => {
    navigation.navigate('Payments');
  };

  const handleNewMaintenanceRequest = () => {
    navigation.navigate('Maintenance');
  };

  const handleMaintenanceRequestPress = (requestId: string) => {
    navigation.navigate('Maintenance');
    // TODO: Navigate to specific request detail when that screen is implemented
  };

  // Get current date for header
  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleString('default', { month: 'short' });

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  // Error state
  if (error && !lease) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error Loading Dashboard</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.errorMessage}>Please try again later.</Text>
      </ScrollView>
    );
  }

  // Payment drawer render function
  const renderPaymentModal = () => {
    if (!paymentModalVisible || !lease) return null;

    const amountDueValue = nextRentDue?.amount || 0;
    const customAmountValue = parseFloat(customAmount) || 0;
    const selectedAmount = customAmountValue;
    const dueDateLabel = nextRentDue?.date ? moment(nextRentDue.date).format('MMM D, YYYY') : 'Upcoming rent';
    const propertyLabel = lease.propertyName || lease.unit?.property?.name || 'Your home';
    const unitLabel = lease.unitName || lease.unit?.name;
    const sanitizedAmount = customAmount.replace(/[^0-9.]/g, '');

    const handleAmountChange = (text: string) => {
      const cleaned = text.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      setCustomAmount(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned);
    };

    return (
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={paymentModalStyles.drawerOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={paymentModalStyles.drawerBackdrop}
            onPress={() => setPaymentModalVisible(false)}
          />

          <View style={[paymentModalStyles.paymentDrawer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={paymentModalStyles.drawerHandle} />

            <View style={paymentModalStyles.drawerHeader}>
              <View style={paymentModalStyles.drawerTitleGroup}>
                <View style={paymentModalStyles.drawerIconBadge}>
                  <Ionicons name="card" size={20} color="#FFFFFF" />
                </View>
                <View style={paymentModalStyles.drawerTitleCopy}>
                  <Text style={paymentModalStyles.drawerEyebrow}>Secure rent payment</Text>
                  <Text style={paymentModalStyles.drawerTitle}>Make a payment</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={paymentModalStyles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close payment drawer"
              >
                <Ionicons name="close" size={22} color="#172033" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={paymentModalStyles.drawerBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={paymentModalStyles.drawerBodyContent}
            >
              <View style={paymentModalStyles.rentSnapshotCard}>
                <View style={paymentModalStyles.rentSnapshotTopRow}>
                  <View style={paymentModalStyles.rentSnapshotHome}>
                    <Ionicons name="home" size={18} color="#1976d2" />
                  </View>
                  <View style={paymentModalStyles.rentSnapshotText}>
                    <Text style={paymentModalStyles.rentSnapshotLabel}>{propertyLabel}</Text>
                    {!!unitLabel && <Text style={paymentModalStyles.rentSnapshotMeta}>Unit {unitLabel}</Text>}
                  </View>
                  {nextRentDue?.isOverdue && (
                    <View style={paymentModalStyles.overduePill}>
                      <Text style={paymentModalStyles.overduePillText}>Overdue</Text>
                    </View>
                  )}
                </View>

                <View style={paymentModalStyles.rentSnapshotDivider} />

                <View style={paymentModalStyles.rentSnapshotAmounts}>
                  <View>
                    <Text style={paymentModalStyles.rentSnapshotCaption}>Amount due</Text>
                    <Text style={paymentModalStyles.rentSnapshotAmount}>{formatCurrency(amountDueValue)}</Text>
                  </View>
                  <View style={paymentModalStyles.dueDateChip}>
                    <Ionicons name="calendar-outline" size={14} color="#42526E" />
                    <Text style={paymentModalStyles.dueDateText}>{dueDateLabel}</Text>
                  </View>
                </View>
              </View>

              <View style={paymentModalStyles.amountSection}>
                <Text style={paymentModalStyles.sectionLabel}>Payment amount</Text>
                <View style={paymentModalStyles.customAmountInputContainer}>
                  <Text style={paymentModalStyles.currencySymbol}>$</Text>
                  <TextInput
                    style={paymentModalStyles.customAmountInput}
                    placeholder="0.00"
                    placeholderTextColor="#A0AEC0"
                    value={sanitizedAmount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                    autoFocus
                    selectionColor="#1976d2"
                  />
                </View>

                {amountDueValue > 0 && selectedAmount !== amountDueValue && (
                  <TouchableOpacity
                    style={paymentModalStyles.quickAmountButton}
                    onPress={() => setCustomAmount(String(amountDueValue))}
                  >
                    <Ionicons name="flash" size={15} color="#1976d2" />
                    <Text style={paymentModalStyles.quickAmountText}>Use amount due: {formatCurrency(amountDueValue)}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={paymentModalStyles.paymentSummary}>
                <View style={paymentModalStyles.paymentSummaryRow}>
                  <Text style={paymentModalStyles.paymentSummaryLabel}>You will pay</Text>
                  <Text style={paymentModalStyles.paymentSummaryAmount}>{formatCurrency(selectedAmount)}</Text>
                </View>
                <View style={paymentModalStyles.summaryHintRow}>
                  <Ionicons name="shield-checkmark" size={16} color="#2E7D32" />
                  <Text style={paymentModalStyles.summaryHintText}>Processed securely through Stripe.</Text>
                </View>
              </View>
            </ScrollView>

            <View style={paymentModalStyles.paymentDrawerFooter}>
              <TouchableOpacity
                style={[paymentModalStyles.processPaymentButton, (selectedAmount <= 0 || processingPayment) && paymentModalStyles.processPaymentButtonDisabled]}
                onPress={handleProcessPayment}
                disabled={selectedAmount <= 0 || processingPayment}
                accessibilityRole="button"
              >
                {processingPayment ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" style={paymentModalStyles.processPaymentIcon} />
                    <Text style={paymentModalStyles.processPaymentText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#fff" style={paymentModalStyles.processPaymentIcon} />
                    <Text style={paymentModalStyles.processPaymentText}>Pay {formatCurrency(selectedAmount)}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <View style={styles.headerContent}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>{day}</Text>
            <Text style={styles.dateMonth}>{month}</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Hello, {currentUser?.FirstName || currentUser?.firstname || 'Tenant'}!</Text>
            <Text style={styles.tagline}>Renting is easy with Brownstone Hub</Text>
          </View>
        </View>
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
        </View>
      </View>

      {!lease ? (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Connect with your landlord</Text>
          
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <View style={styles.personIcon} />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Get connected</Text>
                <Text style={styles.cardDescription}>
                  You're currently not connected with any landlord.
                </Text>
                <Text style={styles.cardDescription}>
                  Invite your landlord to connect on Brownstone Hub.
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.inviteButton}>
              <Text style={styles.inviteButtonText}>Send an Invitation</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <RentStatusCard
            lease={lease}
            nextRentDue={nextRentDue}
            deposit={deposits[0] || null}
            depositPaid={depositPaid}
            loadingDeposits={loadingDeposits}
            onMakePayment={handleMakePayment}
          />

          <FeesCard
            depositAmount={lease.depositAmount}
            depositPaid={depositPaid}
            loadingDeposits={loadingDeposits}
            onPayDeposit={handlePayDeposit}
          />

          <RecentPaymentsCard
            payments={payments}
            onViewAll={handleViewAllPayments}
          />

          <MaintenanceRequestsCard
            requests={maintenanceRequests}
            onNewRequest={handleNewMaintenanceRequest}
            onRequestPress={handleMaintenanceRequestPress}
          />
        </View>
      )}
    </ScrollView>
    {renderPaymentModal()}
  </View>
  );
}

const paymentModalStyles = StyleSheet.create({
  drawerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 18, 34, 0.58)',
  },
  paymentDrawer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D7DEE8',
    marginTop: 10,
    marginBottom: 4,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  drawerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  drawerTitleCopy: {
    flex: 1,
  },
  drawerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: 2,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172033',
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  drawerBody: {
    flexGrow: 0,
  },
  drawerBodyContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  rentSnapshotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E6EDF5',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  rentSnapshotTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rentSnapshotHome: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EAF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rentSnapshotText: {
    flex: 1,
  },
  rentSnapshotLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#172033',
  },
  rentSnapshotMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  overduePill: {
    backgroundColor: '#FFF0E8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  overduePillText: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '800',
  },
  rentSnapshotDivider: {
    height: 1,
    backgroundColor: '#EEF2F7',
    marginVertical: 16,
  },
  rentSnapshotAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  rentSnapshotCaption: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  rentSnapshotAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  dueDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginLeft: 12,
  },
  dueDateText: {
    color: '#42526E',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  amountSection: {
    marginTop: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 10,
  },
  quickAmountButton: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    backgroundColor: '#EAF4FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B9D9FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '700',
    marginLeft: 6,
  },
  customAmountInputContainer: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#C9D7E8',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '800',
    color: '#172033',
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#172033',
    paddingVertical: 12,
  },
  paymentSummary: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#ECFDF3',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BDECCB',
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentSummaryLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F3D2B',
  },
  paymentSummaryAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1976d2',
  },
  summaryHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  summaryHintText: {
    flex: 1,
    marginLeft: 7,
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  paymentDrawerFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E6EDF5',
  },
  processPaymentButton: {
    minHeight: 54,
    backgroundColor: '#1976d2',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  processPaymentButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    opacity: 0.7,
  },
  processPaymentIcon: {
    marginRight: 8,
  },
  processPaymentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dividerContainer: {
    marginTop: 16,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dateBadge: {
    width: 60,
    height: 60,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dateDay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 28,
  },
  dateMonth: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#666666',
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  iconContainer: {
    marginRight: 16,
  },
  personIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1976d2',
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    lineHeight: 20,
  },
  inviteButton: {
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  inviteButtonText: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
});
