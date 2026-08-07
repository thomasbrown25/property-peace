import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Link,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { LockOutlined, ShieldOutlined } from '@mui/icons-material';
import { applicantScreeningApi } from 'api/screening';
import {
  enumLabel,
  exchangeMetadata,
  formatMinorAmount,
  getPayerLabel,
  getSafeNavigationUrl,
  navigateTopLevel,
  read,
  screeningErrorState
} from 'utils/screening';

const value = (object, key, fallback = undefined) => read(object, key) ?? fallback;
const statusLabels = {
  0: 'Invited',
  1: 'Consent needed',
  2: 'Payment pending',
  3: 'Processing',
  4: 'Complete',
  5: 'Action required',
  6: 'Expired',
  7: 'Disputed',
  8: 'Unable to complete'
};
const adverseLabels = { 1: 'Pre-adverse action', 2: 'Final adverse action' };
const deliveryLabels = { 1: 'Requested', 2: 'Delivered', 3: 'Failed' };
const reconsiderationLabels = { 1: 'Not requested', 2: 'Requested', 3: 'Under review', 4: 'Resolved' };
const disputeIssueOptions = [
  ['identity_information', 'Identity or personal information is incorrect'],
  ['account_not_mine', 'An account or record is not mine'],
  ['payment_history', 'Payment history or balance is incorrect'],
  ['rental_history', 'Rental or eviction history is incorrect'],
  ['criminal_history', 'Criminal-history information is incorrect'],
  ['duplicate_information', 'Information appears more than once'],
  ['other_report_information', 'Other report information is incorrect']
];

