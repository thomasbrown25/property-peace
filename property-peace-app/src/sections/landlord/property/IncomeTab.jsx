import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  alpha,
  useTheme,
  TextField,
  InputAdornment,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress
} from '@mui/material';
import { 
  SearchOutlined,
  RiseOutlined,
  DollarOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate } from 'utils/formatters';
import moment from 'moment';

export default function IncomeTab({ propertyId }) {
  const theme = useTheme();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Fetch payments for this property
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (propertyId) {
          params.append('propertyId', propertyId);
        }
        
        const response = await axiosServices.get(`/api/payment/all?${params.toString()}`);
        const paymentsData = response.data?.data || response.data || [];
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      } catch (error) {
        console.error('Error fetching payments:', error);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    if (propertyId) {
      fetchPayments();
    }
  }, [propertyId]);

  // Filter payments by search term
  const filteredPayments = useMemo(() => {
    if (!payments || payments.length === 0) return [];
    
    let filtered = payments;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(payment => 
        payment.tenantName?.toLowerCase().includes(searchLower) ||
        payment.propertyName?.toLowerCase().includes(searchLower) ||
        payment.unitName?.toLowerCase().includes(searchLower) ||
        payment.type?.toLowerCase().includes(searchLower) ||
        payment.status?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.sort((a, b) => {
      const dateA = new Date(a.paymentDate || a.date || 0);
      const dateB = new Date(b.paymentDate || b.date || 0);
      return dateB - dateA;
    });
  }, [payments, search]);

  const totalIncome = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  }, [filteredPayments]);

  if (loading) {
    return (
      <MainCard
        sx={{
          p: 6,
          textAlign: 'center',
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
        }}
      >
        <CircularProgress />
      </MainCard>
    );
  }

  return (
    <Box>
      {/* Header */}
      <AnimateIn direction="bottom" delay={100} distance={120}>
        <MainCard
          sx={{
            mb: 3,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
              Income
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View all rental income and payments for this property
            </Typography>
          </Box>
        </MainCard>
      </AnimateIn>

      {/* Summary Card */}
      <AnimateIn direction="bottom" delay={200} distance={120}>
        <MainCard
          sx={{
            mb: 3,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
            boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
          }}
        >
          <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Income
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiseOutlined style={{ fontSize: 20, color: theme.palette.success.main }} />
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {formatCurrency(totalIncome)}
                </Typography>
              </Stack>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Payments
              </Typography>
              <Typography variant="h5" fontWeight={600}>
                {filteredPayments.length}
              </Typography>
            </Box>
          </Stack>
        </MainCard>
      </AnimateIn>

      {/* Payments Table */}
      <AnimateIn direction="bottom" delay={300} distance={120}>
        <MainCard
          sx={{
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
            boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
          }}
        >
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search payments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined style={{ fontSize: 18 }} />
                  </InputAdornment>
                )
              }}
              sx={{ width: 300 }}
            />
          </Box>

          {filteredPayments.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <DollarOutlined style={{ fontSize: 64, color: theme.palette.text.secondary, opacity: 0.3, marginBottom: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                No payments found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {search 
                  ? 'Try adjusting your search terms'
                  : 'Payment history will appear here once tenants make payments.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPayments.map((payment, index) => (
                    <TableRow 
                      key={payment.id || index} 
                      hover
                      sx={{
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04)
                        }
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {moment(payment.paymentDate || payment.date).format('MMM D, YYYY')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {moment(payment.paymentDate || payment.date).format('h:mm A')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {payment.type === 'deposit' ? 'Deposit' : 'Rent Payment'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {payment.tenantName || payment.lease?.tenantName || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {payment.unitName || payment.lease?.unitName || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={payment.status || 'Completed'}
                          color={
                            payment.status === 'Completed' || payment.status === 'completed'
                              ? 'success'
                              : payment.status === 'Pending' || payment.status === 'pending'
                              ? 'warning'
                              : 'default'
                          }
                          icon={payment.status === 'Completed' || payment.status === 'completed' ? <CheckCircleOutlined /> : null}
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                          <DollarOutlined style={{ fontSize: 16, color: theme.palette.success.main }} />
                          <Typography variant="body2" fontWeight={600} color="success.main">
                            {formatCurrency(payment.amount || 0)}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </MainCard>
      </AnimateIn>
    </Box>
  );
}
