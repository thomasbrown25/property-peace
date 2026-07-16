import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Divider,
  Button,
  Stack,
  alpha,
  useTheme
} from '@mui/material';
import { CheckCircleOutlined } from '@ant-design/icons';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import { useModal } from 'contexts/ModalContext';
import PaymentModal from 'components/drawers/PaymentModal';
import useFetchPayments from 'hooks/useFetchPayments';
import axiosServices from 'utils/axios';

// Enhanced components
import RentCollectionSingleHeader from 'sections/landlord/rent-collection/RentCollectionSingleHeader';
import RentCollectionSingleMetrics from 'sections/landlord/rent-collection/RentCollectionSingleMetrics';
import PaymentHistoryTable from 'sections/landlord/rent-collection/PaymentHistoryTable';
import MainCard from 'components/MainCard';

export default function RentCollectionSingle() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const modal = useModal();

  // Fetch all rent records (no property filter) to find the specific lease
  const { summary, rentRecords, loading, refetch: refetchRentCollection } = useFetchRentCollection(null, true);

  // Find the rent record by leaseId
  const rent = useMemo(() => {
    if (!rentRecords || !leaseId) return null;
    return rentRecords.find((r) => r.leaseId === parseInt(leaseId) || r.id === parseInt(leaseId));
  }, [rentRecords, leaseId]);

  // Fetch payments for this specific lease
  const { payments, refetch: refetchPayments } = useFetchPayments(rent?.leaseId || parseInt(leaseId));

  // Fetch deposits for this specific lease
  const [deposits, setDeposits] = useState([]);
  const fetchDeposits = async () => {
    const leaseIdToFetch = rent?.leaseId || parseInt(leaseId);
    if (!leaseIdToFetch) return;
    
    try {
      const response = await axiosServices.get(`/api/deposit/lease/${leaseIdToFetch}`);
      if (response.data && response.data.success) {
        setDeposits(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
      setDeposits([]);
    }
  };

  // Fetch deposits on mount and when lease changes
  useEffect(() => {
    fetchDeposits();
  }, [rent?.leaseId, leaseId]);

  // Track when modal was open to detect when it closes after a payment
  const wasModalOpen = useRef(false);

  // Watch for payment modal closing and refetch data
  useEffect(() => {
    // If modal was open and is now closed, refetch all data
    if (wasModalOpen.current && !modal.openPayment) {
      // Modal just closed - refetch data to get updated payment info
      const timer = setTimeout(() => {
        refetchRentCollection();
        if (rent?.leaseId) {
          refetchPayments();
          fetchDeposits();
        }
      }, 300);
      
      wasModalOpen.current = false;
      return () => clearTimeout(timer);
    }
    
    // Update ref when modal opens
    if (modal.openPayment) {
      wasModalOpen.current = true;
    }
  }, [modal.openPayment, refetchRentCollection, refetchPayments, rent?.leaseId]);

  const theme = useTheme();

  // Calculate unit-specific summary data
  const collectedLifetime = useMemo(() => {
    if (!payments || payments.length === 0) return 0;
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const outstanding = useMemo(() => {
    // Outstanding = total outstanding for entire lease period (expected - collected)
    return rent?.outstanding || 0;
  }, [rent]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!rent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography>No rent data found for this unit.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Enhanced Header */}
      <RentCollectionSingleHeader rent={rent} />

      {/* Enhanced Metrics */}
      <RentCollectionSingleMetrics rent={rent} collectedLifetime={collectedLifetime} outstanding={outstanding} />

      {/* Action Button */}
      <MainCard
        sx={{
          mt: 3,
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<CheckCircleOutlined />}
            onClick={() => modal.openPaymentModal(rent)}
            sx={{
              boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.3)}`,
              '&:hover': {
                boxShadow: `0 6px 16px ${alpha(theme.palette.success.main, 0.4)}`,
                transform: 'translateY(-2px)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Make Payment
          </Button>
        </Stack>
      </MainCard>

      {/* Payment History */}
      <PaymentHistoryTable 
        payments={payments}
        deposits={deposits}
        onPaymentUpdated={() => {
          refetchRentCollection();
          if (rent?.leaseId) {
            refetchPayments();
            fetchDeposits();
          }
        }}
      />

      <PaymentModal open={modal.openPayment} rent={modal.selectedRent} onClose={modal.closePaymentModal} defaultAmount={rent.rentAmount} />
    </Box>
  );
}