function FeeSummary({ quote }) {
  if (!quote) return null;
  const currency = value(quote, 'currency');
  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', border: 1, borderColor: 'divider' }}>
      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">Payment responsibility</Typography>
          <Typography fontWeight={600}>{getPayerLabel(quote)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">Your amount</Typography>
          <Typography fontWeight={600}>{formatMinorAmount(value(quote, 'applicantAmountMinor'), currency)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography color="text.secondary">Total screening price</Typography>
          <Typography>{formatMinorAmount(value(quote, 'totalAmountMinor'), currency)}</Typography>
        </Stack>
        {(value(quote, 'expiresAt') || value(quote, 'quoteExpiresAt')) && (
          <Typography variant="caption" color="text.secondary">
            Quote expires {new Date(value(quote, 'expiresAt') || value(quote, 'quoteExpiresAt')).toLocaleString()}.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export default function ApplicantScreeningPage() {
  const { token = '' } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [status, setStatus] = useState(null);
  const [adverseNotice, setAdverseNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [errorState, setErrorState] = useState(null);
  const [message, setMessage] = useState('');
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [authorizationAccepted, setAuthorizationAccepted] = useState(false);
  const [reconsideration, setReconsideration] = useState('');
  const [issueCodes, setIssueCodes] = useState([]);
  const [disputeNarrative, setDisputeNarrative] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [invitationResult, statusResult] = await Promise.all([
        applicantScreeningApi.invitation(token),
        applicantScreeningApi.status(token)
      ]);
      setInvitation(invitationResult.body);
      setStatus(statusResult.body);
      const noticeSummary = value(statusResult.body, 'adverseAction');
      setAdverseNotice(noticeSummary || null);
      if (noticeSummary) {
        const noticeResult = await applicantScreeningApi.adverseAction(token);
        setAdverseNotice(noticeResult.body);
      }
      setErrorState(null);
    } catch (error) {
      setErrorState(screeningErrorState(error.status));
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // After the one-time capability has been exchanged, /screening is backed by
    // the HttpOnly applicant session cookie and intentionally has no URL token.
    load();
  }, [load]);

  const consentAndContinue = async () => {
    if (!disclosureAccepted || !authorizationAccepted) return;
    setBusy('consent');
    setMessage('');
    try {
      const { body, response } = await applicantScreeningApi.consent(token, {
        expectedQuoteReference: value(invitation, 'quoteReference'),
        disclosureAccepted: true,
        authorizationAccepted: true,
        disclosureVersion: value(invitation, 'disclosureVersion'),
        authorizationVersion: value(invitation, 'authorizationVersion')
      });
      const hasExchange = value(body, 'continuationUrl');
      if (hasExchange) {
        const destination = getSafeNavigationUrl(body, exchangeMetadata(response));
        navigateTopLevel(destination);
        return;
      }
      await load();
    } catch (error) {
      if ([401, 403, 410].includes(error.status)) setErrorState(screeningErrorState(error.status));
      setMessage(error.message || 'Unable to continue screening.');
    } finally {
      setBusy('');
    }
  };

  const openReportForDispute = async () => {
    setBusy('report');
    setMessage('');
    try {
      const { body, response } = await applicantScreeningApi.reportAccess(token);
      const destination = getSafeNavigationUrl(body, exchangeMetadata(response));
      navigateTopLevel(destination);
    } catch (error) {
      if ([401, 403, 410].includes(error.status)) setErrorState(screeningErrorState(error.status));
      setMessage(error.message || 'Report review is not available right now.');
    } finally {
      setBusy('');
    }
  };

  const requestReconsideration = async () => {
    if (!reconsideration.trim()) return;
    setBusy('reconsider');
    setMessage('');
    try {
      await applicantScreeningApi.reconsider(token, reconsideration.trim());
      setReconsideration('');
      await load();
    } catch (error) {
      setMessage(error.message || 'Unable to submit your request.');
    } finally {
      setBusy('');
    }
  };

  const submitDispute = async () => {
    if (!latestReportRevision || !issueCodes.length || !disputeNarrative.trim()) return;
    setBusy('dispute');
    setMessage('');
    try {
      await applicantScreeningApi.dispute(token, {
        reportRevisionId: latestReportRevision,
        issueCodes,
        narrative: disputeNarrative.trim()
      });
      setIssueCodes([]);
      setDisputeNarrative('');
      await load();
      setMessage('Your dispute was submitted and is now under review.');
    } catch (error) {
      if ([401, 403, 410].includes(error.status)) setErrorState(screeningErrorState(error.status));
      setMessage(error.message || 'Unable to submit the report dispute.');
    } finally {
      setBusy('');
    }
  };

  if (loading)
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
        <CircularProgress />
        <Typography>Loading your secure screening…</Typography>
      </Stack>
    );

  if (errorState)
    return (
      <Box sx={{ width: '100%', maxWidth: 680, mx: 'auto', py: 3 }}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2.5} alignItems="flex-start">
              <ShieldOutlined color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h4">{errorState.title}</Typography>
              <Typography color="text.secondary">
                {errorState.kind === 'expired'
                  ? 'The link may have expired or been revoked. Ask the property team for a new invitation.'
                  : 'For your privacy, we cannot provide screening details from this link.'}
              </Typography>
              {message && (
                <Alert severity="info" sx={{ width: '100%' }}>
                  {message}
                </Alert>
              )}
              <Link href="/login">Return to Property Peace</Link>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );

  const currentStatus = value(status, 'status', value(invitation, 'status'));
  const quote = value(status, 'quote') || invitation;
  const consentNeeded =
    currentStatus === 0 ||
    currentStatus === 1 ||
    String(currentStatus).toLowerCase() === 'invited' ||
    String(currentStatus).toLowerCase() === 'consentpending';
  const adverse = adverseNotice;
  const latestReportRevision = value(status, 'latestReportRevision');

  return (
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', py: { xs: 2, sm: 4 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <LockOutlined color="primary" />
            <Typography variant="overline" color="primary.main" fontWeight={700}>
              Secure applicant screening
            </Typography>
          </Stack>
          <Typography variant="h3" sx={{ mt: 0.5 }}>
            Your screening
          </Typography>
          <Typography color="text.secondary">
            Review each disclosure before continuing. Sensitive provider links are never shown on this page.
          </Typography>
        </Box>
        {message && (
          <Alert severity="warning" aria-live="polite">
            {message}
          </Alert>
        )}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                <Typography variant="h5">Current status</Typography>
                <Chip color={currentStatus === 4 ? 'success' : 'primary'} label={enumLabel(currentStatus, statusLabels)} />
              </Stack>
              <Alert severity="info">
                {value(status, 'helpText', enumLabel(value(status, 'nextAction', 'Follow the next step below.')))}
              </Alert>
              <FeeSummary quote={quote} />
              {value(status, 'supportPath') && (
                <Typography variant="body2">Need help? Follow the support instructions provided by the property team.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        {consentNeeded && (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack spacing={2.25}>
                <Box>
                  <Typography variant="h5">Disclosure and authorization</Typography>
                  <Typography color="text.secondary">
                    Please read the complete statements. Your acceptance is recorded with the displayed versions.
                  </Typography>
                </Box>
                <Box
                  sx={{ p: 2, border: 1, borderColor: 'divider', maxHeight: 240, overflow: 'auto' }}
                  tabIndex={0}
                  aria-label="Screening disclosure"
                >
                  <Typography variant="subtitle2">Disclosure · version {value(invitation, 'disclosureVersion')}</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{value(invitation, 'disclosureStatement')}</Typography>
                </Box>
                <FormControlLabel
                  control={<Checkbox checked={disclosureAccepted} onChange={(event) => setDisclosureAccepted(event.target.checked)} />}
                  label="I acknowledge that I received and read the disclosure."
                />
                <Box
                  sx={{ p: 2, border: 1, borderColor: 'divider', maxHeight: 240, overflow: 'auto' }}
                  tabIndex={0}
                  aria-label="Screening authorization"
                >
                  <Typography variant="subtitle2">Authorization · version {value(invitation, 'authorizationVersion')}</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{value(invitation, 'authorizationStatement')}</Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Checkbox checked={authorizationAccepted} onChange={(event) => setAuthorizationAccepted(event.target.checked)} />
                  }
                  label="I authorize the screening described above."
                />
                <Box sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2">Rental criteria · version {value(invitation, 'rentalCriteriaVersion')}</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{value(invitation, 'rentalCriteriaStatement')}</Typography>
                  {value(invitation, 'allowedChecks', []).length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Included checks: {value(invitation, 'allowedChecks', []).join(', ')}
                    </Typography>
                  )}
                </Box>
                <Button
                  size="large"
                  variant="contained"
                  onClick={consentAndContinue}
                  disabled={!disclosureAccepted || !authorizationAccepted || busy === 'consent'}
                >
                  {busy === 'consent' ? 'Preparing secure handoff…' : 'Consent and continue'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {!consentNeeded && (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5">Progress</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
                  {value(status, 'consentState') && <Chip label={`Consent: ${enumLabel(value(status, 'consentState'))}`} />}
                  {value(status, 'paymentState') && <Chip label={`Payment: ${enumLabel(value(status, 'paymentState'))}`} />}
                  {value(status, 'providerProcessingState') && (
                    <Chip label={`Processing: ${enumLabel(value(status, 'providerProcessingState'))}`} />
                  )}
                  {value(status, 'disputeStatus') && <Chip label={`Dispute: ${enumLabel(value(status, 'disputeStatus'))}`} />}
                  {value(status, 'correctionStatus') && <Chip label={`Correction: ${enumLabel(value(status, 'correctionStatus'))}`} />}
                </Stack>
                {latestReportRevision && (
                  <>
                    <Typography color="text.secondary">
                      A report revision is available. Open it only if you need to review the report for a dispute.
                    </Typography>
                    <Button variant="outlined" onClick={openReportForDispute} disabled={busy === 'report'}>
                      {busy === 'report' ? 'Preparing secure review…' : 'Review report for a dispute'}
                    </Button>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {!consentNeeded && latestReportRevision && (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h5">Dispute report information</Typography>
                  <Typography color="text.secondary">
                    Select every type of information you believe is inaccurate, then describe what should be investigated. Your dispute is
                    bound to the latest report revision.
                  </Typography>
                </Box>
                <Box component="fieldset" sx={{ m: 0, p: 2, border: 1, borderColor: 'divider' }}>
                  <Typography component="legend" variant="subtitle2" sx={{ px: 0.5 }}>
                    Information to investigate
                  </Typography>
                  <FormGroup>
                    {disputeIssueOptions.map(([code, label]) => (
                      <FormControlLabel
                        key={code}
                        control={
                          <Checkbox
                            checked={issueCodes.includes(code)}
                            onChange={(event) =>
                              setIssueCodes((current) =>
                                event.target.checked ? [...current, code] : current.filter((item) => item !== code)
                              )
                            }
                          />
                        }
                        label={label}
                      />
                    ))}
                  </FormGroup>
                </Box>
                <TextField
                  label="What information is inaccurate?"
                  multiline
                  minRows={4}
                  value={disputeNarrative}
                  onChange={(event) => setDisputeNarrative(event.target.value)}
                  inputProps={{ maxLength: 2000 }}
                  helperText={`${disputeNarrative.length}/2000 characters. Do not include identity documents or full account numbers.`}
                />
                <Button
                  variant="contained"
                  onClick={submitDispute}
                  disabled={!issueCodes.length || !disputeNarrative.trim() || busy === 'dispute'}
                >
                  {busy === 'dispute' ? 'Submitting dispute…' : 'Submit report dispute'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {adverse && (
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: 'warning.main' }}>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h5">Application notice</Typography>
                  <Typography color="text.secondary">
                    {enumLabel(value(adverse, 'actionType'), adverseLabels)} · delivery{' '}
                    {enumLabel(value(adverse, 'deliveryStatus'), deliveryLabels)} · reconsideration{' '}
                    {enumLabel(value(adverse, 'reconsiderationStatus', value(status, 'reconsiderationStatus')), reconsiderationLabels)}
                  </Typography>
                  {value(adverse, 'createdAt') && (
                    <Typography variant="caption" color="text.secondary">
                      Created {new Date(value(adverse, 'createdAt')).toLocaleString()}
                    </Typography>
                  )}
                </Box>
                <Alert severity="warning">
                  A decision notice was issued. Review the complete notice, rights, and support path below.
                </Alert>
                {value(adverse, 'immutableNoticeContent') && (
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider' }} aria-label="Adverse action notice">
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{value(adverse, 'immutableNoticeContent')}</Typography>
                  </Box>
                )}
                {value(adverse, 'reasonCodes', []).length > 0 && (
                  <Box>
                    <Typography variant="subtitle2">Notice reason codes</Typography>
                    <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, mb: 0 }}>
                      {value(adverse, 'reasonCodes', []).map((code) => (
                        <Typography component="li" key={code}>
                          {code}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
                {(value(adverse, 'craName') || value(adverse, 'craAddress') || value(adverse, 'craPhone')) && (
                  <Box>
                    <Typography variant="subtitle2">Consumer reporting agency</Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {[value(adverse, 'craName'), value(adverse, 'craAddress'), value(adverse, 'craPhone')].filter(Boolean).join('\n')}
                    </Typography>
                  </Box>
                )}
                {[
                  ['Decision responsibility', value(adverse, 'craDidNotDecideStatement')],
                  ['Your dispute rights', value(adverse, 'disputeRightsStatement')],
                  ['Your right to a free copy', value(adverse, 'freeCopyRightsStatement')],
                  ['Additional jurisdiction notice', value(adverse, 'jurisdictionDisclosure')]
                ]
                  .filter(([, statement]) => statement)
                  .map(([heading, statement]) => (
                    <Box key={heading}>
                      <Typography variant="subtitle2">{heading}</Typography>
                      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{statement}</Typography>
                    </Box>
                  ))}
                {value(adverse, 'supportPath') && <Link href={value(adverse, 'supportPath')}>Get help with this notice</Link>}
                <TextField
                  label="Request reconsideration"
                  multiline
                  minRows={3}
                  value={reconsideration}
                  onChange={(event) => setReconsideration(event.target.value)}
                  inputProps={{ maxLength: 1000 }}
                  helperText="Explain why you are requesting another review. Do not include account numbers or identity documents."
                />
                <Button
                  variant="contained"
                  color="warning"
                  onClick={requestReconsideration}
                  disabled={!reconsideration.trim() || busy === 'reconsider'}
                >
                  Submit reconsideration request
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
