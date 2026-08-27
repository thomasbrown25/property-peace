import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import LeaseDetailView from 'sections/landlord/leases/LeaseDetailView';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { Box, Typography, Stack, Divider, Grid, Paper, Button, Chip, IconButton, alpha, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Link, CircularProgress, useTheme, FormControl, Select, MenuItem, InputLabel, Tabs, Tab, LinearProgress, Checkbox, Tooltip, RadioGroup, Radio, FormControlLabel, Avatar } from '@mui/material';
import MainCard from 'components/MainCard';
import {
  HomeOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
  ArrowLeftOutlined,
  FileTextOutlined,
  EditOutlined,
  CloseCircleOutlined,
  MailOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  SendOutlined,
  ReloadOutlined,
  StopOutlined,
  EyeOutlined,
  UploadOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  RedoOutlined,
  PlusOutlined,
  BankOutlined,
  CloseOutlined,
  FormOutlined,
  InfoCircleOutlined,
  CloudOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  LoginOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useSelector, useDispatch } from 'react-redux';
import { selectProperties } from 'store/property/property.selector';
import { selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import { formatCurrency, formatDate, formatPhoneInput } from 'utils/formatters';
import { calculateNextPaymentDate } from 'utils/helper-methods';
import { useDrawer } from 'contexts/DrawerContext';
import useFetchProperties from 'hooks/useFetchProperties';
import LeaseAddDrawer from 'components/drawers/LeaseAddDrawer';
import LeaseEditDrawer from 'components/drawers/LeaseEditDrawer';
import RenewLeaseDrawer from 'components/drawers/RenewLeaseDrawer';
import TenantEditDrawer from 'components/drawers/TenantEditDrawer';
import TenantAddDrawer from 'components/drawers/TenantAddDrawer';
import LeaseDocumentUploadDrawer from 'components/drawers/LeaseDocumentUploadDrawer';
import { updateLease, setLease, endLease, reopenLease } from 'store/lease/lease.action';
import { setProperty, addOrUpdateProperty } from 'store/property/property.action';
import { setUnit } from 'store/unit/unit.action';
import { getTenants } from 'store/tenant/tenant.action';
import { selectLeaseTenants } from 'store/tenant/tenant.selector';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { 
  sendLeaseForSignature, 
  getLeaseSignatureStatus, 
  cancelLeaseSignature, 
  resendLeaseSignature 
} from 'store/lease/lease.action';
import useAuth from 'hooks/useAuth';
import { tenantInviteAPI } from 'api';
import { tenantDocumentAPI } from 'api';
import { bankAccountAPI } from 'api';
import axiosServices from 'utils/axios';
import useFetchPayments from 'hooks/useFetchPayments';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import useSignalRNotifications from 'hooks/useSignalRNotifications';
import { completeLeaseDraft } from 'api/lease';
import { getMoveInReportTemplate } from 'api/checklist';
import { useModal } from 'contexts/ModalContext';
import PaymentModal from 'components/drawers/PaymentModal';
import StripeConnectOnboardingDialog from 'components/dialogs/StripeConnectOnboardingDialog';
import AddTenantDialog from 'components/dialogs/AddTenantDialog';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';
import { buildLeaseMoveInReadiness, deriveExactLeaseSigners, selectCurrentSignatureStatus, validateExactLeaseSigners } from 'utils/leaseMoveIn';
import { normalizeRentBalance } from 'utils/rentBalance';

// E-Signature Status Labels
const SIGNATURE_STATUS_LABELS = {
  0: { label: 'Not Sent', color: 'default' },
  1: { label: 'Sent', color: 'info' },
  2: { label: 'In Progress', color: 'warning' },
  3: { label: 'Partially Signed', color: 'warning' },
  4: { label: 'Completed', color: 'success' },
  5: { label: 'Declined', color: 'error' },
  6: { label: 'Expired', color: 'default' },
  7: { label: 'Cancelled', color: 'default' }
};

export default function LeasePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const { leaseId } = useParams();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch, isLoading: propertiesLoading } = useFetchProperties();
  const { user } = useAuth();
  const { onLeaseSignatureUpdated } = useSignalRNotifications();
  const { presentation: eSignatureReadiness } = useFeatureReadiness(FEATURE_KEYS.eSignature);
  const { presentation: rentReadiness, canInvoke: rentCanInvoke } = useFeatureReadiness(FEATURE_KEYS.onlineRentCollection);
  
  // Get context
  const { setLeaseLoading } = useDashboardLoading();
  const theme = useTheme();
  const fetchedTenants = useSelector(selectLeaseTenants);
  const dashboardSummary = useSelector(selectDashboardSummary);
  const [endLeaseConfirmOpen, setEndLeaseConfirmOpen] = useState(false);
  const [reopenLeaseConfirmOpen, setReopenLeaseConfirmOpen] = useState(false);
  const [sendSignatureDialogOpen, setSendSignatureDialogOpen] = useState(false);
  const [embeddedSigningOpen, setEmbeddedSigningOpen] = useState(false);
  const [signatureForm, setSignatureForm] = useState({
    landlordEmail: '',
    landlordName: '',
    expirationDays: 30,
    requireAllSigners: true
  });
  const [signatureStatusRecord, setSignatureStatusRecord] = useState(null);
  const signatureStatusRequestRef = useRef(0);
  const [loadingSignatureStatus, setLoadingSignatureStatus] = useState(false);
  const [landlordSigningUrl, setLandlordSigningUrl] = useState(null);
  const [sendingInvite, setSendingInvite] = useState({});
  const [leaseAgreement, setLeaseAgreement] = useState(null);
  const [loadingLeaseAgreement, setLoadingLeaseAgreement] = useState(false);
  const [agreementNotFound, setAgreementNotFound] = useState(false); // Track if we've confirmed agreement doesn't exist
  const [signingIssueModalOpen, setSigningIssueModalOpen] = useState(false);
  const [syncingSignature, setSyncingSignature] = useState(false);
  const [sendingLeaseForSignature, setSendingLeaseForSignature] = useState(false);
  const [documentUploadDrawerOpen, setDocumentUploadDrawerOpen] = useState(false);
  const [leaseDocuments, setLeaseDocuments] = useState([]);
  const [loadingLeaseDocuments, setLoadingLeaseDocuments] = useState(false);
  const prevTenantEditDrawerOpen = useRef(drawer.isOpenTenantEdit);
  const prevTenantAddDrawerOpen = useRef(drawer.isOpenTenantAdd);
  const loadedForLeaseIdRef = useRef(null); // Track if we've loaded agreement/instances for this lease ID

  // Refresh properties when tenant drawer closes (to get updated tenant list)
  useEffect(() => {
    if (prevTenantAddDrawerOpen.current && !drawer.isOpenTenantAdd) {
      // Tenant drawer was just closed - refresh to get updated tenant list
      propertiesRefetch();
    }
    prevTenantAddDrawerOpen.current = drawer.isOpenTenantAdd;
  }, [drawer.isOpenTenantAdd, propertiesRefetch]);

  // Handle DocuSign postMessage events (when signing completes)
  const handleDocuSignMessage = useCallback((event) => {
    // DocuSign sends messages when signing is complete
    // The event.data will contain information about the signing status
    if (event.data && typeof event.data === 'string') {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'signing_complete' || data.event === 'ds-signing-complete') {
          // Signing completed - refresh lease data
          openSnackbar({
            open: true,
            message: 'Lease signed successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
          setEmbeddedSigningOpen(false);
          propertiesRefetch();
        }
      } catch (e) {
        // Not a JSON message, ignore
      }
    }
  }, [propertiesRefetch]);

  // Cleanup message listener
  useEffect(() => {
    if (embeddedSigningOpen) {
      window.addEventListener('message', handleDocuSignMessage);
      return () => {
        window.removeEventListener('message', handleDocuSignMessage);
      };
    }
  }, [embeddedSigningOpen, handleDocuSignMessage]);

  // Real-time DocuSign Connect: when backend pushes LeaseSignatureUpdated, refetch and close embedded signing if this is the current lease
  useEffect(() => {
    if (!leaseId) return;
    const unregister = onLeaseSignatureUpdated((payload) => {
      const id = payload?.leaseId ?? payload?.LeaseId;
      if (id != null && String(id) === String(leaseId)) {
        propertiesRefetch();
        setEmbeddedSigningOpen(false);
      }
    });
    return () => unregister();
  }, [leaseId, onLeaseSignatureUpdated, propertiesRefetch]);

  // Check if error is DocuSign polling limit exceeded
  // Note: axios interceptor rejects with error.response.data directly, not the full error object
  // API returns: { message, errors: { message, details, innerException } }
  // DocuSign uses HOURLY_ENVELOPE_POLLING_LIMIT_EXCEEDED or BURST_ENVELOPE_POLLING_LIMIT_EXCEEDED
  const isDocuSignPollingLimitError = useCallback((error) => {
    try {
      // error may be error.response.data (from interceptor) or full axios error
      const data = error?.response?.data ?? error ?? {};
      const message = data.message ?? error?.message ?? '';
      const errorsDetails = data.errors?.details ?? data.errors?.Details ?? '';
      const errorsMessage = data.errors?.message ?? data.errors?.Message ?? '';
      const searchText = `${message} ${errorsDetails} ${errorsMessage} ${JSON.stringify(data)}`.toUpperCase();
      return searchText.includes('HOURLY_ENVELOPE_POLLING_LIMIT') || searchText.includes('BURST_ENVELOPE_POLLING_LIMIT') || searchText.includes('POLLING_LIMIT_EXCEEDED');
    } catch {
      return false;
    }
  }, []);

  // Real-time updates: DocuSign Connect webhook + SignalR LeaseSignatureUpdated (no polling)

  // ✅ FIXED: properly flatten properties with their units
  const lease = properties
    ?.flatMap((p) =>
      (p.units || [])
        .filter((u) => u.lease)
        .map((u) => ({
          ...u.lease,
          unit: u,
          propertyName: p.name
        }))
    )
    ?.find((l) => l?.id?.toString() === leaseId);

  const signatureLeaseId = lease?.id ?? lease?.Id ?? null;
  const signatureEnvelopeId =
    lease?.leaseAgreement?.docuSignEnvelopeId ??
    lease?.LeaseAgreement?.DocuSignEnvelopeId ??
    lease?.docuSignEnvelopeId ??
    lease?.DocuSignEnvelopeId ??
    leaseAgreement?.docuSignEnvelopeId ??
    leaseAgreement?.DocuSignEnvelopeId ??
    null;
  const signatureStatus = selectCurrentSignatureStatus(
    signatureStatusRecord,
    signatureLeaseId,
    signatureEnvelopeId
  );

  // Check if lease hasn't started (startDate is in the future)
  const isNotStarted = useMemo(() => {
    if (!lease?.startDate) return false;
    const startDate = new Date(lease.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    return startDate > today;
  }, [lease?.startDate]);

  // Fetch payments for this lease - MUST be called before any early returns (Rules of Hooks)
  const { payments: fetchedPayments, refetch: refetchPayments } = useFetchPayments(lease?.id);

  // Fetch rent collection data to get current due (including overdue) - MUST be called before any early returns (Rules of Hooks)
  const { rentRecords, refetch: refetchRentCollection, loading: rentCollectionLoading } = useFetchRentCollection(null, true);

  // Fetch deposits for this lease - MUST be called before any early returns (Rules of Hooks)
  const [deposits, setDeposits] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);
  const modal = useModal();
  
  // Comprehensive loading state - tracks when ALL lease page components are loaded
  // This combines all individual component loading states
  const isLeasePageLoading = useMemo(() => {
    return (
      propertiesLoading ||
      rentCollectionLoading ||
      loadingDeposits ||
      loadingLeaseAgreement
    );
  }, [
    propertiesLoading,
    rentCollectionLoading,
    loadingDeposits,
    loadingLeaseAgreement
  ]);
  
  // Update the context whenever the lease page loading state changes
  useEffect(() => {
    setLeaseLoading(isLeasePageLoading);
  }, [isLeasePageLoading, setLeaseLoading]);
  
  // Fetch deposits when lease changes
  useEffect(() => {
    const fetchDeposits = async () => {
      if (!lease?.id) {
        setDeposits([]);
        return;
      }
      
      setLoadingDeposits(true);
      try {
        const response = await axiosServices.get(`/api/deposit/lease/${lease.id}`);
        if (response.data && response.data.success) {
          setDeposits(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching deposits:', error);
        setDeposits([]);
      } finally {
        setLoadingDeposits(false);
      }
    };
    
    fetchDeposits();
  }, [lease?.id]);
  
  // Track tenant invites to show status
  const [tenantInvites, setTenantInvites] = useState({});
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Fetch operating account for the property - MUST be called before any early returns (Rules of Hooks)
  const [operatingAccount, setOperatingAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [bankingModalOpen, setBankingModalOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [savingBankAccount, setSavingBankAccount] = useState(false);
  const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);

  // Fetch tenants by leaseId when lease changes
  useEffect(() => {
    if (lease?.id) {
      dispatch(getTenants(lease.id));
    }
  }, [lease?.id, dispatch]);

  // 🧮 Derived values (computed before early return for use in hooks)
  // Only show tenants that are assigned to this lease's unit (tenant.unitId === lease.unitId).
  // Org-only tenants (unitId null) must not appear on any lease.
  const tenants = useMemo(() => {
    const leaseUnitId = lease?.unitId ?? lease?.UnitId;
    const rawLeaseTenants = lease?.tenants || lease?.Tenants || [];
    const rawFetched = (fetchedTenants && fetchedTenants.length > 0 && lease?.id)
      ? fetchedTenants.filter(t => {
          const tenantLeaseId = t.leaseId || t.LeaseId;
          return tenantLeaseId === lease.id || tenantLeaseId === lease.Id;
        })
      : [];
    const combined = rawLeaseTenants.length > 0 ? rawLeaseTenants : rawFetched;
    if (!combined.length) return [];
    if (leaseUnitId == null) return combined;
    return combined.filter(t => (t.unitId ?? t.UnitId) === leaseUnitId);
  }, [fetchedTenants, lease?.tenants, lease?.Tenants, lease?.id, lease?.Id, lease?.unitId, lease?.UnitId]);

  // Exact signer identities are a read-only projection of current lease tenants.
  const exactTenantSigners = useMemo(() => deriveExactLeaseSigners(tenants), [tenants]);
  const exactTenantSignerValidation = useMemo(
    () => validateExactLeaseSigners(exactTenantSigners),
    [exactTenantSigners]
  );
  const landlordHasSigned = Boolean(
    lease?.leaseAgreement?.landlordSignedAt ??
    lease?.LeaseAgreement?.LandlordSignedAt ??
    lease?.landlordSignedAt ??
    lease?.LandlordSignedAt
  );

  // Define functions using useCallback - MUST be called before any early returns (Rules of Hooks)
  const loadLeaseAgreement = useCallback(async () => {
    if (!lease?.id) return;
    
    setLoadingLeaseAgreement(true);
    try {
      const response = await tenantDocumentAPI.getLeaseAgreement(lease.id);
      const responseSuccess = response?.success ?? response?.Success;
      const agreementData = response?.data ?? response?.Data;
      const hasAgreementFile = !!(
        agreementData?.blobUrl ||
        agreementData?.BlobUrl ||
        agreementData?.blobName ||
        agreementData?.BlobName
      );

      if (responseSuccess && agreementData && hasAgreementFile) {
        setLeaseAgreement(agreementData);
        setAgreementNotFound(false); // Reset flag if we found it
      } else {
        setLeaseAgreement(null);
        // Mark as not found if we get a clear "not found" response or a successful empty document response
        const responseMessage = response?.message ?? response?.Message ?? '';
        if (!hasAgreementFile ||
            responseMessage.toLowerCase().includes('not found') ||
            responseMessage.toLowerCase().includes('does not exist')) {
          setAgreementNotFound(true);
        }
      }
    } catch (error) {
      // Check if error is a 404 - this is expected when agreement doesn't exist yet
      const status = error?.response?.status;
      if (status === 404) {
        // Mark as not found to prevent retries
        setAgreementNotFound(true);
        // Log 404 as warning, not error (it's expected)
        console.warn('Lease agreement not found (404):', error);
      } else if (status === 400 || status === 403) {
        // Mark as not found for 400/403 as well
        setAgreementNotFound(true);
      } else {
        // Only log non-404 errors as errors
        console.error('Error loading lease agreement:', error);
      }
      setLeaseAgreement(null);
    } finally {
      setLoadingLeaseAgreement(false);
    }
  }, [lease?.id]);

  const loadLeaseDocuments = useCallback(async () => {
    if (!lease?.id) return;
    setLoadingLeaseDocuments(true);
    try {
      const res = await tenantDocumentAPI.getTenantDocumentsByLease(lease.id);
      if (res?.success && res?.data) {
        setLeaseDocuments(Array.isArray(res.data) ? res.data : res.data.data || []);
      }
    } catch (err) {
      console.error('Error loading lease documents:', err);
      setLeaseDocuments([]);
    } finally {
      setLoadingLeaseDocuments(false);
    }
  }, [lease?.id]);

  const loadSignatureStatus = useCallback(async () => {
    const requestedLeaseId = signatureLeaseId;
    const requestedEnvelopeId = signatureEnvelopeId;
    const requestVersion = ++signatureStatusRequestRef.current;

    setSignatureStatusRecord(null);
    if (!requestedLeaseId || !requestedEnvelopeId) {
      setLoadingSignatureStatus(false);
      return;
    }

    setLoadingSignatureStatus(true);
    try {
      const result = await dispatch(getLeaseSignatureStatus(requestedLeaseId));
      if (signatureStatusRequestRef.current !== requestVersion) return;
      if (result.success) {
        setSignatureStatusRecord({
          leaseId: requestedLeaseId,
          envelopeId: requestedEnvelopeId,
          data: result.data
        });
      } else {
        setSignatureStatusRecord(null);
      }
    } catch (error) {
      if (signatureStatusRequestRef.current === requestVersion) {
        setSignatureStatusRecord(null);
      }
      console.error('Error loading signature status:', error);
    } finally {
      if (signatureStatusRequestRef.current === requestVersion) {
        setLoadingSignatureStatus(false);
      }
    }
  }, [dispatch, signatureEnvelopeId, signatureLeaseId]);

  // Calculate next payment date - MUST be called before any early returns (Rules of Hooks)
  // If lease hasn't started, use the start date as the rent due date
  const nextPaymentDate = useMemo(() => {
    if (!lease?.startDate) return null;
    
    // If lease hasn't started, return the start date
    if (isNotStarted) {
      return new Date(lease.startDate);
    }
    
    // Otherwise, calculate the next payment date normally
    if (!lease?.rentDueDay) return null;
    return calculateNextPaymentDate(lease.startDate, lease.rentDueDay, lease.endDate);
  }, [lease?.rentDueDay, lease?.startDate, lease?.endDate, isNotStarted]);
  
  // Initialize landlord identity. Tenant signer identity is derived read-only above.
  useEffect(() => {
    const landlordEmail = user?.email || '';
    const landlordName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email || '';
    setSignatureForm(prev => ({ ...prev, landlordEmail, landlordName }));
  }, [user?.email, user?.firstName, user?.lastName]);

  // Load signature status - MUST be called before any early returns (Rules of Hooks)
  useEffect(() => {
    if (signatureLeaseId && signatureEnvelopeId) {
      loadSignatureStatus();
    } else {
      signatureStatusRequestRef.current += 1;
      setSignatureStatusRecord(null);
      setLoadingSignatureStatus(false);
    }
  }, [loadSignatureStatus, signatureEnvelopeId, signatureLeaseId]);

  // Track if we've handled the fromLeaseBuilder flag to prevent infinite loops
  const hasHandledLeaseBuilderRef = useRef(false);
  
  // Refresh properties when navigating from lease builder (indicated by state)
  useEffect(() => {
    if (location.state?.fromLeaseBuilder && !hasHandledLeaseBuilderRef.current) {
      hasHandledLeaseBuilderRef.current = true;
      propertiesRefetch();
      // Clear the state so it doesn't refresh on every render
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.fromLeaseBuilder, propertiesRefetch]);

  // Load lease agreement - ONLY called once when lease ID changes
  useEffect(() => {
    if (lease?.id && loadedForLeaseIdRef.current !== lease.id) {
      // Reset flag when lease ID changes (new lease loaded)
      setAgreementNotFound(false);
      loadedForLeaseIdRef.current = lease.id;
      
      // Only call once per lease ID
      loadLeaseAgreement();
      loadLeaseDocuments();
    }
  }, [lease?.id, loadLeaseAgreement, loadLeaseDocuments]);
  
  // Handle special case: reload when coming from lease builder (agreement might have been created)
  useEffect(() => {
    if (location.state?.fromLeaseBuilder && lease?.id && loadedForLeaseIdRef.current === lease.id) {
      // Reset flag and reload since agreement might have been created
      setAgreementNotFound(false);
      loadLeaseAgreement();
      // Clear the state so it doesn't reload on every render
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.fromLeaseBuilder, lease?.id, loadLeaseAgreement]);

  // Refetch properties when tenant edit drawer closes - MUST be called before any early returns (Rules of Hooks)
  useEffect(() => {
    // If drawer was open and is now closed, refetch properties
    if (prevTenantEditDrawerOpen.current && !drawer.isOpenTenantEdit) {
      propertiesRefetch();
    }
    prevTenantEditDrawerOpen.current = drawer.isOpenTenantEdit;
  }, [drawer.isOpenTenantEdit, propertiesRefetch]);

  // Track previous embedded signing state to detect when window closes
  const prevEmbeddedSigningOpen = useRef(embeddedSigningOpen);
  
  // Sync signature status when embedded signing window closes
  useEffect(() => {
    // If embedded signing was open and is now closed, sync signature status
    if (prevEmbeddedSigningOpen.current && !embeddedSigningOpen && lease?.id && (lease?.leaseAgreement?.docuSignEnvelopeId ?? lease?.docuSignEnvelopeId)) {
      const syncOnClose = async () => {
        try {
          await axiosServices.post(`/api/lease/${lease.id}/sync-signature-status`);
          await propertiesRefetch();
          // The useEffect watching lease changes will automatically reload the lease agreement
          // Check if signature was detected after sync
          // The propertiesRefetch will update the lease data, and we'll show a message if signed
        } catch (error) {
          if (isDocuSignPollingLimitError(error)) {
            setSigningIssueModalOpen(true);
          } else {
            console.error('Error syncing signature status on close:', error);
          }
          // Still refetch to get latest data
          propertiesRefetch();
        }
      };
      syncOnClose();
    }
    prevEmbeddedSigningOpen.current = embeddedSigningOpen;
  }, [embeddedSigningOpen, lease?.id, lease?.docuSignEnvelopeId, propertiesRefetch, isDocuSignPollingLimitError]);

  // Watch for lease signing completion and close modal
  useEffect(() => {
    if (embeddedSigningOpen && (lease?.leaseAgreement?.landlordSignedAt ?? landlordHasSigned)) {
      // Signing completed!
      setEmbeddedSigningOpen(false);
      openSnackbar({
        open: true,
        message: 'Lease signed successfully!',
        variant: 'alert',
        alert: { color: 'success' }
      });
    }
  }, [landlordHasSigned, embeddedSigningOpen]);

  // Check for sign=true query parameter (auto-trigger signing flow)
  const hasHandledSignParam = useRef(false);
  useEffect(() => {
    if (searchParams.get('sign') === 'true' && lease?.id && !hasHandledSignParam.current && !(lease?.leaseAgreement?.landlordSignedAt ?? landlordHasSigned)) {
      hasHandledSignParam.current = true;
      
      // Remove the query parameter
      setSearchParams({});
      
      // Auto-trigger signing flow
      if (!user?.email) {
        openSnackbar({
          open: true,
          message: 'Please log in with an email address to sign the lease.',
          variant: 'alert',
          alert: { color: 'error' }
        });
        return;
      }

      // Use user's email directly and create envelope
      const landlordName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user?.email || '';

      const triggerSigning = async () => {
        try {
          // Show loading state
          setEmbeddedSigningOpen(true); // Open modal first to show loading
          
          const response = await axiosServices.post(`/api/lease/${lease.id}/sign-landlord`, {
            leaseId: lease.id,
            landlordEmail: user.email,
            landlordName: landlordName,
            tenantSigners: [],
            useEmbeddedSigning: true
          });

          if (response.data.success) {
            if (response.data.data?.embeddedSigningUrl) {
              // Success! We have the embedded signing URL (Connect + SignalR will push updates when signing completes)
              setLandlordSigningUrl(response.data.data.embeddedSigningUrl);
            } else {
              // No embedded URL - this should not happen when useEmbeddedSigning is true
              setEmbeddedSigningOpen(false);
              openSnackbar({
                open: true,
                message: 'Failed to generate embedded signing interface. Please try again or contact support.',
                variant: 'alert',
                alert: { color: 'error' }
              });
              console.error('Embedded signing URL not returned:', response.data);
            }
          } else {
            // API returned an error
            setEmbeddedSigningOpen(false);
            openSnackbar({
              open: true,
              message: response.data.message || 'Failed to create signing session. Please try again.',
              variant: 'alert',
              alert: { color: 'error' }
            });
            console.error('Sign landlord API error:', response.data);
          }
        } catch (error) {
          console.error('Error creating signing session:', error);
          setEmbeddedSigningOpen(false);
          openSnackbar({
            open: true,
            message: error?.response?.data?.message || 'Failed to create signing session. Please try again.',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      };

      // Small delay to ensure lease data is loaded
      setTimeout(() => {
        triggerSigning();
      }, 500);
    }
  }, [searchParams, lease?.id, landlordHasSigned, user, setSearchParams]);

  // Check for signed=true query parameter (when DocuSign redirects back)
  useEffect(() => {
    if (searchParams.get('signed') === 'true' && lease?.id) {
      // DocuSign redirected back - signing is complete
      setEmbeddedSigningOpen(false);
      setSearchParams({}); // Remove the query parameter
      
      // Sync signature status from DocuSign to update landlordSignedAt
      const syncSignatureStatus = async () => {
        try {
          await axiosServices.post(`/api/lease/${lease.id}/sync-signature-status`);
          // Refresh lease data after syncing
          await propertiesRefetch();
          openSnackbar({
            open: true,
            message: 'Lease signed successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
        } catch (error) {
          if (isDocuSignPollingLimitError(error)) {
            setSigningIssueModalOpen(true);
          } else {
            console.error('Error syncing signature status:', error);
          }
          // Still refresh even if sync fails
          propertiesRefetch();
          openSnackbar({
            open: true,
            message: 'Lease signed successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
        }
      };
      
      syncSignatureStatus();
    }
  }, [searchParams, setSearchParams, propertiesRefetch, lease?.id, isDocuSignPollingLimitError]);

  // Fetch deposits for this lease - MUST be called before any early returns (Rules of Hooks)
  useEffect(() => {
    const fetchDeposits = async () => {
      if (!leaseId) return;
      setLoadingDeposits(true);
      try {
        const response = await axiosServices.get(`/api/deposit/lease/${leaseId}`);
        if (response.data && response.data.success) {
          setDeposits(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching deposits:', error);
        setDeposits([]);
      } finally {
        setLoadingDeposits(false);
      }
    };
    fetchDeposits();
  }, [leaseId, propertiesRefetch]);

  // Stable key: only re-fetch when lease or actual tenant IDs change (not on array reference change)
  const tenantIdsKey = useMemo(() => {
    if (!tenants || tenants.length === 0) return '';
    return tenants
      .map((t) => t.id || t.Id)
      .filter(Boolean)
      .sort((a, b) => a - b)
      .join(',');
  }, [tenants]);

  // Fetch tenant invites to show status - keyed by tenant IDs to avoid refetch on every properties update
  useEffect(() => {
    if (!tenantIdsKey) {
      setTenantInvites({});
      return;
    }
    const tenantIds = tenantIdsKey.split(',').map(Number);
    const fetchTenantInvites = async () => {
      setLoadingInvites(true);
      try {
        const inviteMap = {};
        await Promise.all(
          tenantIds.map(async (tenantId) => {
            try {
              const response = await tenantInviteAPI.getInvitesByTenantId(tenantId);
              if (response.success && response.data && response.data.length > 0) {
                const validInvite = response.data.find(
                  (inv) => !inv.isUsed && new Date(inv.expiresAt) > new Date()
                );
                if (validInvite) {
                  inviteMap[tenantId] = true;
                }
              }
            } catch (error) {
              console.error(`Error fetching invites for tenant ${tenantId}:`, error);
            }
          })
        );
        setTenantInvites(inviteMap);
      } catch (error) {
        console.error('Error fetching tenant invites:', error);
      } finally {
        setLoadingInvites(false);
      }
    };
    fetchTenantInvites();
  }, [tenantIdsKey]);

  // Helper function to extract only the street address (without city, state, zip)
  const getStreetAddressOnly = (fullAddress) => {
    if (!fullAddress) return '';
    let streetOnly = fullAddress.trim();
    // Split on comma and take the first part (street address)
    if (streetOnly.includes(',')) {
      streetOnly = streetOnly.split(',')[0].trim();
    }
    return streetOnly;
  };

  // 🧮 Derived values (for rendering) - MUST be before early return (Rules of Hooks)
  // Get property ID for navigation - try unit.propertyId first, then find by name
  // MUST be called before early return to maintain hook order
  const propertyId = useMemo(() => {
    if (lease?.unit?.propertyId) {
      return lease.unit.propertyId;
    }
    // Fallback: find property by name from lease
    if (lease?.propertyName) {
      const foundProperty = properties?.find(p => p.name === lease.propertyName);
      return foundProperty?.id;
    }
    return null;
  }, [lease?.unit?.propertyId, lease?.propertyName, properties]);

  // Get property object
  const property = useMemo(() => {
    if (!propertyId || !properties) return null;
    return properties.find(p => p.id === propertyId);
  }, [propertyId, properties]);

  // Get property name or cleaned street address
  const propertyNameOrAddress = useMemo(() => {
    if (property?.name?.trim()) {
      return property.name.trim();
    }
    if (property?.streetAddress) {
      return getStreetAddressOnly(property.streetAddress);
    }
    if (lease?.propertyName?.trim()) {
      return lease.propertyName.trim();
    }
    return 'Property';
  }, [property, lease?.propertyName]);

  // Check if property type is single unit type
  const isSingleUnitType = useMemo(() => {
    const propertyType = property?.propertyType || lease?.propertyType || lease?.PropertyType || '';
    const normalizedType = propertyType?.toLowerCase() || '';
    return ['singlefamily', 'townhouse', 'condominium'].includes(normalizedType);
  }, [property?.propertyType, lease?.propertyType, lease?.PropertyType]);

  // Build the header display text
  const headerDisplay = useMemo(() => {
    if (isSingleUnitType) {
      return propertyNameOrAddress;
    }
    const unitDisplay = lease?.unit?.name || 'Unit';
    return `${propertyNameOrAddress} – ${unitDisplay}`;
  }, [isSingleUnitType, propertyNameOrAddress, lease?.unit?.name]);

  const propertyDisplay = propertyNameOrAddress;
  const unitDisplay = isSingleUnitType ? null : (lease?.unit?.name || 'Unit');

  // Fetch operating account details for the lease (bank account is on the lease, not the property)
  useEffect(() => {
    const fetchOperatingAccount = async () => {
      const accountId = lease?.operatingAccountId ?? lease?.OperatingAccountId;
      if (accountId) {
        setLoadingAccount(true);
        try {
          const response = await bankAccountAPI.getBankAccount(accountId);
          if (response.success && response.data) {
            setOperatingAccount(response.data);
          }
        } catch (error) {
          console.error('Error fetching operating account:', error);
          setOperatingAccount(null);
        } finally {
          setLoadingAccount(false);
        }
      } else {
        setOperatingAccount(null);
      }
    };

    fetchOperatingAccount();
  }, [lease?.operatingAccountId, lease?.OperatingAccountId]);

  // Fetch bank accounts when modal opens
  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (bankingModalOpen) {
        setLoadingBankAccounts(true);
        try {
          const response = await bankAccountAPI.getBankAccounts();
          if (response.success && response.data) {
            setBankAccounts(response.data || []);
            setSelectedAccountId(lease?.operatingAccountId ?? lease?.OperatingAccountId ?? null);
          }
        } catch (error) {
          console.error('Error fetching bank accounts:', error);
          openSnackbar({
            open: true,
            message: 'Failed to load bank accounts',
            variant: 'alert',
            alert: { color: 'error' }
          });
        } finally {
          setLoadingBankAccounts(false);
        }
      }
    };

    fetchBankAccounts();
  }, [bankingModalOpen, lease?.operatingAccountId, lease?.OperatingAccountId]);

  // Handle saving bank account selection (operating account is on the lease)
  const handleSaveBankAccount = async () => {
    if (!lease?.id && !lease?.Id) return;

    setSavingBankAccount(true);
    try {
      const updatePayload = {
        id: lease?.id ?? lease?.Id,
        propertyId: property?.id ?? lease?.propertyId ?? lease?.PropertyId,
        unitId: lease?.unit?.id ?? lease?.unit?.Id ?? lease?.unitId ?? lease?.UnitId,
        name: lease?.name ?? lease?.Name,
        startDate: lease?.startDate ?? lease?.StartDate,
        endDate: lease?.endDate ?? lease?.EndDate,
        rentAmount: lease?.rentAmount ?? lease?.RentAmount,
        depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
        operatingAccountId: selectedAccountId || null
      };

      const result = await dispatch(updateLease(updatePayload));
      if (result?.success) {
        openSnackbar({
          open: true,
          message: 'Banking information updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setBankingModalOpen(false);
        propertiesRefetch(); // Refresh so lease has updated operatingAccountId
      } else {
        openSnackbar({
          open: true,
          message: result?.message || 'Failed to update banking information',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error updating banking information:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to update banking information',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSavingBankAccount(false);
    }
  };

  // Handler for when Stripe onboarding completes
  const handleStripeOnboardingComplete = async () => {
    if (!rentCanInvoke) return;
    // Close the Stripe onboarding dialog
    setShowStripeOnboarding(false);
    
    // Wait a moment for Stripe to process, then sync bank account
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Sync bank account with backend
      await axiosServices.post('/api/stripe/sync-bank-account');
    } catch (error) {
      console.error('Error syncing bank account:', error);
    }
    
    // Wait a bit more, then refresh bank accounts list
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const response = await bankAccountAPI.getBankAccounts();
      if (response.success && response.data) {
        setBankAccounts(response.data || []);
        // Auto-select the most recently created account
        if (response.data.length > 0) {
          const newestAccount = response.data[0];
          setSelectedAccountId(newestAccount.id);
        }
      }
    } catch (error) {
      console.error('Error refreshing bank accounts after onboarding:', error);
    }
  };

  const handleOpenStripeOnboarding = () => {
    if (!rentCanInvoke) return;
    setShowStripeOnboarding(true);
  };

  // Calculate rent record and deposit status - MUST be called before any early returns (Rules of Hooks)
  const rentRecord = useMemo(() => {
    if (!rentRecords || !leaseId) return null;
    return rentRecords.find((r) => r.leaseId === parseInt(leaseId));
  }, [rentRecords, leaseId]);

  // Calculate deposit remaining balance - MUST be called before any early returns (Rules of Hooks)
  const depositRemaining = useMemo(() => {
    if (!lease?.depositAmount || lease.depositAmount === 0) return 0;
    if (loadingDeposits) return lease.depositAmount; // Return original amount while loading
    if (!deposits || deposits.length === 0) return lease.depositAmount;
    
    // Sum all deposits that haven't been refunded
    const paidAmount = deposits
      .filter(d => d.receivedDate && !d.refundedDate)
      .reduce((sum, d) => sum + (d.amount || 0), 0);
    
    const remaining = lease.depositAmount - paidAmount;
    return Math.max(0, remaining); // Don't show negative
  }, [deposits, lease?.depositAmount, loadingDeposits]);

  // Check if deposit has been fully paid
  const depositPaid = useMemo(() => {
    return depositRemaining <= 0;
  }, [depositRemaining]);

  // Canonical collection balance; lease.balanceDue is the property/lease fallback.
  const balanceDue = useMemo(() => {
    if (rentRecord) return normalizeRentBalance(rentRecord).rentDue;
    return lease?.balanceDue || 0;
  }, [rentRecord, lease?.balanceDue]);

  // Check if lease is overdue - MUST be called before any early returns (Rules of Hooks)
  const isOverdue = useMemo(() => {
    if (rentRecord) return normalizeRentBalance(rentRecord).rentDueIsOverdue;
    return false;
  }, [rentRecord]);

  const [moveInReportTemplateDate, setMoveInReportTemplateDate] = useState(null);
  const [hasMoveInReportTemplate, setHasMoveInReportTemplate] = useState(false);
  useEffect(() => {
    if (!lease?.id) return;
    let cancelled = false;
    getMoveInReportTemplate()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res?.data) {
          setHasMoveInReportTemplate(true);
          const d = res.data.updatedAt || res.data.createdAt;
          if (d) setMoveInReportTemplateDate(d);
        } else {
          setHasMoveInReportTemplate(false);
          setMoveInReportTemplateDate(null);
        }
      })
      .catch(() => {
        if (!cancelled) setHasMoveInReportTemplate(false);
      });
    return () => { cancelled = true; };
  }, [lease?.id, searchParams.get('tab')]);

  // Authoritative readiness is shared with the rendered move-in card.
  // Checklist records are not loaded on this page, so checklist status stays unavailable.
  const moveInReadiness = useMemo(() => buildLeaseMoveInReadiness({
    lease,
    tenants,
    leaseAgreement,
    rentRecord,
    property,
    signatureStatus
  }), [lease, tenants, leaseAgreement, rentRecord, property, signatureStatus]);

  // A lease is a draft only when the persisted draft flag says so, or when
  // required lease terms are genuinely missing. Signature state is a separate
  // concern: a valid lease can exist without having been sent for signature.
  const isDraftLease = useMemo(() => {
    if (!lease) return false;

    const isDrafted =
      lease.leaseAgreement?.isDrafted ??
      lease.LeaseAgreement?.IsDrafted ??
      lease.isDrafted ??
      lease.IsDrafted ??
      false;
    if (isDrafted === true || isDrafted === 1) return true;

    const hasStartDate = Boolean(lease.startDate ?? lease.StartDate);
    const hasEndDate = Boolean(lease.endDate ?? lease.EndDate);
    const rentAmount = Number(lease.rentAmount ?? lease.RentAmount ?? 0);
    return !hasStartDate || !hasEndDate || rentAmount <= 0;
  }, [lease]);

  // Preserve the existing draft-recovery contract. Move-in/signature readiness is
  // displayed separately and must not strand a valid draft when e-sign is unavailable.
  const allSetupStepsComplete = useMemo(() => {
    const hasTenants = tenants.length > 0;
    const signatureState = lease?.leaseAgreement?.signatureStatus ?? lease?.signatureStatus ?? lease?.SignatureStatus;
    const hasAgreement = signatureState === 4 || Boolean(leaseAgreement);
    const rentAmount = Number(rentRecord?.rentAmount ?? lease?.rentAmount ?? lease?.RentAmount ?? 0);
    const collectionByPlatform = lease?.rentCollectionByPlatform ?? lease?.RentCollectionByPlatform;
    const operatingAccountId = lease?.operatingAccountId ?? lease?.OperatingAccountId ?? property?.operatingAccountId ?? property?.OperatingAccountId;
    const hasRentSetup = rentAmount > 0 && (
      collectionByPlatform === false ||
      (collectionByPlatform === true && Boolean(operatingAccountId))
    );
    const hasConditionReport = Boolean(lease?.moveInReportTemplateCompletedAt ?? lease?.MoveInReportTemplateCompletedAt);
    return hasTenants && hasAgreement && hasRentSetup && hasConditionReport;
  }, [lease, leaseAgreement, property, rentRecord, tenants]);
  const isDraftedByFlag =
    lease?.leaseAgreement?.isDrafted === true ||
    lease?.LeaseAgreement?.IsDrafted === true ||
    lease?.isDrafted === true ||
    lease?.IsDrafted === true ||
    lease?.isDrafted === 1 ||
    lease?.IsDrafted === 1;
  const completedDraftForLeaseRef = useRef(null);
  useEffect(() => {
    if (!lease?.id || !isDraftedByFlag || !allSetupStepsComplete) return;
    if (completedDraftForLeaseRef.current === lease.id) return;
    completedDraftForLeaseRef.current = lease.id;
    completeLeaseDraft(lease.id)
      .then(() => propertiesRefetch())
      .catch(() => { completedDraftForLeaseRef.current = null; });
  }, [lease?.id, isDraftedByFlag, allSetupStepsComplete, propertiesRefetch]);

  // Draft lease tab state - MUST be called before any early returns (Rules of Hooks)
  const [draftTab, setDraftTab] = useState(0);
  const [addTenantDialogOpen, setAddTenantDialogOpen] = useState(false);
  
  // Regular lease tab state - MUST be called before any early returns (Rules of Hooks)
  const [leaseTab, setLeaseTab] = useState(0);

  const handleLeaseTabChange = (e, newValue) => {
    setLeaseTab(newValue);
  };

  const [sendMoveInReportModalOpen, setSendMoveInReportModalOpen] = useState(false);
  const [sendMoveInReportWho, setSendMoveInReportWho] = useState('tenants');
  const [sendMoveInReportTenantIds, setSendMoveInReportTenantIds] = useState([]);
  const [sendMoveInReportDueDate, setSendMoveInReportDueDate] = useState('');
  const [sendMoveInReportAutoComplete, setSendMoveInReportAutoComplete] = useState(false);
  const [sendMoveInReportNote, setSendMoveInReportNote] = useState('');
  const NOTE_MAX_LENGTH = 1000;

  const handleSendMoveInReportOpen = () => {
    setSendMoveInReportTenantIds(tenants.map((t) => t.id ?? t.Id).filter(Boolean));
    setSendMoveInReportModalOpen(true);
  };
  const handleSendMoveInReportClose = () => {
    setSendMoveInReportModalOpen(false);
    setSendMoveInReportDueDate('');
    setSendMoveInReportNote('');
    setSendMoveInReportAutoComplete(false);
  };
  const toggleSendMoveInReportTenant = (tenantId) => {
    setSendMoveInReportTenantIds((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId]
    );
  };

  // Early return MUST come after all hooks
  if (!lease)
    return (
      <Box p={4}>
        <Typography variant="h6" color="text.secondary">
          Lease not found.
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/landlord/leases')} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );

  // 🧮 Derived values (for rendering) - after early return check
  const leaseTerm = `${formatDate(lease.startDate)} - ${formatDate(lease.endDate)}`;
  const payments = fetchedPayments || lease.payments || [];
  
  // Handle property name click
  const handlePropertyNameClick = () => {
    if (propertyId) {
      navigate(`/landlord/property/${propertyId}`);
    }
  };

  const handleViewLeaseAgreement = async () => {
    if (!leaseAgreement || !lease?.id) return;

    try {
      // Always fetch a fresh lease agreement to get a new SAS URL (SAS URLs expire after 1 hour)
      // This ensures the document can be viewed even if the page has been open for a while
      const response = await tenantDocumentAPI.getLeaseAgreement(lease.id);
      if (response.success && response.data?.blobUrl) {
        window.open(response.data.blobUrl, '_blank');
      } else {
        openSnackbar({
          open: true,
          message: 'Unable to view lease agreement',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error viewing lease agreement:', error);
      openSnackbar({
        open: true,
        message: 'Failed to view lease agreement',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleSignLandlord = async () => {
    if (!eSignatureReadiness.canInvoke) return;
    if (!lease?.id) return;
    
    if (!signatureForm.landlordEmail) {
      openSnackbar({
        open: true,
        message: 'Please provide your email address',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    // Get landlord name from user object or use email as fallback
    const landlordName = user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user?.email || signatureForm.landlordEmail;

    try {
      const response = await axiosServices.post(`/api/lease/${lease.id}/sign-landlord`, {
        leaseId: lease.id,
        landlordEmail: signatureForm.landlordEmail,
        landlordName: landlordName,
        tenantSigners: [], // Empty - landlord only
        emailSubject: signatureForm.emailSubject || null,
        emailMessage: signatureForm.emailMessage || null,
        expirationDays: signatureForm.expirationDays,
        requireAllSigners: true,
        useEmbeddedSigning: true // Request embedded signing for in-app experience
      });

      if (response.data.success) {
        // Check if embedded signing URL is available (preferred)
        if (response.data.data?.embeddedSigningUrl) {
          // Open embedded signing in a modal or new window
          setLandlordSigningUrl(response.data.data.embeddedSigningUrl);
          setEmbeddedSigningOpen(true);
          openSnackbar({
            open: true,
            message: 'Please sign the lease in the window that opened.',
            variant: 'alert',
            alert: { color: 'success' }
          });
        } else if (response.data.data?.signerUrls && signatureForm.landlordEmail) {
          // Fallback to regular signing URL
          const url = response.data.data.signerUrls[signatureForm.landlordEmail];
          if (url) {
            setLandlordSigningUrl(url);
            window.open(url, '_blank');
            openSnackbar({
              open: true,
              message: 'Signing link opened. Please sign the lease.',
              variant: 'alert',
              alert: { color: 'success' }
            });
          } else {
            openSnackbar({
              open: true,
              message: 'Lease sent for your signature. Please check your email for the signing link.',
              variant: 'alert',
              alert: { color: 'success' }
            });
          }
        } else {
          openSnackbar({
            open: true,
            message: 'Lease sent for your signature. Please check your email for the signing link.',
            variant: 'alert',
            alert: { color: 'success' }
          });
        }
        setSendSignatureDialogOpen(false);
        // Don't reload immediately - wait for signing to complete
      } else {
        openSnackbar({
          open: true,
          message: response.data.message || 'Failed to send lease for signature',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error sending lease for landlord signature:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Error sending lease for signature',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleSendForSignature = async () => {
    if (!lease?.id || !eSignatureReadiness.canInvoke) return;

    if (!(lease?.leaseAgreement?.landlordSignedAt ?? lease?.LeaseAgreement?.LandlordSignedAt ?? landlordHasSigned ?? lease?.LandlordSignedAt)) {
      openSnackbar({
        open: true,
        message: 'Please sign the lease first before sending to tenants.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    // Fail closed immediately before dispatch. These identities came directly
    // from current lease tenants and cannot be changed in the dialog.
    const validation = validateExactLeaseSigners(exactTenantSigners);
    if (!validation.valid) {
      openSnackbar({
        open: true,
        message: validation.errors[0] || 'Current tenant signer details are incomplete.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    const landlordEmail = user?.email || signatureForm.landlordEmail;
    const landlordName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email || signatureForm.landlordName;

    setSendingLeaseForSignature(true);
    try {
      const result = await dispatch(sendLeaseForSignature(lease.id, {
        leaseId: lease.id,
        landlordEmail,
        landlordName,
        tenantSigners: exactTenantSigners,
        emailSubject: null,
        emailMessage: null,
        expirationDays: signatureForm.expirationDays,
        requireAllSigners: signatureForm.requireAllSigners
      }));

      if (result.success) {
        openSnackbar({
          open: true,
          message: 'Lease sent to tenants for signature successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setSendSignatureDialogOpen(false);
        await propertiesRefetch();
        await Promise.allSettled([loadSignatureStatus(), loadLeaseAgreement()]);
      } else {
        openSnackbar({
          open: true,
          message: result.message || 'Failed to send lease for signature',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error sending lease for signature:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Error sending lease for signature',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingLeaseForSignature(false);
    }
  };

  const handleCancelSignature = async () => {
    if (!lease?.id) return;

    try {
      const result = await dispatch(cancelLeaseSignature(lease.id));
      if (result.success) {
        openSnackbar({
          open: true,
          message: 'Signature request cancelled successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        window.location.reload();
      } else {
        openSnackbar({
          open: true,
          message: result.message || 'Failed to cancel signature request',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error cancelling signature:', error);
      openSnackbar({
        open: true,
        message: 'Error cancelling signature request',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleResendSignature = async () => {
    if (!lease?.id) return;

    try {
      const result = await dispatch(resendLeaseSignature(lease.id));
      if (result.success) {
        openSnackbar({
          open: true,
          message: 'Signature request resent successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({
          open: true,
          message: result.message || 'Failed to resend signature request',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error resending signature:', error);
      openSnackbar({
        open: true,
        message: 'Error resending signature request',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleSyncSignatureStatus = async () => {
    if (!lease?.id || !(lease?.leaseAgreement?.docuSignEnvelopeId ?? lease?.docuSignEnvelopeId)) {
      openSnackbar({
        open: true,
        message: 'No DocuSign envelope found for this lease',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setSyncingSignature(true);
    try {
      const response = await axiosServices.post(`/api/lease/${lease.id}/sync-signature-status`);
      
      // Force a refetch to get updated lease data
      await propertiesRefetch();
      
      openSnackbar({
        open: true,
        message: response.data?.data?.landlordSignedAt 
          ? 'Signature detected! Lease updated.' 
          : 'Signature status updated',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      if (isDocuSignPollingLimitError(error)) {
        setSigningIssueModalOpen(true);
      } else {
        console.error('Error syncing signature status:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to sync signature status',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
      // Still refetch to get latest data even if sync fails
      propertiesRefetch();
    } finally {
      setSyncingSignature(false);
    }
  };

  const handleGetSigningUrl = async () => {
    if (!lease?.id || !lease?.docuSignEnvelopeId) return;

    // Open embedded modal immediately to show loading state
    setEmbeddedSigningOpen(true);

    if (!user?.email) {
      setEmbeddedSigningOpen(false);
      openSnackbar({
        open: true,
        message: 'Please log in with an email address to sign the lease.',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      const landlordName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user?.email || '';
      
      const embeddedResponse = await axiosServices.post(`/api/lease/${lease.id}/sign-landlord`, {
        leaseId: lease.id,
        landlordEmail: user.email,
        landlordName: landlordName,
        tenantSigners: [],
        useEmbeddedSigning: true
      });

      if (embeddedResponse.data.success && embeddedResponse.data.data?.embeddedSigningUrl) {
        setLandlordSigningUrl(embeddedResponse.data.data.embeddedSigningUrl);
      } else {
        // No embedded URL - show error
        setEmbeddedSigningOpen(false);
        openSnackbar({
          open: true,
          message: embeddedResponse.data.message || 'Failed to get embedded signing URL. Please try again.',
          variant: 'alert',
          alert: { color: 'error' }
        });
        console.error('Failed to get embedded signing URL:', embeddedResponse.data);
      }
    } catch (error) {
      console.error('Error getting embedded signing URL:', error);
      // Close modal on error
      setEmbeddedSigningOpen(false);
      if (isDocuSignPollingLimitError(error)) {
        setSigningIssueModalOpen(true);
      } else {
        const errorMessage = error?.response?.data?.message || 
                            error?.response?.data?.errors?.message ||
                            'Failed to get embedded signing URL. Please try again or contact support.';
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    }
  };

  const getLandlordSignatureStatus = () => {
    // Check both camelCase and PascalCase field names (JSON serialization might use either)
    const landlordSignedAtValue = lease?.leaseAgreement?.landlordSignedAt || landlordHasSigned || lease?.LandlordSignedAt;
    
    // Check if it's a valid value (not null, undefined, or empty string)
    const landlordHasSigned = landlordSignedAtValue != null && 
                              landlordSignedAtValue !== undefined && 
                              landlordSignedAtValue !== '';
    
    return {
      label: landlordHasSigned ? 'Signed by you' : 'Not signed by you',
      color: landlordHasSigned ? 'success' : 'default'
    };
  };

  const getTenantSignatureStatus = () => {
    // If lease hasn't been sent to tenants yet
    if (!(lease?.leaseAgreement?.signatureSentAt ?? lease?.signatureSentAt) || (lease?.leaseAgreement?.signatureStatus ?? lease?.signatureStatus) === 0) {
      return { label: 'Not sent to tenant', color: 'default' };
    }
    
    // Check signature status
    const status = lease?.signatureStatus ?? 0;
    
    if (status === 4) { // Completed - all tenants signed
      return { label: 'Signed by tenant', color: 'success' };
    } else if (status === 3) { // PartiallySigned - some tenants signed
      return { label: 'Partially signed by tenant', color: 'warning' };
    } else if (status === 1 || status === 2) { // Sent or InProgress
      return { label: 'Not signed by tenant', color: 'default' };
    }
    
    return { label: 'Not signed by tenant', color: 'default' };
  };

  // Handle end lease
  const handleEndLeaseClick = () => {
    setEndLeaseConfirmOpen(true);
  };

  const handleConfirmEndLease = async () => {
    try {
      await dispatch(endLease(lease.id));

      // Refresh properties to update the lease status
      await propertiesRefetch();

      openSnackbar({
        open: true,
        message: 'Lease ended successfully. It has been moved to the history tab.',
        variant: 'alert',
        alert: { color: 'success' }
      });

      setEndLeaseConfirmOpen(false);
      // Navigate back to leases page
      navigate('/landlord/leases');
    } catch (error) {
      console.error('Error ending lease:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to end lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Handle reopen lease
  const handleReopenLeaseClick = () => {
    setReopenLeaseConfirmOpen(true);
  };

  const handleConfirmReopenLease = async () => {
    try {
      await dispatch(reopenLease(lease.id));

      openSnackbar({
        open: true,
        message: 'Lease reopened successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });

      setReopenLeaseConfirmOpen(false);
      propertiesRefetch();
    } catch (error) {
      console.error('Error reopening lease:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to reopen lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };


  return (
    <Box>
      <PageBreadcrumbs items={[
        { label: 'Dashboard', path: '/landlord/dashboard' },
        { label: 'Leases', path: '/landlord/leases' },
        { label: headerDisplay || 'Lease' }
      ]} />
      <LeaseDetailView
        lease={lease}
        tenants={tenants}
        property={property}
        payments={payments}
        deposits={deposits}
        rentRecord={rentRecord}
        propertyDisplay={propertyDisplay}
        unitDisplay={unitDisplay}
        isDraftLease={isDraftLease}
        isNotStarted={isNotStarted}
        leaseId={leaseId}
        dashboardSummary={dashboardSummary}
        user={user}
        leaseDocuments={leaseDocuments}
        leaseAgreement={leaseAgreement}
        moveInReadiness={moveInReadiness}
        eSignatureReadiness={eSignatureReadiness}
        handleEndLeaseClick={handleEndLeaseClick}
        handleReopenLeaseClick={handleReopenLeaseClick}
        onRenew={() => { dispatch(setLease(lease)); drawer.openRenewLeaseDrawer(); }}
        onRecordPayment={() => drawer.openPaymentAddDrawer({ lease: { ...lease, tenants }, property, unit: lease?.unit || null, tenant: tenants[0] || null })}
        onViewAgreement={handleViewLeaseAgreement}
        onUploadDocument={() => setDocumentUploadDrawerOpen(true)}
        onEditTerms={() => { dispatch(setLease(lease)); drawer.openLeaseEditDrawer(); }}
        onOpenSignature={() => setSendSignatureDialogOpen(true)}
        onConfigureRent={() => {
          if (!leaseId || !propertyId) {
            navigate('/landlord/leases');
            return;
          }
          const unitId = lease?.unit?.id ?? lease?.unit?.Id ?? lease?.unitId ?? lease?.UnitId;
          const params = new URLSearchParams({ leaseId: String(leaseId), propertyId: String(propertyId) });
          if (unitId) params.set('unitId', String(unitId));
          navigate(`/landlord/leases/build-lease-agreement/rent-deposit-fees?${params.toString()}`);
        }}
        onCustomizeConditionReport={() => navigate('/landlord/customize-move-in-report', {
          state: {
            fromLeaseId: lease?.id ?? lease?.Id,
            propertyName: propertyDisplay,
            unitBedrooms: lease?.unit?.bedrooms ?? lease?.unit?.Bedrooms,
            unitBaths: lease?.unit?.bathrooms ?? lease?.unit?.Bathrooms
          }
        })}
        onViewChecklists={() => {
          const unitId = lease?.unit?.id ?? lease?.unit?.Id ?? lease?.unitId ?? lease?.UnitId;
          navigate(propertyId
            ? `/landlord/checklists/property/${propertyId}${unitId ? `/unit/${unitId}` : ''}`
            : '/landlord/checklists');
        }}
        onAddTenant={() => {
          if (property) dispatch(setProperty(property));
          if (lease?.unit) dispatch(setUnit(lease.unit));
          drawer.openTenantAddDrawer();
        }}
        onPaymentUpdated={() => { refetchPayments(); refetchRentCollection(); propertiesRefetch(); }}
        propertiesRefetch={propertiesRefetch}
      />

      {/* End Lease Confirmation Dialog */}
      <ConfirmationDialog
        open={endLeaseConfirmOpen}
        onClose={() => setEndLeaseConfirmOpen(false)}
        onConfirm={handleConfirmEndLease}
        title="End Lease"
        message={
          lease
            ? `Are you sure you want to end this lease? This will mark the lease as inactive and move it to the history tab. The lease data will be preserved.`
            : 'Are you sure you want to end this lease?'
        }
        confirmText="End Lease"
        cancelText="Cancel"
        confirmColor="warning"
      />

      {/* Reopen Lease Confirmation Dialog */}
      <ConfirmationDialog
        open={reopenLeaseConfirmOpen}
        onClose={() => setReopenLeaseConfirmOpen(false)}
        onConfirm={handleConfirmReopenLease}
        title="Reopen Lease"
        message={
          lease
            ? `Are you sure you want to reopen this lease? This will mark the lease as active again.`
            : 'Are you sure you want to reopen this lease?'
        }
        confirmText="Reopen Lease"
        cancelText="Cancel"
        confirmColor="success"
      />

      <LeaseAddDrawer />
      <LeaseEditDrawer onUpdateSuccess={() => propertiesRefetch()} />
      <RenewLeaseDrawer onRenewSuccess={() => propertiesRefetch()} />
      <TenantAddDrawer />
      <TenantEditDrawer />
      <LeaseDocumentUploadDrawer
        open={documentUploadDrawerOpen}
        onClose={() => setDocumentUploadDrawerOpen(false)}
        leaseId={leaseId}
        tenants={tenants}
        onUploaded={async () => {
          await Promise.all([loadLeaseDocuments(), propertiesRefetch()]);
        }}
      />

      {/* Send for Signature Dialog */}
      <Dialog
        open={sendSignatureDialogOpen}
        onClose={() => {
          setSendSignatureDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {landlordHasSigned ? 'Send Lease to Tenants for Signature' : 'Sign Lease Agreement'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {landlordHasSigned
                ? 'Review and confirm the tenant signers and expiration days. The system will automatically generate and send the email to tenants.'
                : 'Enter your email address to receive a signing link. You must sign the lease before sending it to tenants.'}
            </Typography>

            {!landlordHasSigned ? (
              <TextField
                fullWidth
                label="Email"
                value={signatureForm.landlordEmail}
                onChange={(e) => setSignatureForm({ ...signatureForm, landlordEmail: e.target.value })}
                required
                type="email"
                placeholder="your.email@example.com"
                autoFocus
              />
            ) : null}

            {landlordHasSigned && (
              <>
                <Divider />

                <Typography variant="subtitle2" fontWeight={600}>
                  Tenant Signers
                </Typography>

                {tenants.length === 0 ? (
                  <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                    <UserOutlined style={{ fontSize: 48, color: theme.palette.text.secondary }} />
                    <Typography variant="body2" color="text.secondary" align="center">
                      No tenants assigned to this lease.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
                      Tenants on the unit need to have created an account for us to send the lease agreement to them.
                    </Typography>
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    {exactTenantSigners.map((signer, index) => (
                      <Card key={signer.tenantId || index} variant="outlined" sx={{ p: 2 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                          <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.main' }}>
                            {(signer.name || 'T').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {signer.name || `Tenant ${index + 1}`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {signer.email || 'Email missing'}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              Tenant ID {signer.tenantId || 'missing'} · signing order {signer.signingOrder}
                            </Typography>
                          </Box>
                          <Chip size="small" label="From lease" variant="outlined" />
                        </Stack>
                      </Card>
                    ))}
                    {!exactTenantSignerValidation.valid && (
                      <Typography variant="caption" color="error.main">
                        {exactTenantSignerValidation.errors[0]} Update the tenant record before sending.
                      </Typography>
                    )}
                  </Stack>
                )}
              </>
            )}

            {landlordHasSigned && (
              <>
                <Divider />

                <TextField
                  fullWidth
                  type="number"
                  label="Expiration Days"
                  value={signatureForm.expirationDays}
                  onChange={(e) => setSignatureForm({ ...signatureForm, expirationDays: parseInt(e.target.value) || 30 })}
                  inputProps={{ min: 1, max: 90 }}
                  helperText="Number of days until the signature request expires"
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setSendSignatureDialogOpen(false)}
            disabled={sendingLeaseForSignature}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={landlordHasSigned ? handleSendForSignature : handleSignLandlord}
            disabled={
              sendingLeaseForSignature ||
              (landlordHasSigned && (!exactTenantSignerValidation.valid || !eSignatureReadiness.canInvoke))
            }
            startIcon={sendingLeaseForSignature ? <CircularProgress size={16} /> : null}
          >
            {sendingLeaseForSignature ? 'Sending...' : (landlordHasSigned ? 'Send to Tenants' : 'Sign Lease')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Embedded Signing Dialog */}
      <Dialog
        open={embeddedSigningOpen}
        onClose={() => {
          // Allow closing - DocuSign saves signature automatically
          setEmbeddedSigningOpen(false);
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Sign Lease Agreement</Typography>
            <IconButton 
              onClick={() => {
                setEmbeddedSigningOpen(false);
              }} 
              size="small"
            >
              <CloseCircleOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '100%', position: 'relative' }}>
          {landlordSigningUrl ? (
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
              <Box
                component="iframe"
                src={landlordSigningUrl}
                sx={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  minHeight: '600px',
                  display: 'block'
                }}
                title="DocuSign Embedded Signing"
                allow="camera; microphone; fullscreen"
                onLoad={() => {
                  // Listen for postMessage from DocuSign when signing completes
                  window.addEventListener('message', handleDocuSignMessage);
                }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
                flexDirection: 'column',
                gap: 2
              }}
            >
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Loading signing interface...
              </Typography>
            </Box>
          )}
        </DialogContent>
        </Dialog>

      {/* Signing Issue Modal - shown when DocuSign polling limit is exceeded */}
      <Dialog
        open={signingIssueModalOpen}
        onClose={() => setSigningIssueModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Signing Unavailable</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            We are having an issue with signing lease agreements at this moment. Please contact support for help on this issue.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSigningIssueModalOpen(false)} variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Banking Information Modal */}
      <Dialog
        open={bankingModalOpen}
        onClose={() => setBankingModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Banking Information</Typography>
            <IconButton
              onClick={() => setBankingModalOpen(false)}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <CloseOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Select or change the bank account for this lease. This account will be used to receive rent payments.
            </Typography>

            {loadingBankAccounts ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="bank-account-select-label">Operating Account</InputLabel>
                <Select
                  labelId="bank-account-select-label"
                  id="bank-account-select"
                  value={selectedAccountId || ''}
                  label="Operating Account"
                  onChange={(e) => setSelectedAccountId(e.target.value || null)}
                >
                  <MenuItem value="">
                    <em>None (No account selected)</em>
                  </MenuItem>
                  {bankAccounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      <Stack>
                        <Typography variant="body1">
                          {account.displayName || 'Bank Account'}
                        </Typography>
                        {account.last4 && (
                          <Typography variant="caption" color="text.secondary">
                            ****{account.last4} {account.bankName ? `• ${account.bankName}` : ''}
                          </Typography>
                        )}
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Button
              variant="outlined"
              startIcon={<PlusOutlined />}
              onClick={handleOpenStripeOnboarding}
              disabled={!rentCanInvoke}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none'
              }}
            >
              Add New Bank Account
            </Button>
            <FeatureReadinessNotice presentation={rentReadiness} featureName="Online rent collection" compact />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBankingModalOpen(false)} disabled={savingBankAccount}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveBankAccount}
            disabled={savingBankAccount || loadingBankAccounts}
            startIcon={savingBankAccount ? <CircularProgress size={16} /> : null}
          >
            {savingBankAccount ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stripe Connect Onboarding Dialog */}
      {rentCanInvoke && (
        <StripeConnectOnboardingDialog
          open={showStripeOnboarding}
          onClose={() => setShowStripeOnboarding(false)}
          onComplete={handleStripeOnboardingComplete}
        />
      )}

      {/* Payment Modal */}
      <PaymentModal 
        open={modal.openPayment} 
        rent={modal.selectedRent} 
        onClose={modal.closePaymentModal} 
        defaultAmount={rentRecord?.rentAmount || lease.rentAmount}
        onSuccess={async () => {
          // Refresh all relevant data after payment is made
          refetchRentCollection();
          refetchPayments();
          propertiesRefetch();
          
          // If this was a deposit or fee payment, refresh deposits (for deposits) and payments (for fees)
          if (modal.selectedRent?.isDeposit || modal.selectedRent?.isFee) {
            try {
              // Refresh deposits if it was a deposit payment
              if (modal.selectedRent?.isDeposit) {
                const depositsResponse = await axiosServices.get(`/api/deposit/lease/${leaseId}`);
                if (depositsResponse.data && depositsResponse.data.success) {
                  setDeposits(depositsResponse.data.data || []);
                }
              }
              // Payments are already refreshed above, which will update fee remaining balances
            } catch (error) {
              console.error('Error refreshing deposits:', error);
            }
          }
        }}
      />
    </Box>
  );
}
