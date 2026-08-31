import { useEffect, useState } from 'react';
import { Alert, alpha, Box, Button, Chip, Divider, Paper, Stack, Tab, Tabs, Typography, useTheme } from '@mui/material';
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  CreditCardOutlined,
  DollarCircleOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';

import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import useRentPaymentAccess from 'hooks/useRentPaymentAccess';
import OnlinePaymentTransactions from 'sections/landlord/payments/OnlinePaymentTransactions';
import { PaymentsSettingsContent } from 'sections/landlord/settings/PaymentsSettings';
import PayoutAssignments from 'sections/landlord/settings/PayoutAssignments';
import axiosServices from 'utils/axios';
import { DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs, getSelectedOnlinePaymentTab } from 'utils/onlinePaymentTabs';
import { hasContinuedToOnlinePayments, markOnlinePaymentsContinued } from 'utils/onlinePaymentsWelcome';

const PAYMENT_METHODS = ['ACH', 'Credit', 'Debit'];

export default function OnlinePaymentsPage() {
  const theme = useTheme();
  const { user, updateUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const rentPaymentAccess = useRentPaymentAccess();
  const [hasContinued, setHasContinued] = useState(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const [continueError, setContinueError] = useState('');
  const [activeTab, setActiveTab] = useState(DEFAULT_ONLINE_PAYMENT_TAB);
  const [paymentHeaderActionElement, setPaymentHeaderActionElement] = useState(null);
  const paymentTabs = getOnlinePaymentTabs(rentPaymentAccess.access, rentPaymentAccess.presentation.canConfigure);
  const selectedTab = getSelectedOnlinePaymentTab(activeTab, paymentTabs);

  useEffect(() => {
    if (!user) return;
    const hasContinuedInDatabase = user.hasContinuedToOnlinePayments === true || user.HasContinuedToOnlinePayments === true;
    const hasLegacyLocalValue = hasContinuedToOnlinePayments(user, currentOrganization);
    setHasContinued(hasContinuedInDatabase || hasLegacyLocalValue);

    if (!hasContinuedInDatabase && hasLegacyLocalValue) {
      axiosServices
        .post('/api/user/online-payments-welcome/continue')
        .then(() => updateUser({ hasContinuedToOnlinePayments: true }))
        .catch(() => {
          // Keep honoring the legacy local value; the next visit will retry the database migration.
        });
    }
  }, [currentOrganization, updateUser, user]);

  const continueToWorkspace = async () => {
    setIsContinuing(true);
    setContinueError('');
    try {
      const response = await axiosServices.post('/api/user/online-payments-welcome/continue');
      if (response.data?.success !== true || response.data?.data !== true) {
        throw new Error(response.data?.message || 'Unable to save your preference.');
      }

      updateUser({ hasContinuedToOnlinePayments: true });
      markOnlinePaymentsContinued(user, currentOrganization);
      setHasContinued(true);
    } catch (error) {
      setContinueError(error?.message || 'We could not open Online Payments. Please try again.');
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <Box>
      <ManagementPageHeader
        title="Online Payments"
        description="Set up and manage the way renters pay you online."
        actions={selectedTab === 'bank-accounts' ? <Box ref={setPaymentHeaderActionElement} /> : null}
        marginBottom={3}
      />

      {hasContinued === true && (
        <Box>
          <Box
            sx={{
              width: '100%',
              mb: 3,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'transparent',
              '& .MuiTabs-root': { minHeight: 46, width: '100%' },
              '& .MuiTab-root': {
                minHeight: 46,
                px: { xs: 2, sm: 2.5 },
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'text.secondary',
                bgcolor: 'transparent',
                '&:hover': {
                  color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.06)
                },
                '&.Mui-selected': {
                  color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
                  bgcolor: 'transparent'
                }
              },
              '& .MuiTabs-indicator': { height: 2, borderRadius: 2 }
            }}
          >
            <Tabs
              value={selectedTab}
              onChange={(_event, value) => setActiveTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Online payment settings"
            >
              {paymentTabs.map(({ id, label }) => (
                <Tab key={id} value={id} label={label} id={`online-payments-tab-${id}`} aria-controls={`online-payments-panel-${id}`} />
              ))}
            </Tabs>
          </Box>

          <Box
            role="tabpanel"
            hidden={selectedTab !== 'transactions'}
            id="online-payments-panel-transactions"
            aria-labelledby="online-payments-tab-transactions"
          >
            {selectedTab === 'transactions' && <OnlinePaymentTransactions />}
          </Box>
          <Box
            role="tabpanel"
            hidden={selectedTab !== 'bank-accounts'}
            id="online-payments-panel-bank-accounts"
            aria-labelledby="online-payments-tab-bank-accounts"
          >
            {selectedTab === 'bank-accounts' && (
              <PaymentsSettingsContent rentPaymentAccess={rentPaymentAccess} headerActionElement={paymentHeaderActionElement} />
            )}
          </Box>
          <Box
            role="tabpanel"
            hidden={selectedTab !== 'payout-assignments'}
            id="online-payments-panel-payout-assignments"
            aria-labelledby="online-payments-tab-payout-assignments"
          >
            {selectedTab === 'payout-assignments' && <PayoutAssignments />}
          </Box>
        </Box>
      )}
      {hasContinued === false && (
        <Paper
          component="section"
          aria-labelledby="online-payments-hero-title"
          elevation={0}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.12)}`,
            borderRadius: { xs: 2.5, md: 4 },
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark' ? '0 22px 60px rgba(0,0,0,0.28)' : `0 24px 64px ${alpha('#061E35', 0.1)}`
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.08fr) minmax(390px, 0.92fr)' },
              gridTemplateAreas: { xs: '"content" "preview"', lg: '"preview content"' },
              minHeight: { lg: 570 }
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                gridArea: 'preview',
                position: 'relative',
                minHeight: { xs: 340, sm: 430, lg: 'auto' },
                overflow: 'hidden',
                p: { xs: 2.5, sm: 5, lg: 6 },
                background:
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(145deg, #071b2e 0%, #0a2b43 58%, #0f3f4f 100%)'
                    : 'linear-gradient(145deg, #061E35 0%, #0A3850 58%, #0D4B55 100%)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  width: 330,
                  height: 330,
                  borderRadius: '50%',
                  top: -145,
                  right: -90,
                  background: `radial-gradient(circle, ${alpha(theme.palette.success.light, 0.28)} 0%, transparent 68%)`
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.16,
                  backgroundImage: `linear-gradient(${alpha('#ffffff', 0.18)} 1px, transparent 1px), linear-gradient(90deg, ${alpha('#ffffff', 0.18)} 1px, transparent 1px)`,
                  backgroundSize: '36px 36px',
                  maskImage: 'linear-gradient(to bottom right, black, transparent 72%)'
                }
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  position: 'absolute',
                  width: { xs: '74%', sm: '64%' },
                  height: 105,
                  top: { xs: 44, sm: 52 },
                  left: { xs: '13%', sm: '17%' },
                  borderRadius: 3,
                  bgcolor: alpha('#ffffff', 0.1),
                  border: `1px solid ${alpha('#ffffff', 0.14)}`,
                  transform: 'rotate(-4deg)'
                }}
              />

              <Paper
                elevation={0}
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  maxWidth: 510,
                  mx: 'auto',
                  mt: { xs: 5, sm: 6 },
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: '#ffffff',
                  color: '#061E35',
                  boxShadow: '0 26px 70px rgba(0,0,0,0.28)',
                  transform: { xs: 'rotate(-1deg)', sm: 'rotate(-1.5deg)' }
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 1.5,
                        bgcolor: alpha('#10A36D', 0.12),
                        color: '#078457'
                      }}
                    >
                      <DollarCircleOutlined style={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ color: '#061E35', fontWeight: 800, lineHeight: 1.2 }}>Rent collection</Typography>
                      <Typography variant="caption" sx={{ color: '#6D7B88' }}>
                        Payment workspace
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip
                    size="small"
                    label="Secure"
                    icon={<SafetyCertificateOutlined />}
                    sx={{ bgcolor: alpha('#10A36D', 0.1), color: '#087650', fontWeight: 700 }}
                  />
                </Stack>

                <Divider />

                <Box sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-end" spacing={2} sx={{ mb: 2.5 }}>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ color: '#758492', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                      >
                        Collection flow
                      </Typography>
                      <Typography sx={{ mt: 0.5, color: '#061E35', fontSize: '1.25rem', fontWeight: 800 }}>Ready when you are</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#087650' }}>
                      <CheckCircleFilled />
                      <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 800 }}>
                        Protected
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack spacing={1.25}>
                    {[
                      ['Invite renters', 'Choose who can pay online'],
                      ['Collect payments', 'Rent and property charges'],
                      ['Track activity', 'Balances and payment history']
                    ].map(([title, detail], index) => (
                      <Stack
                        key={title}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ p: 1.35, borderRadius: 2, bgcolor: index === 1 ? alpha('#10A36D', 0.08) : '#F6F8FA' }}
                      >
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: index === 1 ? '#10A36D' : '#E5EAF0',
                            color: index === 1 ? '#ffffff' : '#52616F',
                            fontSize: 12,
                            fontWeight: 900
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ color: '#061E35', fontWeight: 800 }}>
                            {title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#748290' }}>
                            {detail}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  position: 'absolute',
                  zIndex: 2,
                  right: { xs: 18, sm: 30, lg: 38 },
                  bottom: { xs: 22, sm: 32, lg: 40 },
                  width: { xs: 205, sm: 240 },
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: '#ffffff',
                  color: '#061E35',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.24)',
                  transform: 'rotate(2deg)'
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                  <CreditCardOutlined style={{ color: '#10A36D', fontSize: 18 }} />
                  <Typography variant="body2" sx={{ color: '#061E35', fontWeight: 800 }}>
                    Ways to pay
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {PAYMENT_METHODS.map((method) => (
                    <Chip key={method} size="small" label={method} sx={{ bgcolor: '#EEF3F5', color: '#314454', fontWeight: 700 }} />
                  ))}
                </Stack>
              </Paper>
            </Box>

            <Stack
              justifyContent="center"
              sx={{
                gridArea: 'content',
                position: 'relative',
                p: { xs: 3, sm: 5, lg: 7 },
                background:
                  theme.palette.mode === 'dark'
                    ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.96)}, ${alpha(theme.palette.primary.dark, 0.14)})`
                    : 'linear-gradient(145deg, #FFFFFF 0%, #FBFDFC 100%)'
              }}
            >
              <Typography
                id="online-payments-hero-title"
                component="div"
                sx={{
                  maxWidth: 520,
                  color: 'text.primary',
                  fontSize: { xs: '1.75rem', sm: '2.1rem', lg: '2.35rem' },
                  fontWeight: 850,
                  letterSpacing: '-0.045em',
                  lineHeight: 1.03
                }}
              >
                Online payments, handled.
              </Typography>

              <Typography
                sx={{ mt: 2.25, maxWidth: 530, color: 'text.secondary', fontSize: { xs: '1rem', sm: '1.08rem' }, lineHeight: 1.72 }}
              >
                Collect rent and property charges without manual tracking or back-and-forth. Payment activity stays connected to your
                Property Peace workspace.
              </Typography>

              <Stack spacing={1.75} sx={{ mt: 3.25 }}>
                {[
                  'Offer renters ACH, credit, and debit card payment options',
                  'Keep payments, balances, and recorded activity in one place',
                  'Manage payout details through a secure Stripe setup'
                ].map((benefit) => (
                  <Stack key={benefit} direction="row" spacing={1.4} alignItems="flex-start">
                    <Box sx={{ mt: '7px', width: 9, height: 9, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }} />
                    <Typography sx={{ color: 'text.primary', fontWeight: 650, lineHeight: 1.55 }}>{benefit}</Typography>
                  </Stack>
                ))}
              </Stack>

              <Stack direction="row" sx={{ mt: 4.25 }}>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  onClick={continueToWorkspace}
                  disabled={isContinuing}
                  endIcon={<ArrowRightOutlined />}
                  sx={{
                    minHeight: 46,
                    px: 2.75,
                    fontWeight: 850,
                    boxShadow: `0 12px 28px ${alpha(theme.palette.success.main, 0.24)}`
                  }}
                >
                  {isContinuing ? 'Opening Online Payments…' : 'Continue to Online Payments'}
                </Button>
              </Stack>
              {continueError && (
                <Alert severity="error" sx={{ mt: 2.25, maxWidth: 530 }}>
                  {continueError}
                </Alert>
              )}
            </Stack>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
