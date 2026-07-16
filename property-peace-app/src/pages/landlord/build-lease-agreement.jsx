import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Grid,
  Card,
  CardContent,
  alpha,
  useTheme,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  FileTextOutlined,
  DollarOutlined,
  TeamOutlined,
  SafetyOutlined,
  HomeOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  EditOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckOutlined,
  DownOutlined,
  UpOutlined,
  FormOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperties } from 'store/property/property.selector';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import LeasePreviewModal from 'components/dialogs/LeasePreviewModal';
import axiosServices from 'utils/axios';
import { finishLeaseAgreement, reviewLeaseInstance } from 'api/leaseGeneration';
import LeaseSpecificsPage from './build-lease-agreement/lease-specifics';
import RentDepositFeesPage from './build-lease-agreement/rent-deposit-fees';
import PeopleOnLeasePage from './build-lease-agreement/people-on-lease';
import PetsSmokingOtherPage from './build-lease-agreement/pets-smoking-other';
import UtilitiesMaintenanceKeysPage from './build-lease-agreement/utilities-maintenance-keys';
import ProvisionsAttachmentsPage from './build-lease-agreement/provisions-attachments';

// Workflow sections
const workflowSections = [
  {
    id: 'lease-specifics',
    icon: <FileTextOutlined style={{ fontSize: 24 }} />,
    title: 'Lease Specifics',
    description: 'Verify the address and lease terms.'
  },
  {
    id: 'rent-deposit-fees',
    icon: <DollarOutlined style={{ fontSize: 24 }} />,
    title: 'Rent, Deposit, & Fees',
    description: 'Set the rent amount, security deposit, and fees.'
  },
  {
    id: 'people-on-lease',
    icon: <TeamOutlined style={{ fontSize: 24 }} />,
    title: 'People on the Lease',
    description: 'Confirm the landlord and tenant info.'
  },
  {
    id: 'pets-smoking-other',
    icon: <SafetyOutlined style={{ fontSize: 24 }} />,
    title: 'Pets, Smoking, & Other',
    description: 'Specify pets, smoking policy, and if renters insurance is required.'
  },
  {
    id: 'utilities-maintenance-keys',
    icon: <HomeOutlined style={{ fontSize: 24 }} />,
    title: 'Utilities, Maintenance, & Keys',
    description: 'Choose what is included with the lease.'
  },
  {
    id: 'provisions-attachments',
    icon: <FileTextOutlined style={{ fontSize: 24 }} />,
    title: 'Provisions & Attachments',
    description: 'Add custom clauses, rules, or provisions specific to your property and/or local area.'
  }
];

