import { useEffect, useState } from 'react';
import { CircularProgress } from '@mui/material';
import MainCard from 'components/MainCard';
import axiosServices from 'utils/axios';
import ExpensesTab from './ExpensesTab';

export default function IncomeTab({ propertyId, property }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setLoading(true);
    setPayments([]);
    axiosServices.get(`/api/payment/all?propertyId=${encodeURIComponent(propertyId)}`)
      .then(response => {
        if (cancelled) return;
        const data = response.data?.data || response.data || [];
        setPayments(Array.isArray(data) ? data : []);
      })
      .catch(error => { if (!cancelled) { console.error('Error fetching payments:', error); setPayments([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  if (loading) return <MainCard sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></MainCard>;
  return <ExpensesTab propertyId={propertyId} property={property} payments={payments} combined />;
}
