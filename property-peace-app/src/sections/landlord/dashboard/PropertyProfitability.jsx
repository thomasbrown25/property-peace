import { useState } from 'react';
import { alpha, Box, Button, Stack, Typography, useTheme, Card } from '@mui/material';
import MainCard from 'components/MainCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CircularLoader from 'components/CircularLoader';
import { formatCurrency } from 'utils/formatters';
import { DollarOutlined } from '@ant-design/icons';
import { Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const EmptyState = ({ onAddProperty, onAddExpense }) => {
  return (
    <Box
      sx={{
        height: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        p: 4
      }}
    >
      <Box
        sx={{
          width: 100,
          height: 100,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3
        }}
      >
        <DollarOutlined style={{ fontSize: 48, opacity: 0.3 }} />
      </Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Track Property Profitability
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 350 }}>
        Add properties, leases, and expenses to see detailed profitability analysis and insights for your portfolio.
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" onClick={onAddProperty}>
          Add Property
        </Button>
        <Button variant="contained" onClick={() => window.location.href = '/landlord/property-portfolio'}>
          View Portfolio
        </Button>
      </Stack>
    </Box>
  );
};

export default function PropertyProfitability({ profitabilityData = [], loading, onAddProperty, onAddExpense, onRefresh }) {
  const theme = useTheme();
  const [view, setView] = useState('lifetime');

  const hasData = profitabilityData && profitabilityData.length > 0;

  // Transform API data to chart format
  const chartData = profitabilityData.map((prop) => ({
    name: prop.propertyName || 'Property',
    revenue: prop.totalRent || 0,
    expenses: prop.totalExpenses || 0,
    profit: prop.netIncome || 0
  }));

  // Handle view change (This Month vs Lifetime)
  const handleViewChange = (newView) => {
    setView(newView);
    if (onRefresh) {
      if (newView === 'monthly') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        onRefresh(startOfMonth.toISOString(), endOfMonth.toISOString());
      } else {
        // Lifetime - no date filters
        onRefresh(null, null);
      }
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Card
          sx={{
            bgcolor: 'background.paper',
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            boxShadow: 3
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {payload[0].payload.name}
          </Typography>
          {payload.map((entry, index) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </Typography>
          ))}
        </Card>
      );
    }
    return null;
  };

  return (
    <MainCard
      title="Property Profitability"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
        boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: (t) => `0 8px 30px ${alpha(t.palette.primary.main, 0.2)}`
        }
      }}
      secondary={
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            onClick={() => handleViewChange('monthly')}
            color={view === 'monthly' ? 'primary' : 'inherit'}
            variant={view === 'monthly' ? 'contained' : 'outlined'}
          >
            This Month
          </Button>
          <Button
            size="small"
            onClick={() => handleViewChange('lifetime')}
            color={view === 'lifetime' ? 'primary' : 'inherit'}
            variant={view === 'lifetime' ? 'contained' : 'outlined'}
          >
            Lifetime
          </Button>
        </Stack>
      }
    >
      {loading ? (
        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularLoader />
        </Box>
      ) : !hasData ? (
        <EmptyState onAddProperty={onAddProperty} onAddExpense={onAddExpense} />
      ) : (
        <Box sx={{ pt: 2 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                formatter={(value) => (
                  <span style={{ color: theme.palette.text.primary, fontSize: '0.875rem' }}>
                    {value}
                  </span>
                )}
              />
              <Bar dataKey="revenue" fill={theme.palette.success.main} name="Revenue" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill={theme.palette.error.main} name="Expenses" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill={theme.palette.primary.main} name="Profit" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Box sx={{ mt: 3, px: 2, pb: 2 }}>
            <Link component={RouterLink} to="/landlord/property-portfolio" color="primary" sx={{ textDecoration: 'none' }}>
              <Typography variant="body2" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                View detailed profitability analysis →
              </Typography>
            </Link>
          </Box>
        </Box>
      )}
    </MainCard>
  );
}