export default function BuildLeaseAgreementPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  // Get data from URL params
  const leaseId = searchParams.get('leaseId') ? parseInt(searchParams.get('leaseId')) : null;
  const propertyId = searchParams.get('propertyId') ? parseInt(searchParams.get('propertyId')) : null;
  const unitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')) : null;

  // State
  const [lease, setLease] = useState(null);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draftData, setDraftData] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewConfirmMode, setPreviewConfirmMode] = useState(false);
  const [leaseInstanceId, setLeaseInstanceId] = useState(null);
  const [activeSection, setActiveSection] = useState(workflowSections[0].id);
  const [editingSection, setEditingSection] = useState(null);
  const [pendingEditSection, setPendingEditSection] = useState(null);
  const [finalizeSuccess, setFinalizeSuccess] = useState(false);
  const [completingDraft, setCompletingDraft] = useState(false);
  const [signLeaseModalOpen, setSignLeaseModalOpen] = useState(false);

  // P2 — AI lease review
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);

  // P4 — pre-flight checklist
  const [preflightOpen, setPreflightOpen] = useState(false);

  // Helper function to get completion status for a section
  const getSectionCompletionStatus = (sectionId) => {
    if (!lease) return false;
    
    const ag = lease.leaseAgreement;
    const completionMap = {
      'lease-specifics': ag?.isLeaseSpecificsComplete,
      'rent-deposit-fees': ag?.isRentDepositFeesComplete,
      'people-on-lease': ag?.isPeopleOnLeaseComplete,
      'pets-smoking-other': ag?.isPetsSmokingOtherComplete,
      'utilities-maintenance-keys': ag?.isUtilitiesMaintenanceKeysComplete,
      'provisions-attachments': ag?.isProvisionsAttachmentsComplete
    };
    
    return completionMap[sectionId] || false;
  };

  // Refetch properties when viewing this page so step completion statuses are current from DB
  useEffect(() => {
    if (leaseId && propertyId) propertiesRefetch();
  }, [leaseId, propertyId, propertiesRefetch]);

  // Load lease and property data from properties (lease step completion comes from DB via refetch)
  useEffect(() => {
    const loadData = async () => {
      if (!leaseId || !propertyId) {
        setLoading(false);
        return;
      }

      try {
        // Find property and lease from properties
        const foundProperty = properties?.find((p) => p.id === propertyId);
        if (foundProperty) {
          setProperty(foundProperty);
          
          // Find unit if unitId provided
          if (unitId) {
            const foundUnit = foundProperty.units?.find((u) => u.id === unitId);
            if (foundUnit) {
              setUnit(foundUnit);
              const unitLease = foundUnit.lease || foundUnit.Lease;
              if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
                setLease(unitLease);
              }
            }
          } else {
            // For single-unit properties, get lease from first unit
            const firstUnit = foundProperty.units?.[0];
            if (firstUnit) {
              setUnit(firstUnit);
              const unitLease = firstUnit.lease || firstUnit.Lease;
              if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
                setLease(unitLease);
              }
            }
          }
        }

        // Try to get lease instance if it exists
        if (leaseId) {
          try {
            const instanceResponse = await axiosServices.get(`/api/LeaseGeneration/lease/${leaseId}/instances`);
            if (instanceResponse.data.success && instanceResponse.data.data?.length > 0) {
              // Get the most recent instance
              const instances = instanceResponse.data.data;
              const latestInstance = instances.sort((a, b) => 
                new Date(b.createdAt || b.CreatedAt) - new Date(a.createdAt || a.CreatedAt)
              )[0];
              setLeaseInstanceId(latestInstance.id || latestInstance.Id);
            }
          } catch (error) {
            // No instance exists yet - that's okay
            console.log('No lease instance found yet');
          }
        }

        // Load saved draft
        const savedDraft = localStorage.getItem(`leaseAgreementDraft_${leaseId}`);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            setDraftData(parsed);
          } catch (error) {
            console.error('Error loading draft:', error);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        dispatch(
          openSnackbar({
            open: true,
            message: 'Failed to load lease data',
            variant: 'alert',
            alert: { color: 'error' }
          })
        );
      } finally {
        setLoading(false);
      }
    };

    if (properties && properties.length > 0) {
      loadData();
    }
  }, [leaseId, propertyId, unitId, properties, dispatch]);

  const handleSaveDraft = () => {
    const draft = {
      leaseId,
      propertyId,
      unitId,
      leaseInstanceId,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(`leaseAgreementDraft_${leaseId}`, JSON.stringify(draft));
    setDraftData(draft);
    
    dispatch(
      openSnackbar({
        open: true,
        message: 'Draft saved successfully',
        variant: 'alert',
        alert: { color: 'success' }
      })
    );
  };

  const handleStartSection = (sectionId) => {
    setActiveSection(sectionId);
    setEditingSection(sectionId);
  };

  const handleRequestEditSection = (sectionId) => {
    setPendingEditSection(sectionId);
  };

  const handleConfirmEditSection = () => {
    if (!pendingEditSection) return;
    handleStartSection(pendingEditSection);
    setPendingEditSection(null);
  };

  const handleSectionSaved = async () => {
    await propertiesRefetch();
    setEditingSection(null);
  };

  const handleBack = () => {
    navigate('/landlord/leases?tab=agreements');
  };

  const handlePreview = () => {
    if (!leaseId) {
      dispatch(
        openSnackbar({
          open: true,
          message: 'Please complete at least one section before previewing',
          variant: 'alert',
          alert: { color: 'warning' }
        })
      );
      return;
    }
    setPreviewConfirmMode(false);
    setPreviewModalOpen(true);
  };

  const handleFinishLeaseAgreementClick = () => {
    if (!leaseId) return;
    setPreviewConfirmMode(true);
    setPreviewModalOpen(true);
  };

  const handleConfirmComplete = async () => {
    if (!leaseId) return;
    setCompletingDraft(true);
    try {
      const result = await finishLeaseAgreement(leaseId);
      if (result?.success !== false && result?.data) {
        setPreviewModalOpen(false);
        setPreviewConfirmMode(false);
        await propertiesRefetch();
        setLeaseInstanceId(result.data.id || result.data.Id || leaseInstanceId);
        setFinalizeSuccess(true);
      } else {
        dispatch(
          openSnackbar({
            open: true,
            message: result?.message || 'Failed to complete lease agreement',
            variant: 'alert',
            alert: { color: 'error' }
          })
        );
      }
    } catch (err) {
      dispatch(
        openSnackbar({
          open: true,
          message: err?.response?.data?.message || err?.message || 'Failed to complete lease agreement',
          variant: 'alert',
          alert: { color: 'error' }
        })
      );
    } finally {
      setCompletingDraft(false);
    }
  };

  const handleSignLeaseChoice = (wantToSign) => {
    setSignLeaseModalOpen(false);
    if (wantToSign) {
      navigate(`/landlord/leases/${leaseId}?sign=true`);
    } else {
      navigate(`/landlord/leases/${leaseId}`);
    }
  };

  const allSectionsComplete = workflowSections.every((section) => getSectionCompletionStatus(section.id));

  // P4 — pre-flight field checks per section
  const preflightChecks = lease ? [
    {
      section: 'Lease Specifics',
      checks: [
        { label: 'Start date', ok: !!lease.startDate },
        { label: 'End date', ok: !!lease.endDate },
        { label: 'Rent due day', ok: !!lease.rentDueDay }
      ]
    },
    {
      section: 'Rent, Deposit & Fees',
      checks: [
        { label: 'Monthly rent', ok: !!lease.rentAmount && lease.rentAmount > 0 },
        { label: 'Security deposit', ok: !!lease.depositAmount && lease.depositAmount > 0 }
      ]
    },
    {
      section: 'People on the Lease',
      checks: [
        { label: 'Tenant(s) added', ok: (lease.tenants?.length > 0) || lease.addTenantsLater },
        { label: 'Landlord info', ok: !!(lease.leaseLandlords?.length > 0 || lease.landlordName) }
      ]
    },
    {
      section: 'Pets, Smoking & Other',
      checks: [
        { label: 'Pet policy set', ok: lease.petsAllowed !== null && lease.petsAllowed !== undefined },
        { label: 'Smoking policy set', ok: !!lease.smokingAllowed }
      ]
    },
    {
      section: 'Utilities, Maintenance & Keys',
      checks: [
        { label: 'Utility responsibilities', ok: (lease.utilityServiceResponsibilities?.length > 0) },
        { label: 'Maintenance responsibilities', ok: (lease.maintenanceResponsibilities?.length > 0) }
      ]
    },
    {
      section: 'Provisions & Attachments',
      checks: [
        { label: 'Lead paint answered', ok: lease.builtBefore1978 !== null && lease.builtBefore1978 !== undefined }
      ]
    }
  ] : [];

  const handleReviewLease = async () => {
    setReviewResult(null);
    setReviewModalOpen(true);
    setReviewLoading(true);
    try {
      let instanceId = leaseInstanceId;

      // If no instance exists yet, create one via the finish flow (same as preview does)
      if (!instanceId) {
        const instancesRes = await axiosServices.get(`/api/LeaseGeneration/lease/${leaseId}/instances`);
        if (instancesRes.data?.success && instancesRes.data?.data?.length > 0) {
          const latest = instancesRes.data.data.sort((a, b) =>
            new Date(b.createdAt || b.CreatedAt) - new Date(a.createdAt || a.CreatedAt)
          )[0];
          instanceId = latest.id || latest.Id;
          setLeaseInstanceId(instanceId);
        }
      }

      if (!instanceId) {
        dispatch(openSnackbar({ open: true, message: 'Complete at least one section and generate a preview before reviewing.', variant: 'alert', alert: { color: 'warning' } }));
        setReviewModalOpen(false);
        setReviewLoading(false);
        return;
      }

      const result = await reviewLeaseInstance(instanceId);
      setReviewResult(result?.data ?? null);
    } catch (err) {
      dispatch(openSnackbar({ open: true, message: 'AI review failed. Please try again.', variant: 'alert', alert: { color: 'error' } }));
      setReviewModalOpen(false);
    } finally {
      setReviewLoading(false);
    }
  };

  // Derived display values
  const completedSectionsCount = workflowSections.filter((s) => getSectionCompletionStatus(s.id)).length;
  const completionPercent = Math.round((completedSectionsCount / workflowSections.length) * 100);

  const sectionIndex = workflowSections.findIndex((s) => s.id === activeSection);
  const currentSection = workflowSections[sectionIndex >= 0 ? sectionIndex : 0];

  const propertyAddress = property?.streetAddress
    ? `${property.streetAddress}${property.city ? `, ${property.city}` : ''}${property.state ? `, ${property.state}` : ''}${property.zipCode ? ` ${property.zipCode}` : ''}`
    : 'Property Address';

  const companyName = currentOrganization?.name || property?.organization?.name || 'Landlord';

  const tenantNames = lease?.tenants || lease?.Tenants || [];
  const tenantNamesDisplay = tenantNames.length > 0
    ? tenantNames.map((t) => `${t.firstname || t.firstName || ''} ${t.lastname || t.lastName || ''}`.trim()).filter(Boolean).join(', ')
    : '(Tenant Names)';

  const leaseDate = lease?.startDate
    ? new Date(lease.startDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  const storedAgreementName = property?.name || (property?.streetAddress ? propertyAddress : null);

  const sectionFacts = {
    'lease-specifics': [
      ['Property', propertyAddress],
      ['Start date', lease?.startDate ? new Date(lease.startDate).toLocaleDateString() : '—'],
      ['End date', lease?.endDate ? new Date(lease.endDate).toLocaleDateString() : '—'],
      ['Rent due day', lease?.rentDueDay ? `${lease.rentDueDay}${lease.rentDueDay === 1 ? 'st' : lease.rentDueDay === 2 ? 'nd' : lease.rentDueDay === 3 ? 'rd' : 'th'} of month` : '—'],
    ],
    'rent-deposit-fees': [
      ['Monthly rent', lease?.rentAmount ? `$${Number(lease.rentAmount).toLocaleString()}` : '—'],
      ['Security deposit', lease?.depositAmount ? `$${Number(lease.depositAmount).toLocaleString()}` : '—'],
      ['Pet deposit', lease?.petDepositAmount ? `$${Number(lease.petDepositAmount).toLocaleString()}` : '—'],
      ['Late fee', lease?.fees?.find((f) => f.feeType === 'LateFee' || f.name?.toLowerCase().includes('late'))
        ? `$${Number(lease.fees.find((f) => f.feeType === 'LateFee' || f.name?.toLowerCase().includes('late')).amount).toLocaleString()}`
        : '—'],
    ],
    'people-on-lease': [
      ['Tenants', tenantNamesDisplay !== '(Tenant Names)' ? tenantNamesDisplay : '—'],
      ['Landlord / company', companyName],
    ],
    'pets-smoking-other': [
      ['Pets', lease?.petsAllowed === true ? 'Allowed' : lease?.petsAllowed === false ? 'Not allowed' : '—'],
      ['Smoking', lease?.smokingAllowed === 'yes' ? 'Allowed' : lease?.smokingAllowed === 'no' ? 'Not allowed' : lease?.smokingAllowed === 'outsideOnly' ? 'Outside only' : '—'],
      ['Renters insurance', lease?.rentersInsuranceRequired === true ? 'Required' : lease?.rentersInsuranceRequired === false ? 'Not required' : '—'],
    ],
    'utilities-maintenance-keys': [
      ['Utilities configured', lease?.utilityServiceResponsibilities?.length > 0 ? `${lease.utilityServiceResponsibilities.length} item(s)` : '—'],
      ['Maintenance configured', lease?.maintenanceResponsibilities?.length > 0 ? `${lease.maintenanceResponsibilities.length} item(s)` : '—'],
    ],
    'provisions-attachments': [
      ['Built before 1978', lease?.builtBefore1978 != null ? (lease.builtBefore1978 ? 'Yes' : 'No') : '—'],
    ],
  };

  const activeSectionDetails = {
    eyebrow: `Step ${sectionIndex + 1} of ${workflowSections.length}`,
    title: currentSection.title,
    description: currentSection.description,
    facts: sectionFacts[currentSection.id] || [],
  };

  const agreement = lease?.leaseAgreement || lease?.LeaseAgreement;
  const isLeaseAgreementFinalized = agreement?.isDrafted === false || agreement?.IsDrafted === false || !!agreement?.signedDocumentBlobUrl || !!agreement?.SignedDocumentBlobUrl || !!agreement?.signatureCompletedAt || !!agreement?.SignatureCompletedAt;
  const isEditingCurrentSection = editingSection === currentSection.id;
  const shouldShowDisplayMode = isLeaseAgreementFinalized && !isEditingCurrentSection;

  const renderActiveSectionEditor = () => {
    const editorProps = { embedded: true, onSaved: handleSectionSaved };
    const editors = {
      'lease-specifics': <LeaseSpecificsPage {...editorProps} />,
      'rent-deposit-fees': <RentDepositFeesPage {...editorProps} />,
      'people-on-lease': <PeopleOnLeasePage {...editorProps} />,
      'pets-smoking-other': <PetsSmokingOtherPage {...editorProps} />,
      'utilities-maintenance-keys': <UtilitiesMaintenanceKeysPage {...editorProps} />,
      'provisions-attachments': <ProvisionsAttachmentsPage {...editorProps} />
    };

    return editors[currentSection.id] || null;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (finalizeSuccess) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <MainCard>
            <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ width: 84, height: 84, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main', display: 'grid', placeItems: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 42 }} />
              </Box>
              <Box>
                <Typography variant="h3" fontWeight={800}>Lease agreement finalized</Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 560 }}>
                  The signing PDF has been generated from your completed setup. You can view it from the lease agreements tab or start the signature flow now.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <Button variant="outlined" size="large" onClick={() => navigate('/landlord/leases?tab=agreements')} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  View lease agreements
                </Button>
                <Button variant="contained" size="large" startIcon={<FormOutlined />} onClick={() => navigate(`/landlord/leases/${leaseId}?sign=true`)} sx={{ textTransform: 'none', fontWeight: 800 }}>
                  Sign the lease
                </Button>
              </Stack>
            </Stack>
          </MainCard>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack spacing={2.5} sx={{ mb: 3 }}>
          <PageBreadcrumbs
            items={[
              { label: 'Dashboard', path: '/landlord/dashboard' },
              { label: 'Lease agreements', path: '/landlord/leases?tab=agreements' },
              { label: 'Build lease agreement' }
            ]}
          />

          <MainCard sx={{ borderRadius: 2.5, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, boxShadow: 'none' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <FileTextOutlined style={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.9 }}>
                      Lease agreement setup
                    </Typography>
                    <Chip size="small" label={`${completedSectionsCount}/${workflowSections.length} steps complete`} variant="outlined" color={allSectionsComplete ? 'success' : 'default'} />
                  </Stack>
                  <Typography variant="h3" fontWeight={850} sx={{ mt: 0.5 }}>
                    {storedAgreementName || 'Set up your lease agreement'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                    Complete the required sections, save progress as you go, and finalize when you are ready to generate the signing PDF.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
                <Button variant="outlined" onClick={handleBack} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Back to agreements
                </Button>
                <Button variant="contained" onClick={handleSaveDraft} sx={{ textTransform: 'none', fontWeight: 800 }}>
                  Save
                </Button>
              </Stack>
            </Stack>
          </MainCard>
        </Stack>

        <Grid container spacing={3} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: 3 }}>
            <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
              <MainCard sx={{ borderRadius: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" fontWeight={800}>Setup progress</Typography>
                    <Typography variant="body2" color="primary.main" fontWeight={800}>{completedSectionsCount}/{workflowSections.length}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={completionPercent} sx={{ height: 8, borderRadius: 99, bgcolor: alpha(theme.palette.primary.main, 0.1), '& .MuiLinearProgress-bar': { borderRadius: 99 } }} />
                  <Typography variant="caption" color="text.secondary">{completionPercent}% complete</Typography>
                </Stack>
              </MainCard>

              <MainCard content={false} sx={{ overflow: 'hidden', borderRadius: 2 }}>
                <Stack spacing={0.5} sx={{ p: 1 }}>
                  {workflowSections.map((section, index) => {
                    const isCompleted = getSectionCompletionStatus(section.id);
                    const isActive = activeSection === section.id;
                    return (
                      <Box
                        key={section.id}
                        component="button"
                        onClick={() => setActiveSection(section.id)}
                        sx={{
                          width: '100%',
                          textAlign: 'left',
                          border: 0,
                          borderRadius: 1.5,
                          p: 1.35,
                          bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                        }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: isCompleted ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.divider, 0.12), color: isCompleted ? 'success.main' : 'text.secondary', fontWeight: 800, fontSize: '0.78rem' }}>
                            {isCompleted ? <CheckCircleOutlined style={{ fontSize: 16 }} /> : index + 1}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={800} color={isActive ? 'primary.main' : 'text.primary'}>{section.title}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25 }}>{section.description}</Typography>
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </MainCard>

              <MainCard sx={{ borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.035), border: `1px solid ${alpha(theme.palette.info.main, 0.14)}`, boxShadow: 'none' }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <InfoCircleOutlined style={{ color: theme.palette.info.main, fontSize: 16 }} />
                    <Typography variant="subtitle2" fontWeight={800}>Before you finalize</Typography>
                  </Stack>
                  <Stack spacing={0.75} component="ul" sx={{ m: 0, pl: 2.25 }}>
                    <Typography component="li" variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                      Save keeps this as a draft. Finalize generates the signing PDF.
                    </Typography>
                    <Typography component="li" variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                      Editing after signatures clears signatures so everyone can sign the updated agreement.
                    </Typography>
                  </Stack>
                </Stack>
              </MainCard>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 9 }}>
            <MainCard sx={{ borderRadius: 2 }}>
              <Stack spacing={3}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.9 }}>{activeSectionDetails.eyebrow}</Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>{activeSectionDetails.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>{activeSectionDetails.description}</Typography>
                  </Box>
                  {shouldShowDisplayMode ? (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditOutlined />}
                      onClick={() => handleRequestEditSection(currentSection.id)}
                      sx={{ textTransform: 'none', fontWeight: 800 }}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Chip
                      label={getSectionCompletionStatus(currentSection.id) ? 'Complete' : 'Needs setup'}
                      color={getSectionCompletionStatus(currentSection.id) ? 'success' : 'warning'}
                      variant={getSectionCompletionStatus(currentSection.id) ? 'filled' : 'outlined'}
                    />
                  )}
                </Stack>
                {shouldShowDisplayMode ? (
                  <Grid container spacing={1.5}>
                    {activeSectionDetails.facts.map(([label, value]) => (
                      <Grid key={label} size={{ xs: 12, sm: 6 }}>
                        <Box sx={{ p: 1.75, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, bgcolor: alpha(theme.palette.grey[500], 0.035) }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
                          <Typography variant="body2" fontWeight={800} sx={{ mt: 0.25 }}>{value}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Paper sx={{ p: { xs: 0, md: 0 }, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, boxShadow: 'none', overflow: 'hidden' }}>
                    {isLeaseAgreementFinalized && isEditingCurrentSection && (
                      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`, bgcolor: alpha(theme.palette.warning.main, 0.06) }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <WarningOutlined style={{ color: theme.palette.warning.main, fontSize: 18 }} />
                          <Typography variant="body2" color="text.secondary">
                            You are editing a finalized agreement. Saving changes will require all parties to sign the updated version again.
                          </Typography>
                        </Stack>
                      </Box>
                    )}
                    <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                      {renderActiveSectionEditor()}
                    </Box>
                  </Paper>
                )}

                <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, boxShadow: 'none' }}>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight={800}>Draft agreement preview</Typography>
                      <Button size="small" startIcon={<EyeOutlined />} onClick={handlePreview} sx={{ textTransform: 'none', fontWeight: 700 }}>Preview PDF</Button>
                    </Stack>
                    <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.035), border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}` }}>
                      <Typography variant="body2" fontWeight={800}>{companyName} and {tenantNamesDisplay}</Typography>
                      <Typography variant="caption" color="text.secondary">{propertyAddress}</Typography>
                      <Divider sx={{ my: 1.25 }} />
                      <Typography variant="caption" color="text.secondary">Lease date: {leaseDate} · Rent: {lease.rentAmount ? `$${Number(lease.rentAmount).toLocaleString()}/mo` : 'not set'}</Typography>
                    </Box>
                  </Stack>
                </Paper>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                  <Button variant="outlined" size="large" onClick={handleSaveDraft} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Save
                  </Button>
                  <Button
                    variant="contained"
                    size="large"
                    disabled={completingDraft || !allSectionsComplete}
                    onClick={handleFinishLeaseAgreementClick}
                    sx={{ textTransform: 'none', fontWeight: 800 }}
                  >
                    {completingDraft ? 'Finalizing…' : 'Finalize'}
                  </Button>
                </Stack>
                {!allSectionsComplete && (
                  <Typography variant="caption" color="text.secondary" textAlign="right">
                    Complete all required steps before finalizing the agreement.
                  </Typography>
                )}
              </Stack>
            </MainCard>
          </Grid>
        </Grid>
      </Container>

      {/* Preview Modal (with optional confirm mode for Finish Lease Agreement) */}
      <LeasePreviewModal
        open={previewModalOpen}
        onClose={() => { setPreviewModalOpen(false); setPreviewConfirmMode(false); }}
        leaseInstanceId={leaseInstanceId}
        leaseId={leaseId}
        confirmMode={previewConfirmMode}
        onConfirm={handleConfirmComplete}
        confirmLabel="Confirm & Complete"
        submitting={completingDraft}
      />

      {/* P2 — AI Lease Review Dialog */}
      <Dialog
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <AuditOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
            <Typography variant="h6" fontWeight={600}>AI Lease Review</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {reviewLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">Reviewing your lease…</Typography>
            </Box>
          ) : reviewResult ? (
            <Stack spacing={2}>
              {reviewResult.summary && (
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.06), borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">{reviewResult.summary}</Typography>
                </Box>
              )}
              {!reviewResult.hasIssues ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: theme.palette.success.main }} />
                  <Typography variant="body2" color="success.main" fontWeight={500}>No issues found. Your lease looks good!</Typography>
                </Stack>
              ) : (
                <List disablePadding>
                  {reviewResult.issues.map((issue, idx) => {
                    const isError = issue.severity === 'error';
                    const isWarning = issue.severity === 'warning';
                    const iconColor = isError ? theme.palette.error.main : isWarning ? theme.palette.warning.main : theme.palette.info.main;
                    const Icon = isError ? ExclamationCircleOutlined : isWarning ? WarningOutlined : InfoCircleOutlined;
                    return (
                      <ListItem key={idx} disablePadding sx={{ mb: 1, alignItems: 'flex-start' }}>
                        <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                          <Icon style={{ fontSize: 16, color: iconColor }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={issue.message}
                          secondary={[issue.category, issue.section].filter(Boolean).join(' · ')}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <Chip
                          label={issue.severity}
                          size="small"
                          color={isError ? 'error' : isWarning ? 'warning' : 'info'}
                          variant="outlined"
                          sx={{ ml: 1, flexShrink: 0, alignSelf: 'center', height: 20, fontSize: '0.65rem' }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReviewModalOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
          {!reviewLoading && (
            <Button variant="outlined" onClick={handleReviewLease} sx={{ textTransform: 'none' }}>
              Re-run Review
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Confirm finalized agreement edit warning */}
      <Dialog
        open={!!pendingEditSection}
        onClose={() => setPendingEditSection(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <WarningOutlined style={{ color: theme.palette.warning.main, fontSize: 20 }} />
            <Typography variant="h6" fontWeight={700}>
              Edit finalized agreement?
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Editing this finalized lease agreement will clear the existing signatures and require all parties to re-sign the updated agreement.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setPendingEditSection(null)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" color="warning" onClick={handleConfirmEditSection} sx={{ textTransform: 'none', fontWeight: 800 }}>
            Continue editing
          </Button>
        </DialogActions>
      </Dialog>

      {/* Would you like to sign the lease? modal (after completing) */}
      <Dialog
        open={signLeaseModalOpen}
        onClose={() => handleSignLeaseChoice(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Lease agreement saved
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Would you like to sign the lease now?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => handleSignLeaseChoice(false)} sx={{ textTransform: 'none' }}>
            Not now
          </Button>
          <Button variant="contained" onClick={() => handleSignLeaseChoice(true)} sx={{ textTransform: 'none' }}>
            Yes, sign lease
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
