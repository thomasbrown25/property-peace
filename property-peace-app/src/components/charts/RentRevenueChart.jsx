import React, { useMemo } from 'react';
import { alpha, Box, Button, Grid, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSelector } from 'react-redux';
import { selectProperties } from 'store/property/property.selector';
import useFetchExpenses from 'hooks/useFetchExpenses';
import CircularLoader from 'components/CircularLoader';

// Custom tooltip for profitability chart
const CustomTooltip = ({ active, payload, theme }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const totalRent = typeof data.totalRent === 'number' ? data.totalRent : parseFloat(data.totalRent) || 0;
    const totalExpenses = typeof data.totalExpenses === 'number' ? data.totalExpenses : parseFloat(data.totalExpenses) || 0;
    const netIncome = totalRent - totalExpenses;

    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          boxShadow: 2
        }}
      >
        <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
          {data.property}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.success.main, mb: 0.5 }}>
          Total Rent: ${totalRent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.error.main, mb: 0.5 }}>
          Total Expenses: ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Typography>
        <Typography variant="body2" fontWeight="bold" sx={{ color: netIncome >= 0 ? theme.palette.success.main : theme.palette.error.main }}>
          Net Income: ${netIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Typography>
      </Box>
    );
  }
  return null;
};

export default function RentRevenueChart({ rentRecords = [], rentLoading = false }) {
  const theme = useTheme();
  const properties = useSelector(selectProperties);
  const { expenses, loading: expensesLoading } = useFetchExpenses({}); // Fetch all expenses

  const chartData = useMemo(() => {
    if (!properties || properties.length === 0) return [];

    // Group rent by property
    const rentByProperty = new Map();
    if (rentRecords && rentRecords.length > 0) {
      rentRecords.forEach((record) => {
        if (record.propertyId) {
          const currentTotal = rentByProperty.get(record.propertyId) || 0;
          const rentAmount = typeof record.collectedLifetime === 'number' 
            ? record.collectedLifetime 
            : parseFloat(record.collectedLifetime) || 0;
          rentByProperty.set(record.propertyId, currentTotal + rentAmount);
        }
      });
    }

    // Group expenses by property
    const expensesByProperty = new Map();
    if (expenses && expenses.length > 0) {
      expenses.forEach((expense) => {
        if (expense.propertyId) {
          const currentTotal = expensesByProperty.get(expense.propertyId) || 0;
          const expenseAmount = typeof expense.amount === 'number' 
            ? expense.amount 
            : parseFloat(expense.amount) || 0;
          expensesByProperty.set(expense.propertyId, currentTotal + expenseAmount);
        }
      });
    }

    // Create chart data array
    const data = properties.map((property) => {
      const totalRent = rentByProperty.get(property.id) || 0;
      const totalExpenses = expensesByProperty.get(property.id) || 0;
      return {
        property: property.name,
        totalRent,
        totalExpenses
      };
    }).filter((item) => item.totalRent > 0 || item.totalExpenses > 0) // Only show properties with data
      .sort((a, b) => b.totalRent - a.totalRent) // Sort by total rent descending (highest to lowest)
      .slice(0, 6); // Limit to maximum 6 properties

    return data;
  }, [properties, rentRecords, expenses]);

  return (
    <MainCard
      title="Property Profitability"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
      }}
      secondary={
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Button size="small" color="primary" variant="outlined" sx={{ textTransform: 'none' }}>
                Lifetime
              </Button>
            </Stack>
          </Grid>
        </Grid>
      }
    >
      {rentLoading || expensesLoading ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularLoader />
        </Box>
      ) : chartData.length === 0 ? (
        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            No data available. Add properties, leases, and expenses to see profitability.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ pt: 2, pr: 2, height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
              <XAxis
                dataKey="property"
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: alpha(theme.palette.primary.main, 0.05) }}
                content={<CustomTooltip theme={theme} />}
              />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{
                  color: theme.palette.text.secondary,
                  fontSize: 12
                }}
              />
              <Bar dataKey="totalRent" fill="#52c41a" name="Total Rent" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalExpenses" fill="#f5222d" name="Total Expenses" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </MainCard>
  );
}
