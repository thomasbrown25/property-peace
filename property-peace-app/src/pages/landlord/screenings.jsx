import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { SafetyOutlined } from '@ant-design/icons';
import ScreeningsHeader from 'sections/landlord/screenings/ScreeningsHeader';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';
import { screeningApi } from 'api/screening';
import {
  enumLabel,
  exchangeMetadata,
  formatMinorAmount,
  getPayerLabel,
  getSafeNavigationUrl,
  navigateTopLevel,
  normalizeOptions,
  read
} from 'utils/screening';

const statusLabels = {
  0: 'Invited',
  1: 'Consent pending',
  2: 'Payment pending',
  3: 'Processing',
  4: 'Complete',
  5: 'Action required',
  6: 'Expired',
  7: 'Disputed',
  8: 'Failed'
};
const decisionLabels = { 1: 'Approved', 2: 'Denied', 3: 'Conditional', 4: 'Deferred' };
const deliveryLabels = { 1: 'Requested', 2: 'Delivered', 3: 'Failed' };
const reportLabels = { 1: 'Received', 2: 'Complete', 3: 'Corrected', 4: 'Superseded' };
const adverseLabels = { 1: 'Pre-adverse action', 2: 'Final adverse action' };
const value = (object, key, fallback = undefined) => read(object, key) ?? fallback;
const toId = (raw) => {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

function QuoteBreakdown({ quote }) {
  if (!quote) return null;
  const currency = value(quote, 'currency');
  const rows = [
    ['Provider charge', value(quote, 'providerAmountMinor')],
    ['Platform fee', value(quote, 'platformFeeMinor')],
    ['Tax', value(quote, 'taxAmountMinor')],
    ['Landlord responsibility', value(quote, 'landlordAmountMinor')],
    ['Applicant responsibility', value(quote, 'applicantAmountMinor')]
  ];
  return (
    <Stack spacing={0.75} aria-label="Authoritative fee breakdown">
      {rows.map(([label, amount]) => (
        <Stack key={label} direction="row" justifyContent="space-between">
          <Typography color="text.secondary">{label}</Typography>
          <Typography>{formatMinorAmount(amount, currency)}</Typography>
        </Stack>
      ))}
      <Divider />
      <Stack direction="row" justifyContent="space-between">
        <Typography fontWeight={700}>Total</Typography>
        <Typography fontWeight={700}>{formatMinorAmount(value(quote, 'totalAmountMinor'), currency)}</Typography>
      </Stack>
    </Stack>
  );
}

export default function ScreeningsPage() {
  const [params, setParams] = useSearchParams();
  const { presentation, canInvoke } = useFeatureReadiness(FEATURE_KEYS.tenantScreening);
  const [applicationInput, setApplicationInput] = useState(params.get('applicationId') || '');
  const applicationId = toId(params.get('applicationId'));
  const selectedOrderId = toId(params.get('orderId'));
  const [quoteOptions, setQuoteOptions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOption, setSelectedOption] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(1);
  const [reasonCodes, setReasonCodes] = useState([]);
  const [actionType, setActionType] = useState(1);
  const [channel, setChannel] = useState(1);

  const loadApplication = useCallback(
    async (id) => {
      if (!canInvoke || !id) return;
      setLoading(true);
      setError('');
      try {
        const [optionsResult, detailsResult] = await Promise.all([screeningApi.quoteOptions(id), screeningApi.detailsByApplication(id)]);
        const normalized = normalizeOptions(optionsResult);
        setQuoteOptions(normalized);
        setSelectedOption(normalized.length ? '0' : '');
        setOrders(Array.isArray(detailsResult) ? detailsResult : []);
      } catch (requestError) {
        setError(requestError?.message || 'Unable to load screening policy and orders.');
      } finally {
        setLoading(false);
      }
    },
    [canInvoke]
  );

  const loadDetail = useCallback(
    async (id) => {
      if (!canInvoke || !id) return;
      setLoading(true);
      setError('');
      try {
        setDetail(await screeningApi.detail(id));
        // Reason codes are authoritative per order. Never carry a selection from
        // a previously viewed order into this decision.
        setReasonCodes([]);
      } catch (requestError) {
        setError(requestError?.message || 'Unable to load the screening order.');
      } finally {
        setLoading(false);
      }
    },
    [canInvoke]
  );

  useEffect(() => {
    if (applicationId) loadApplication(applicationId);
  }, [applicationId, loadApplication]);
  useEffect(() => {
    if (selectedOrderId) loadDetail(selectedOrderId);
    else setDetail(null);
  }, [selectedOrderId, loadDetail]);

  const option = selectedOption === '' ? null : quoteOptions[Number(selectedOption)];
  const reports = value(detail, 'reports', []);
  const latestReportId = value(detail, 'latestReportRevisionId');
  const currentDecision = value(detail, 'decision');
  const adverse = value(detail, 'adverseAction');
  const latestDelivery = value(adverse, 'latestDelivery');
  const criteriaVersion = value(detail, 'rentalCriteriaVersion');
  const criteriaStatement = value(detail, 'rentalCriteriaStatement');
  const reasonCodeOptions = value(detail, 'reasonCodeOptions', []);

  const selectApplication = () => {
    const id = toId(applicationInput);
    if (!id) {
      setError('Enter a valid application ID.');
      return;
    }
    setParams({ applicationId: String(id) });
  };

  const createOrder = async () => {
    if (!applicationId || !option || !canInvoke) return;
    setBusy('create');
    setError('');
    try {
      const created = await screeningApi.create(applicationId, value(option, 'packageCode'), value(option, 'payer'), crypto.randomUUID());
      const orderId = toId(value(created, 'orderId'));
      if (!orderId) throw new Error('The screening order response did not include a valid order ID.');
      setParams({ applicationId: String(applicationId), orderId: String(orderId) });
      await loadApplication(applicationId);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start screening.');
    } finally {
      setBusy('');
    }
  };

  const recordDecision = async () => {
    const reasons = reasonCodes;
    if (!selectedOrderId || !criteriaVersion || !reasons.length) {
      setError('Criteria, report revision, and at least one reason code are required.');
      return;
    }
    setBusy('decision');
    setError('');
    try {
      await screeningApi.decide(selectedOrderId, { decision, criteriaVersion, reportRevisionId: latestReportId, reasonCodes: reasons });
      await loadDetail(selectedOrderId);
      setReasonCodes([]);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to record the decision.');
    } finally {
      setBusy('');
    }
  };

  const deliverAdverse = async () => {
    if (!selectedOrderId || !value(currentDecision, 'decisionRevisionId')) return;
    setBusy('adverse');
    setError('');
    try {
      await screeningApi.adverseAction(selectedOrderId, {
        decisionRevisionId: value(currentDecision, 'decisionRevisionId'),
        actionType,
        channel
      });
      await loadDetail(selectedOrderId);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to deliver adverse action.');
    } finally {
      setBusy('');
    }
  };

  const retryDelivery = async () => {
    setBusy('retry');
    setError('');
    try {
      await screeningApi.retryAdverseAction(value(adverse, 'adverseActionId'), channel);
      await loadDetail(selectedOrderId);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to retry delivery.');
    } finally {
      setBusy('');
    }
  };

  const revoke = async () => {
    if (!window.confirm('Revoke this applicant’s screening link? This takes effect immediately.')) return;
    setBusy('revoke');
    setError('');
    try {
      await screeningApi.revokeAccess(selectedOrderId);
      await loadDetail(selectedOrderId);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to revoke applicant access.');
    } finally {
      setBusy('');
    }
  };

  const openReport = async () => {
    if (!selectedOrderId || !latestReportId) return;
    setBusy('report');
    setError('');
    try {
      const response = await screeningApi.reportAccess(selectedOrderId);
      const destination = getSafeNavigationUrl(response.data?.data ?? response.data, exchangeMetadata(response));
      navigateTopLevel(destination);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to open the secure report.');
    } finally {
      setBusy('');
    }
  };

  const selectedStatus = value(detail, 'status');

  return (
    <Box sx={{ pb: 6 }}>
      <ScreeningsHeader />
      <FeatureReadinessNotice presentation={presentation} featureName="Tenant screening" />
      <Stack spacing={2.5} sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
                <TextField
                  label="Rental application ID"
                  value={applicationInput}
                  onChange={(event) => setApplicationInput(event.target.value)}
                  inputMode="numeric"
                  fullWidth
                  helperText="Use the ID from the application workspace."
                />
                <Button variant="contained" onClick={selectApplication} disabled={!canInvoke || loading} sx={{ minWidth: 150, height: 56 }}>
                  Review
                </Button>
              </Stack>
              {loading && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography color="text.secondary">Loading authoritative screening data…</Typography>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {applicationId && !selectedOrderId && (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h5">Start a screening order</Typography>
                  <Typography color="text.secondary">
                    Choose the exact package and payer combination allowed by current policy. Exact fees are locked by the server when the
                    order is created and shown in the order review.
                  </Typography>
                </Box>
                {!quoteOptions.length && !loading ? (
                  <Alert severity="info">No screening options are currently available for this application.</Alert>
                ) : (
                  <FormControl fullWidth>
                    <InputLabel id="quote-option-label">Policy-approved option</InputLabel>
                    <Select
                      labelId="quote-option-label"
                      label="Policy-approved option"
                      value={selectedOption}
                      onChange={(event) => setSelectedOption(event.target.value)}
                    >
                      {quoteOptions.map((item, index) => (
                        <MenuItem value={String(index)} key={`${value(item, 'packageCode')}-${value(item, 'payer')}-${index}`}>
                          {value(item, 'packageCode')} · {getPayerLabel(item)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {option && (
                  <Box sx={{ p: 2, bgcolor: 'action.hover', border: 1, borderColor: 'divider' }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" gap={1} flexWrap="wrap">
                        <Chip icon={<SafetyOutlined />} label={`Package: ${value(option, 'packageCode')}`} />
                        <Chip label={getPayerLabel(option)} />
                      </Stack>
                      <Alert severity="info">
                        The policy endpoint does not quote fees. Review the authoritative fee breakdown immediately after order creation.
                      </Alert>
                    </Stack>
                  </Box>
                )}
                <Button variant="contained" onClick={createOrder} disabled={!option || busy === 'create' || !canInvoke}>
                  {busy === 'create' ? 'Starting…' : 'Confirm and invite applicant'}
                </Button>
                {!!orders.length && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      Existing orders
                    </Typography>
                    <Stack spacing={1}>
                      {orders.map((order) => (
                        <Button
                          key={value(order, 'orderId')}
                          variant="outlined"
                          onClick={() => setParams({ applicationId: String(applicationId), orderId: String(value(order, 'orderId')) })}
                          sx={{ justifyContent: 'space-between' }}
                        >
                          <span>Order {value(order, 'orderId')}</span>
                          <span>{enumLabel(value(order, 'status'), statusLabels)}</span>
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {detail && (
          <>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                    <Box>
                      <Typography variant="h5">Property screening order</Typography>
                      <Typography color="text.secondary">
                        Property {value(detail, 'propertyId')} · application {value(detail, 'rentalApplicationId')} · revision{' '}
                        {value(detail, 'revision')}
                      </Typography>
                    </Box>
                    <Chip color={selectedStatus === 4 ? 'success' : 'primary'} label={enumLabel(selectedStatus, statusLabels)} />
                  </Stack>
                  <Alert severity="info">Next: {enumLabel(value(detail, 'nextAction', 'Review the current order state.'))}</Alert>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    <Chip label={`Package ${value(detail, 'packageCode')}`} />
                    <Chip label={`Criteria ${criteriaVersion}`} />
                    <Chip label={getPayerLabel(value(detail, 'quote', {}))} />
                  </Stack>
                  <QuoteBreakdown quote={value(detail, 'quote')} />
                  <Divider />
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={revoke}
                      disabled={busy === 'revoke' || value(detail, 'applicantAccessRevoked')}
                    >
                      {value(detail, 'applicantAccessRevoked') ? 'Applicant access revoked' : 'Revoke applicant access'}
                    </Button>
                    <Button variant="text" onClick={() => setParams({ applicationId: String(applicationId) })}>
                      Back to orders
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5">Report evidence revisions</Typography>
                    <Typography color="text.secondary">
                      Review normalized evidence by revision. Corrected reports remain visibly revisioned.
                    </Typography>
                  </Box>
                  {latestReportId && (
                    <Button variant="outlined" onClick={openReport} disabled={busy === 'report'}>
                      {busy === 'report' ? 'Preparing secure report…' : 'Open latest report securely'}
                    </Button>
                  )}
                  {!reports.length ? (
                    <Alert severity="info">No report evidence has been received.</Alert>
                  ) : (
                    reports.map((report) => (
                      <Box
                        key={value(report, 'reportRevisionId')}
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: value(report, 'reportRevisionId') === latestReportId ? 'primary.main' : 'divider'
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography fontWeight={700}>Revision {value(report, 'revision')}</Typography>
                            <Chip size="small" label={enumLabel(value(report, 'status'), reportLabels)} />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            Received {new Date(value(report, 'receivedAt')).toLocaleString()}
                          </Typography>
                          {value(report, 'correctedAt') && (
                            <Typography variant="caption" color="text.secondary">
                              Corrected {new Date(value(report, 'correctedAt')).toLocaleString()}
                            </Typography>
                          )}
                          <Stack component="dl" spacing={0.5} sx={{ m: 0 }}>
                            {value(report, 'facts', []).map((fact, index) => (
                              <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ sm: 1 }} key={`${value(fact, 'label')}-${index}`}>
                                <Typography component="dt" fontWeight={600}>
                                  {value(fact, 'label')}
                                </Typography>
                                <Typography component="dd" sx={{ m: 0 }}>
                                  {value(fact, 'value')}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Stack>
                      </Box>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5">Human decision</Typography>
                    <Typography color="text.secondary">
                      The recorded decision is bound to criteria {criteriaVersion} and report revision {latestReportId || 'not available'}.
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }} aria-label="Frozen rental criteria">
                    <Typography variant="subtitle2">Frozen rental criteria · version {criteriaVersion}</Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{criteriaStatement || 'No criteria statement is available.'}</Typography>
                  </Box>
                  {currentDecision && (
                    <Alert severity="success">
                      Current decision: {enumLabel(value(currentDecision, 'decision'), decisionLabels)} · decision revision{' '}
                      {value(currentDecision, 'revision')}
                    </Alert>
                  )}
                  <FormControl fullWidth>
                    <InputLabel id="decision-label">Decision</InputLabel>
                    <Select labelId="decision-label" value={decision} label="Decision" onChange={(event) => setDecision(event.target.value)}>
                      {Object.entries(decisionLabels).map(([key, label]) => (
                        <MenuItem key={key} value={Number(key)}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel id="reason-codes-label">Policy reasons</InputLabel>
                    <Select
                      labelId="reason-codes-label"
                      multiple
                      value={reasonCodes}
                      label="Policy reasons"
                      onChange={(event) => setReasonCodes(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}
                      renderValue={(selected) =>
                        selected
                          .map((code) => value(reasonCodeOptions.find((item) => value(item, 'code') === code), 'label', code))
                          .join(', ')
                      }
                    >
                      {reasonCodeOptions.map((item) => (
                        <MenuItem key={value(item, 'code')} value={value(item, 'code')}>
                          {value(item, 'label')} ({value(item, 'code')})
                        </MenuItem>
                      ))}
                    </Select>
                    {!reasonCodeOptions.length && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                        No authoritative policy reasons are available for this order.
                      </Typography>
                    )}
                  </FormControl>
                  <Button
                    variant="contained"
                    onClick={recordDecision}
                    disabled={!latestReportId || !criteriaVersion || !reasonCodes.length || !reasonCodeOptions.length || busy === 'decision'}
                  >
                    {busy === 'decision' ? 'Recording…' : 'Record decision'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5">Adverse action delivery</Typography>
                    <Typography color="text.secondary">
                      Deliver and monitor policy-generated notices without displaying provider references.
                    </Typography>
                  </Box>
                  {adverse && (
                    <Alert severity={value(latestDelivery, 'status') === 3 ? 'warning' : 'info'}>
                      Notice: {enumLabel(value(adverse, 'actionType'), adverseLabels)} · delivery{' '}
                      {enumLabel(value(latestDelivery, 'status'), deliveryLabels)}
                      {value(latestDelivery, 'attemptNumber') ? ` · attempt ${value(latestDelivery, 'attemptNumber')}` : ''} ·
                      reconsideration {enumLabel(value(adverse, 'reconsiderationStatus'))}
                    </Alert>
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <FormControl fullWidth>
                      <InputLabel id="notice-stage-label">Notice stage</InputLabel>
                      <Select
                        labelId="notice-stage-label"
                        value={actionType}
                        label="Notice stage"
                        onChange={(event) => setActionType(event.target.value)}
                      >
                        <MenuItem value={1}>Pre-adverse action</MenuItem>
                        <MenuItem value={2}>Final adverse action</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel id="delivery-channel-label">Delivery channel</InputLabel>
                      <Select
                        labelId="delivery-channel-label"
                        value={channel}
                        label="Delivery channel"
                        onChange={(event) => setChannel(event.target.value)}
                      >
                        <MenuItem value={1}>Email</MenuItem>
                        <MenuItem value={2}>Postal mail</MenuItem>
                        <MenuItem value={3}>SMS</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                    <Button variant="contained" color="warning" onClick={deliverAdverse} disabled={!currentDecision || busy === 'adverse'}>
                      {busy === 'adverse' ? 'Delivering…' : 'Create and deliver notice'}
                    </Button>
                    {adverse && value(latestDelivery, 'status') === 3 && (
                      <Button variant="outlined" onClick={retryDelivery} disabled={busy === 'retry'}>
                        Retry delivery
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </>
        )}
      </Stack>
    </Box>
  );
}
