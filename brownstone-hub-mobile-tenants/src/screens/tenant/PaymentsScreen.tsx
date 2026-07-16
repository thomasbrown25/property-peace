import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, RefreshControl, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LeaseAPI, PaymentAPI } from '../../api';

// Try to import useStripe - handle gracefully if not available
// Check if we're in Expo Go first (where native modules aren't available)
let useStripeHook: any = null;
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
      useStripeHook = stripeModule.useStripe;
    } else {
      useStripeHook = () => null;
    }
  } catch (error: any) {
    // Stripe not available - create a no-op hook
    // Suppress the OnrampSdk error as it's expected when native modules aren't available
    if (!error?.message?.includes('OnrampSdk')) {
      console.warn('⚠️ Stripe React Native not available:', error?.message || error);
    }
    useStripeHook = () => null;
  }
} else {
  // In Expo Go, Stripe won't work - return null hook
  useStripeHook = () => null;
}
import { Lease } from '../../api/leaseAPI';
import { Payment } from '../../api/paymentAPI';
import { formatCurrency, formatDate, calculateNextPaymentDate } from '../../utils/formatters';
import moment from 'moment';
import apiClient from '../../services/apiClient';
import FeesCard from '../../components/dashboard/FeesCard';
import { Deposit } from '../../types/dashboard';

