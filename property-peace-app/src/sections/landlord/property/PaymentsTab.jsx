import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import axiosServices from 'utils/axios';
import { useDrawer } from 'contexts/DrawerContext';
import PropertyFinanceTable from './PropertyFinanceTable';
import PropertyRentStatusCard from './PropertyRentStatusCard';

export default function PaymentsTab({ propertyId, property, rentRecords, rentLoading, rentError }) {
  const drawer = useDrawer();
  const [result, setResult] = useState({ propertyId: null, payments: [], loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!propertyId) return;
    const controller = new AbortController();
    setResult({ propertyId, payments: [], loading: true, error: '' });
    axiosServices.get(`/api/payment/all?propertyId=${encodeURIComponent(propertyId)}`, { signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        const data = response.data?.data ?? response.data?.Data ?? response.data;
        if (response.data?.success === false || !Array.isArray(data)) throw new Error('Invalid payments response');
        setResult({ propertyId, payments: data, loading: false, error: '' });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ propertyId, payments: [], loading: false, error: 'Payments could not be loaded. Please try again.' });
      });
    return () => controller.abort();
  }, [propertyId, attempt, drawer.financeMutationVersion]);

  if (!propertyId || result.propertyId !== propertyId || result.loading) return (
    <Box sx={{ minHeight: { xs: 260, sm: 360 }, display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Loading payments" /></Box>
  );
  if (result.error) return <Alert severity="error" action={<Button color="inherit" onClick={() => setAttempt(value => value + 1)}>Retry</Button>}>{result.error}</Alert>;
  return <PropertyFinanceTable propertyId={propertyId} property={property} payments={result.payments} mode="payments" onRecordPayment={() => drawer.openPaymentAddDrawer({ property: property || { id: propertyId } })} rentOverview={<PropertyRentStatusCard propertyId={propertyId} rentRecords={rentRecords} loading={rentLoading} error={rentError} />} />;
}
