import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Box,
  Typography,
  Stack,
  Chip,
  alpha,
  CircularProgress,
  Button,
  Divider,
  useTheme
} from '@mui/material';
import {
  DollarCircleOutlined,
  UserOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  LockOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  RocketOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useSubscription } from 'hooks/useSubscription';

const REPORTS = [
  {
    id: 'tax-reports',
    title: 'Tax & Accounting',
    description: 'Tax-deductible expenses, Schedule E reports, and 1099 preparation',
    icon: <FileTextOutlined />,
    color: '#722ed1',
    route: '/landlord/reports/tax',
    order: 1,
    category: 'Tax',
    status: 'Year-end ready'
  },
  {
    id: 'financial-reports',
    title: 'Financial Reports',
    description: 'Expense reports, profitability analysis, and year-over-year comparisons',
    icon: <CalculatorOutlined />,
    color: '#722ed1',
    route: '/landlord/reports/financial',
    order: 2,
    category: 'Money',
    status: 'Exportable'
  },
  {
    id: 'revenue-per-unit',
    title: 'Revenue Per Unit',
    description: 'Revenue generated per unit under management',
    icon: <DollarCircleOutlined />,
    color: '#1890ff',
    route: '/landlord/reports/revenue-per-unit',
    order: 3,
    category: 'Revenue',
    status: 'Portfolio metric'
  },
  {
    id: 'occupancy',
    title: 'Occupancy',
    description: 'Percentage of units that are occupied across your entire portfolio',
    icon: <HomeOutlined />,
    color: '#52c41a',
    route: '/landlord/reports/occupancy',
    order: 4,
    category: 'Portfolio',
    status: 'Core KPI'
  },
  {
    id: 'median-ttt',
    title: 'Median Turn Time',
    description: 'Time it takes to turn over a unit after move-out',
    icon: <ClockCircleOutlined />,
    color: '#faad14',
    route: '/landlord/reports/median-ttt',
    order: 5,
    category: 'Operations',
    status: 'Make-ready'
  },
  {
    id: 'median-dom',
    title: 'Median Days on Market',
    description: 'Time it takes to lease a unit from listing to signed lease',
    icon: <ClockCircleOutlined />,
    color: '#eb2f96',
    route: '/landlord/reports/median-dom',
    order: 6,
    category: 'Leasing',
    status: 'Vacancy signal'
  },
  {
    id: 'units-per-employee',
    title: 'Units Per Employee',
    description: 'Total units divided by direct team members — measure team efficiency',
    icon: <UserOutlined />,
    color: '#fa8c16',
    route: '/landlord/reports/units-per-employee',
    order: 7,
    category: 'Team',
    status: 'Efficiency'
  },
  {
    id: 'nps-tenant',
    title: 'Tenant NPS Score',
    description: 'Measures resident satisfaction and likelihood to recommend',
    icon: <TrophyOutlined />,
    color: '#2f54eb',
    route: '/landlord/reports/nps-tenant',
    order: 8,
    category: 'Experience',
    status: 'Sentiment'
  }
];

const sortedReports = [...REPORTS].sort((a, b) => (a.order || 999) - (b.order || 999));

function ReportList({ reports, locked = false }) {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <MainCard
      content={false}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
        boxShadow: 'none',
        overflow: 'hidden'
      }}
    >
      <Stack divider={<Divider />}>
        {reports.map((report) => (
          <Box
            key={report.id}
            role="button"
            tabIndex={0}
            onClick={() => !locked && navigate(report.route)}
            onKeyDown={(event) => {
              if (!locked && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                navigate(report.route);
              }
            }}
            sx={{
              px: 2.25,
              py: 1.75,
              cursor: locked ? 'default' : 'pointer',
              bgcolor: 'background.paper',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: locked ? 'background.paper' : alpha(theme.palette.primary.main, 0.035)
              },
              '&:focus-visible': {
                outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                outlineOffset: -2
              }
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.25,
                  color: report.color,
                  bgcolor: alpha(report.color, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 17
                }}
              >
                {report.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {report.title}
                  </Typography>
                  <Chip size="small" label={report.category} sx={{ height: 20, fontSize: '0.68rem' }} />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {report.description}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                <Chip size="small" label={report.status} variant="outlined" sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
                {locked ? <LockOutlined style={{ color: theme.palette.text.disabled }} /> : <ArrowRightOutlined style={{ color: theme.palette.text.secondary }} />}
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </MainCard>
  );
}

function PremiumUpgradePage() {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Stack spacing={3}>
      <AnimateIn direction="bottom" delay={300} distance={120}>
      <MainCard sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1.5, boxShadow: 'none' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Unlock Reports & Analytics
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680 }}>
              Premium adds the full report workspace, financial exports, tax prep views, and portfolio health analytics.
            </Typography>
          </Box>
          <Button variant="contained" onClick={() => navigate('/landlord/subscription')} startIcon={<RocketOutlined />} sx={{ flexShrink: 0 }}>
            Upgrade to Premium
          </Button>
        </Stack>
      </MainCard>
      </AnimateIn>

      <AnimateIn direction="bottom" delay={400} distance={120}>
      <Grid container spacing={2.5}>
        <Grid size={12}>
          <ReportList reports={sortedReports} locked />
        </Grid>
      </Grid>
      </AnimateIn>
    </Stack>
  );
}

export default function ReportsDashboard() {
  const theme = useTheme();
  const { subscription, loading: subscriptionLoading } = useSubscription();

  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const hasPremiumAccess = planName === 'premium' || planName.includes('lifetime');

  if (subscriptionLoading) {
    return (
      <Box>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Reports & Analytics' }
          ]}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <AnimateIn direction="bottom" delay={100} distance={120}>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Reports & Analytics' }
        ]}
      />
      </AnimateIn>

      <AnimateIn direction="bottom" delay={200} distance={120}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="h3" fontWeight={700}>
              Reports & Analytics
            </Typography>
            {hasPremiumAccess && <Chip size="small" label="Premium" color="primary" variant="outlined" />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Track portfolio health, financial performance, tax readiness, and operating trends.
          </Typography>
        </Box>
      </Stack>
      </AnimateIn>

      {hasPremiumAccess ? (
        <Stack spacing={3}>
          <AnimateIn direction="bottom" delay={300} distance={120}>
          <Grid container spacing={2.5}>
            <Grid size={12}>
              <ReportList reports={sortedReports} />
            </Grid>
          </Grid>
          </AnimateIn>

          <AnimateIn direction="bottom" delay={500} distance={120}>
          <MainCard sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1.5, boxShadow: 'none' }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <CheckCircleOutlined style={{ color: theme.palette.success.main, fontSize: 18, marginTop: 2 }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Start with Portfolio and Financial Reports
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Those two views answer the most common landlord questions first: occupancy, revenue, expense trends, and tax prep readiness.
                </Typography>
              </Box>
            </Stack>
          </MainCard>
          </AnimateIn>
        </Stack>
      ) : (
        <PremiumUpgradePage />
      )}
    </Box>
  );
}