// Calculate overdue amount (same logic as DashboardScreen)
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
  
  // Calculate total expected rent from start to effective end
  let totalExpected = 0;
  let currentDue = moment(firstDueDate);
  
  while (currentDue.isSameOrBefore(effectiveEnd, 'day')) {
    if (!leaseEnd || currentDue.isSameOrBefore(leaseEnd, 'day')) {
      totalExpected += lease.rentAmount || 0;
    }
    currentDue = currentDue.add(1, 'month').date(rentDueDay);
    
    // Safety check to prevent infinite loop
    if (currentDue.isAfter(effectiveEnd.add(2, 'years'))) {
      break;
    }
  }
  
  // Calculate total paid
  const totalPaid = payments
    .filter(p => {
      const paymentDate = moment(p.paymentDate);
      return paymentDate.isSameOrAfter(leaseStart, 'day') && 
             (!leaseEnd || paymentDate.isSameOrBefore(leaseEnd, 'day'));
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  // Overdue is the difference
  return Math.max(0, totalExpected - totalPaid);
};

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  
  // Always call the hook (it's a no-op if Stripe isn't available)
  const stripe = useStripeHook();
  const initPaymentSheet = stripe?.initPaymentSheet;
  const presentPaymentSheet = stripe?.presentPaymentSheet;
  
  const [activeTab, setActiveTab] = useState<'pay' | 'history' | 'leases'>('pay');
  const [currentLease, setCurrentLease] = useState<Lease | null>(null);
  const [allLeases, setAllLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [leaseDetailVisible, setLeaseDetailVisible] = useState(false);
  const [hasBankAccount, setHasBankAccount] = useState<boolean>(false);
  const [checkingBankAccount, setCheckingBankAccount] = useState(true);
  const [outstandingAmount, setOutstandingAmount] = useState<number>(0);
  const [overdueAmount, setOverdueAmount] = useState<number>(0);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPaymentAmount, setSelectedPaymentAmount] = useState<'overdue' | 'custom'>('overdue');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);

  interface ApiResponse<T> {
    success?: boolean;
    data?: T;
    message?: string;
  }

  interface RentCollection {
    rentRecords?: Array<{
      leaseId?: string | number;
      LeaseId?: string | number;
      overdueAmount?: number;
      OverdueAmount?: number;
      rentAmount?: number;
      RentAmount?: number;
      outstanding?: number;
      Outstanding?: number;
    }>;
    RentRecords?: Array<{
      leaseId?: string | number;
      LeaseId?: string | number;
      overdueAmount?: number;
      OverdueAmount?: number;
      rentAmount?: number;
      RentAmount?: number;
      outstanding?: number;
      Outstanding?: number;
    }>;
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setCheckingBankAccount(true);
      
      // Get current lease
      const lease = await LeaseAPI.getMyLease();
      setCurrentLease(lease);

      // Get all leases
      const leases = await LeaseAPI.getAllMyLeases();
      setAllLeases(leases);

      // Get payments for current lease
      if (lease?.id) {
        const leaseId = typeof lease.id === 'string' ? lease.id : String(lease.id);
        const leasePayments = await PaymentAPI.getPaymentsByLease(leaseId);
        setPayments(leasePayments);

        // Check if bank account is set up by checking property's operatingAccountId
        // JSON response uses camelCase, so it should be propertyOperatingAccountId
        const propertyOperatingAccountId = (lease as any).propertyOperatingAccountId || 
                                          lease.propertyOperatingAccountId ||
                                          (lease as any).PropertyOperatingAccountId ||
                                          (lease.unit?.property as any)?.operatingAccountId ||
                                          (lease.unit?.property as any)?.OperatingAccountId;
        
        // Debug logging
        console.log('🔍 Checking bank account setup:', {
          leaseId: lease.id,
          propertyOperatingAccountId,
          hasValue: !!propertyOperatingAccountId,
          leaseKeys: Object.keys(lease).filter(k => k.toLowerCase().includes('account') || k.toLowerCase().includes('operating')),
          unitPropertyKeys: lease.unit?.property ? Object.keys(lease.unit.property).filter(k => k.toLowerCase().includes('account') || k.toLowerCase().includes('operating')) : null,
        });
        
        const hasAccount = !!propertyOperatingAccountId;
        console.log('✅ Bank account check result:', hasAccount);
        setHasBankAccount(hasAccount);

        // Get rent collection for outstanding amount
        try {
          const rentResponse = await apiClient.get<ApiResponse<RentCollection>>('/api/rent-collection/tenant/my-rent');
          const today = moment();
          let overdue = 0;
          let rent = lease.rentAmount || 0;
          let leaseRecord: { amountDueNow?: number; overdueAmount?: number; OverdueAmount?: number; rentAmount?: number; RentAmount?: number } | undefined;

          if (rentResponse.success && rentResponse.data) {
            const rentRecords = rentResponse.data.rentRecords || rentResponse.data.RentRecords || [];
            leaseRecord = rentRecords.find(r =>
              (r.leaseId === lease.id) || (r.LeaseId === lease.id) ||
              String(r.leaseId) === String(lease.id) || String(r.LeaseId) === String(lease.id)
            );

            if (leaseRecord) {
              overdue = leaseRecord.overdueAmount ?? leaseRecord.OverdueAmount ?? 0;
              rent = leaseRecord.rentAmount ?? leaseRecord.RentAmount ?? lease.rentAmount ?? 0;
            } else {
              overdue = calculateOverdueAmount(lease, leasePayments, today);
            }
          } else {
            overdue = calculateOverdueAmount(lease, leasePayments, today);
          }

          setOverdueAmount(overdue);
          const amountDue = (leaseRecord != null && leaseRecord.amountDueNow != null && leaseRecord.amountDueNow !== undefined)
            ? leaseRecord.amountDueNow
            : rent + overdue;
          setOutstandingAmount(amountDue);
        } catch (error) {
          console.warn('Could not fetch rent collection:', error);
          // Fallback: calculate overdue amount the same way as dashboard
          const today = moment();
          const overdue = calculateOverdueAmount(lease, leasePayments, today);
          const rent = lease.rentAmount || 0;
          setOverdueAmount(overdue);
          setOutstandingAmount(rent + overdue);
        }

        // Fetch deposits
        try {
          setLoadingDeposits(true);
          const depositsResponse = await apiClient.get<ApiResponse<Deposit[]>>(`/api/deposit/lease/${lease.id}`);
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
        setPayments([]);
        setHasBankAccount(false);
        setOutstandingAmount(0);
        setOverdueAmount(0);
      }
    } catch (error) {
      console.error('Error fetching payments data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCheckingBankAccount(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleLeasePress = (lease: Lease) => {
    setSelectedLease(lease);
    setLeaseDetailVisible(true);
  };

  const isCurrentLease = (lease: Lease): boolean => {
    if (!currentLease) return false;
    return lease.id === currentLease.id || String(lease.id) === String(currentLease.id);
  };

  const handlePayNow = () => {
    if (!currentLease) return;
    // Default to overdue amount if available, otherwise empty
    if (overdueAmount > 0) {
      setCustomAmount(String(overdueAmount));
    } else {
      setCustomAmount('');
    }
    setPaymentModalVisible(true);
  };

  const handlePayDeposit = () => {
    if (!currentLease || !currentLease.depositAmount || currentLease.depositAmount <= 0) return;
    setSelectedPaymentAmount('custom');
    setCustomAmount(String(currentLease.depositAmount));
    setPaymentModalVisible(true);
  };

  // Calculate if deposit is paid
  const depositPaid = useMemo(() => {
    if (!currentLease?.depositAmount || currentLease.depositAmount <= 0) return null;
    if (loadingDeposits) return null;
    if (!deposits || deposits.length === 0) return false;
    return deposits.some(d => d.receivedDate && !d.refundedDate);
  }, [deposits, currentLease?.depositAmount, loadingDeposits]);

  // Calculate next payment due date
  const nextPaymentDueDate = useMemo(() => {
    if (!currentLease) return null;
    const rentDueDay = currentLease.rentDueDay || 1;
    const baseNextPaymentDate = calculateNextPaymentDate(
      currentLease.startDate,
      rentDueDay,
      currentLease.endDate
    );
    if (!baseNextPaymentDate) return null;
    
    const today = moment();
    let nextDue = moment(baseNextPaymentDate);
    const leaseStartDate = moment(currentLease.startDate);
    
    // Check if there's a payment for the current payment period
    const hasPaymentForPeriod = payments.some(p => {
      const paymentDate = moment(p.paymentDate);
      if (nextDue.isSame(leaseStartDate, 'day')) {
        return paymentDate.isSameOrAfter(leaseStartDate, 'day');
      }
      return paymentDate.isSame(nextDue, 'year') && 
             paymentDate.isSame(nextDue, 'month') && 
             paymentDate.isSameOrBefore(nextDue, 'day');
    });
    
    // If the base next payment date has passed and payment was made, calculate the next one
    if (nextDue.isBefore(today, 'day') && hasPaymentForPeriod) {
      if (nextDue.isSame(leaseStartDate, 'day')) {
        nextDue = moment().add(1, 'month').date(rentDueDay);
      } else {
        nextDue = nextDue.add(1, 'month').date(rentDueDay);
      }
      if (currentLease.endDate && nextDue.isAfter(moment(currentLease.endDate), 'day')) {
        nextDue = moment(currentLease.endDate);
      }
    }
    
    return {
      date: nextDue.toDate(),
      daysUntil: nextDue.diff(today, 'days'),
    };
  }, [currentLease, payments]);

  const handleProcessPayment = async () => {
    if (!currentLease?.id) return;

    // Check if Stripe is available
    if (!stripe || !initPaymentSheet || !presentPaymentSheet) {
      console.error('❌ Stripe is not initialized:', { 
        hasStripe: !!stripe, 
        hasInitPaymentSheet: !!initPaymentSheet, 
        hasPresentPaymentSheet: !!presentPaymentSheet 
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

    try {
      setProcessingPayment(true);
      const leaseId = typeof currentLease.id === 'string' ? parseInt(currentLease.id, 10) : currentLease.id;
      
      // Create payment intent
      const paymentIntent = await PaymentAPI.createPaymentIntent(leaseId, amountToPay);
      
      if (!paymentIntent || !paymentIntent.clientSecret) {
        Alert.alert('Error', 'Failed to create payment. Please try again.');
        setProcessingPayment(false);
        return;
      }

      // Initialize PaymentSheet
      const { error: initError } = await initPaymentSheet({
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
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // User cancelled or payment failed
        if (presentError.code === 'Canceled') {
          // User cancelled - keep modal open so they can try again or change amount
          console.log('ℹ️ User cancelled payment');
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
                  fetchData(); // Refresh data
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
                  fetchData(); // Refresh data anyway
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
                fetchData(); // Refresh data anyway
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      Alert.alert('Payment Error', error?.message || 'Failed to process payment. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const renderPayOnline = () => {
    if (loading || checkingBankAccount) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading payment options...</Text>
        </View>
      );
    }

    if (!currentLease) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Lease Found</Text>
          <Text style={styles.emptyDescription}>
            You don't have an active lease. Payment options will appear here once you have a lease.
          </Text>
        </View>
      );
    }

    if (!hasBankAccount) {
      return (
        <>
          <View style={styles.balanceCard}>
            <View style={styles.balanceContent}>
              <View>
                <Text style={styles.balanceLabel}>Amount Due</Text>
                <Text style={styles.balanceAmount}>{formatCurrency(outstandingAmount)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <View style={styles.documentIcon} />
            </View>
            <Text style={styles.emptyTitle}>No online payment available</Text>
            <Text style={styles.emptyDescription}>
              If you have invoices due but don't see a "Pay Now" option, your landlord may not currently accept online payments.
            </Text>
          </View>
        </>
      );
    }

    return (
      <>
        {/* Amount Due Card - Matching home page style */}
        <View style={styles.amountDueCard}>
          <Text style={styles.amountDueTitle}>Amount Due</Text>
          <View style={styles.amountDueHeader}>
            <View style={styles.amountDueInfo}>
              <View style={[styles.amountDueIcon, overdueAmount > 0 ? styles.errorIcon : styles.successIcon]}>
                <Ionicons 
                  name="cash-outline" 
                  size={18} 
                  color={overdueAmount > 0 ? '#cf1322' : '#52c41a'} 
                />
              </View>
              <View style={styles.amountDueDetails}>
                {overdueAmount > 0 && (
                  <View style={styles.overdueBadge}>
                    <Text style={styles.overdueBadgeText}>Overdue</Text>
                  </View>
                )}
                <Text style={[styles.amountDueValue, overdueAmount > 0 && styles.overdueAmount]}>
                  {formatCurrency(outstandingAmount)}
                </Text>
                {nextPaymentDueDate && (
                  <View style={styles.dueDateContainer}>
                    <Ionicons name="calendar-outline" size={14} color="#666666" style={styles.dueDateIcon} />
                    <Text style={styles.dueDateText}>
                      Due {formatDate(nextPaymentDueDate.date)}
                      {nextPaymentDueDate.daysUntil >= 0 ? (
                        nextPaymentDueDate.daysUntil === 0
                          ? ' (Today)'
                          : nextPaymentDueDate.daysUntil === 1
                            ? ' (Tomorrow)'
                            : ` (${nextPaymentDueDate.daysUntil} days)`
                      ) : (
                        ` (${Math.abs(nextPaymentDueDate.daysUntil)} ${Math.abs(nextPaymentDueDate.daysUntil) === 1 ? 'day' : 'days'} overdue)`
                      )}
                    </Text>
                  </View>
                )}
                {overdueAmount > 0 && (
                  <Text style={styles.overdueText}>Overdue: {formatCurrency(overdueAmount)}</Text>
                )}
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.makePaymentButton} onPress={handlePayNow}>
            <Ionicons name="card-outline" size={20} color="#fff" style={styles.makePaymentIcon} />
            <Text style={styles.makePaymentText}>Make Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Fees Card */}
        <View style={styles.feesCardContainer}>
          <FeesCard
            depositAmount={currentLease.depositAmount}
            depositPaid={depositPaid}
            loadingDeposits={loadingDeposits}
            onPayDeposit={handlePayDeposit}
          />
        </View>
      </>
    );
  };

  const renderPaymentHistory = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading payment history...</Text>
        </View>
      );
    }

    if (!currentLease) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Lease Found</Text>
          <Text style={styles.emptyDescription}>
            You don't have an active lease. Payment history will appear here once you have a lease.
          </Text>
        </View>
      );
    }

    if (payments.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="cash-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Payment History</Text>
          <Text style={styles.emptyDescription}>
            Your payment history will appear here once payments are recorded.
          </Text>
        </View>
      );
    }

    // Sort payments by date (newest first)
    const sortedPayments = [...payments].sort((a, b) => {
      const dateA = new Date(a.paymentDate || 0).getTime();
      const dateB = new Date(b.paymentDate || 0).getTime();
      return dateB - dateA;
    });

    return (
      <View style={styles.paymentsList}>
        {sortedPayments.map((payment, index) => (
          <View key={payment.id || `payment-${index}`} style={styles.paymentCard}>
            <View style={styles.paymentCardHeader}>
              <View style={styles.paymentInfo}>
                <View style={styles.paymentIconContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#52c41a" />
                </View>
                <View style={styles.paymentDetails}>
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount || 0)}</Text>
                  <Text style={styles.paymentDate}>
                    Paid on {formatDate(payment.paymentDate)}
                  </Text>
                </View>
              </View>
              <View style={styles.paidBadge}>
                <Text style={styles.paidBadgeText}>Paid</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderLeases = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading leases...</Text>
        </View>
      );
    }

    if (allLeases.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="home-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Leases</Text>
          <Text style={styles.emptyDescription}>
            Your lease information will be displayed here once your landlord creates a lease for you.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.leasesList}>
        {allLeases.map((lease, index) => {
          const isCurrent = isCurrentLease(lease);
          const propertyName = lease.unit?.property?.name || lease.propertyName || 'Unknown Property';
          const unitName = lease.unit?.name || lease.unitName;
          const isSingleFamily = lease.unit?.property?.propertyType?.toLowerCase() === 'singlefamily';

          return (
            <TouchableOpacity
              key={lease.id || `lease-${index}`}
              style={styles.leaseCard}
              onPress={() => handleLeasePress(lease)}
            >
              <View style={styles.leaseCardHeader}>
                <View style={styles.leaseInfo}>
                  <Text style={styles.leasePropertyName}>{propertyName}</Text>
                  {unitName && !isSingleFamily && (
                    <Text style={styles.leaseUnitName}>Unit: {unitName}</Text>
                  )}
                </View>
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
              </View>
              <View style={styles.leaseDetails}>
                <View style={styles.leaseDetailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#666666" />
                  <Text style={styles.leaseDetailText}>
                    {formatDate(lease.startDate)} - {lease.endDate ? formatDate(lease.endDate) : 'Ongoing'}
                  </Text>
                </View>
                <View style={styles.leaseDetailRow}>
                  <Ionicons name="cash-outline" size={16} color="#666666" />
                  <Text style={styles.leaseDetailText}>
                    {formatCurrency(lease.rentAmount || 0)}/month
                  </Text>
                </View>
              </View>
              <View style={styles.leaseCardFooter}>
                <Text style={styles.viewDetailsText}>View Details</Text>
                <Ionicons name="chevron-forward" size={16} color="#1976d2" />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderPaymentModal = () => {
    if (!paymentModalVisible || !currentLease) return null;

    const overdueAmountValue = overdueAmount;
    const customAmountValue = parseFloat(customAmount) || 0;
    const selectedAmount = customAmountValue;

    return (
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.paymentModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make Payment</Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBodyContent}
            >
              <View style={styles.paymentOptionsContainer}>
                <Text style={styles.paymentOptionsTitle}>Payment Amount</Text>
                
                <View style={styles.customAmountContainer}>
                  <Text style={styles.customAmountLabel}>Enter Amount</Text>
                  <View style={styles.customAmountInputContainer}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.customAmountInput}
                      placeholder="0.00"
                      placeholderTextColor="#999999"
                      value={customAmount}
                      onChangeText={(text) => {
                        // Allow only numbers and one decimal point
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        // Ensure only one decimal point
                        const parts = cleaned.split('.');
                        if (parts.length > 2) {
                          setCustomAmount(parts[0] + '.' + parts.slice(1).join(''));
                        } else {
                          setCustomAmount(cleaned);
                        }
                      }}
                      keyboardType="decimal-pad"
                      autoFocus={true}
                    />
                  </View>
                </View>

                {overdueAmountValue > 0 && (
                  <TouchableOpacity
                    style={styles.quickAmountButton}
                    onPress={() => {
                      setCustomAmount(String(overdueAmountValue));
                    }}
                  >
                    <Text style={styles.quickAmountText}>
                      Use overdue amount: {formatCurrency(overdueAmountValue)}
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.paymentSummary}>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Payment Amount</Text>
                    <Text style={styles.paymentSummaryAmount}>
                      {formatCurrency(selectedAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.paymentModalFooter}>
              <TouchableOpacity
                style={[styles.processPaymentButton, (selectedAmount <= 0 || processingPayment) && styles.processPaymentButtonDisabled]}
                onPress={handleProcessPayment}
                disabled={selectedAmount <= 0 || processingPayment}
              >
                {processingPayment ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" style={styles.processPaymentIcon} />
                    <Text style={styles.processPaymentText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="card" size={20} color="#fff" style={styles.processPaymentIcon} />
                    <Text style={styles.processPaymentText}>
                      Pay {formatCurrency(selectedAmount)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const renderLeaseDetail = () => {
    if (!selectedLease) return null;

    const propertyName = selectedLease.unit?.property?.name || selectedLease.propertyName || 'Unknown Property';
    const unitName = selectedLease.unit?.name || selectedLease.unitName;
    const isSingleFamily = selectedLease.unit?.property?.propertyType?.toLowerCase() === 'singlefamily';
    const isCurrent = isCurrentLease(selectedLease);

    return (
      <Modal
        visible={leaseDetailVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLeaseDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lease Details</Text>
              <TouchableOpacity
                onPress={() => setLeaseDetailVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {isCurrent && (
                <View style={styles.currentBadgeContainer}>
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current Lease</Text>
                  </View>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Property Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Property</Text>
                  <Text style={styles.detailValue}>{propertyName}</Text>
                </View>
                {unitName && !isSingleFamily && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Unit</Text>
                    <Text style={styles.detailValue}>{unitName}</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Lease Period</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Start Date</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedLease.startDate)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>End Date</Text>
                  <Text style={styles.detailValue}>
                    {selectedLease.endDate ? formatDate(selectedLease.endDate) : 'Ongoing'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Financial Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Monthly Rent</Text>
                  <Text style={styles.detailValue}>{formatCurrency(selectedLease.rentAmount || 0)}</Text>
                </View>
                {selectedLease.depositAmount && selectedLease.depositAmount > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Deposit</Text>
                    <Text style={styles.detailValue}>{formatCurrency(selectedLease.depositAmount)}</Text>
                  </View>
                )}
                {selectedLease.rentDueDay && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rent Due Day</Text>
                    <Text style={styles.detailValue}>Day {selectedLease.rentDueDay} of each month</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Landlord Information</Text>
                {(selectedLease.landlordName || (selectedLease as any).LandlordName) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name</Text>
                    <Text style={styles.detailValue}>
                      {selectedLease.landlordName || (selectedLease as any).LandlordName || 'N/A'}
                    </Text>
                  </View>
                )}
                {(selectedLease.landlordEmail || (selectedLease as any).LandlordEmail) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>
                      {selectedLease.landlordEmail || (selectedLease as any).LandlordEmail || 'N/A'}
                    </Text>
                  </View>
                )}
                {(selectedLease.landlordPhone || (selectedLease as any).LandlordPhone) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>
                      {selectedLease.landlordPhone || (selectedLease as any).LandlordPhone || 'N/A'}
                    </Text>
                  </View>
                )}
                {!selectedLease.landlordName && !(selectedLease as any).LandlordName && 
                 !selectedLease.landlordEmail && !(selectedLease as any).LandlordEmail && 
                 !selectedLease.landlordPhone && !(selectedLease as any).LandlordPhone && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailValue}>No landlord information available</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <Text style={styles.title}>Rent</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pay' && styles.activeTab]}
            onPress={() => setActiveTab('pay')}
          >
            <Text style={[styles.tabText, activeTab === 'pay' && styles.activeTabText]}>PAY ONLINE</Text>
            {activeTab === 'pay' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.activeTab]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>PAYMENT HISTORY</Text>
            {activeTab === 'history' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'leases' && styles.activeTab]}
            onPress={() => setActiveTab('leases')}
          >
            <Text style={[styles.tabText, activeTab === 'leases' && styles.activeTabText]}>MY LEASES</Text>
            {activeTab === 'leases' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1976d2" />}
      >
        {activeTab === 'pay' && renderPayOnline()}
        {activeTab === 'history' && renderPaymentHistory()}
        {activeTab === 'leases' && renderLeases()}
      </ScrollView>

      {renderLeaseDetail()}
      {renderPaymentModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    paddingBottom: 12,
    marginRight: 16,
    position: 'relative',
  },
  activeTab: {
    // Active state handled by underline
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
  },
  activeTabText: {
    color: '#1976d2',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#1976d2',
  },
  content: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#1976d2',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  overdueLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  payNowContainer: {
    padding: 20,
  },
  payNowButton: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payNowIcon: {
    marginRight: 8,
  },
  payNowText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Amount Due Card - Matching home page style
  amountDueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feesCardContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  amountDueTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  amountDueHeader: {
    marginBottom: 16,
  },
  amountDueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountDueIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  successIcon: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
  },
  errorIcon: {
    backgroundColor: 'rgba(207, 19, 34, 0.1)',
  },
  amountDueDetails: {
    flex: 1,
  },
  overdueBadge: {
    marginBottom: 4,
    backgroundColor: '#cf1322',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  overdueBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  amountDueValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#52c41a',
  },
  overdueAmount: {
    color: '#cf1322',
  },
  overdueText: {
    fontSize: 14,
    color: '#cf1322',
    fontWeight: '600',
    marginTop: 4,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dueDateIcon: {
    marginRight: 6,
  },
  dueDateText: {
    fontSize: 14,
    color: '#666666',
  },
  makePaymentButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  makePaymentIcon: {
    marginRight: 8,
  },
  makePaymentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    width: '100%',
    flexShrink: 1,
  },
  paymentOptionsContainer: {
    paddingVertical: 8,
  },
  paymentOptionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  paymentOption: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  paymentOptionSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#E3F2FD',
  },
  paymentOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  paymentOptionDescription: {
    fontSize: 14,
    color: '#666666',
  },
  paymentOptionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  customAmountContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  quickAmountButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  quickAmountText: {
    fontSize: 14,
    color: '#1976d2',
    textAlign: 'center',
    fontWeight: '500',
  },
  customAmountLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  customAmountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    paddingVertical: 12,
  },
  paymentSummary: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentSummaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  paymentSummaryAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  paymentModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  processPaymentButton: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processPaymentButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  processPaymentIcon: {
    marginRight: 8,
  },
  processPaymentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceDescription: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.7,
    lineHeight: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  documentIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  loadingText: {
    color: '#666666',
    marginTop: 10,
    fontSize: 16,
  },
  paymentsList: {
    padding: 20,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIconContainer: {
    marginRight: 12,
  },
  paymentDetails: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 14,
    color: '#666666',
  },
  paidBadge: {
    backgroundColor: '#52c41a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paidBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  leasesList: {
    padding: 20,
  },
  leaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leaseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leaseInfo: {
    flex: 1,
  },
  leasePropertyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  leaseUnitName: {
    fontSize: 14,
    color: '#666666',
  },
  currentBadge: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  leaseDetails: {
    marginBottom: 12,
  },
  leaseDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  leaseDetailText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  leaseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    flexGrow: 1,
  },
  modalBodyContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  currentBadgeContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
});
