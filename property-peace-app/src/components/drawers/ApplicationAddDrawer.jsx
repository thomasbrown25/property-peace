import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// material-ui
import {
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Switch,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Paper,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// form + validation
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';

// project imports
import { useDrawer } from 'contexts/DrawerContext';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import FormInput from 'components/input/FormInput';
import FormNumberInput from 'components/input/FormNumberInput';
import PropertySelect from 'components/PropertySelect';
import Autocomplete from 'components/@extended/AutoComplete';
import { selectProperty, selectProperties } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { openSnackbar } from 'api/snackbar';
import * as applicationApi from 'api/application';
import { applicationInviteAPI } from 'api';
import useAuth from 'hooks/useAuth';
import useFetchTenants from 'hooks/useFetchTenants';
import useFetchProperties from 'hooks/useFetchProperties';
import SendOutlined from '@ant-design/icons/SendOutlined';

// ==============================|| APPLICATION ADD DRAWER ||============================== //

const ApplicationSchema = Yup.object().shape({
  propertyId: Yup.number().required('Property is required'),
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  phoneNumber: Yup.string(),
  ssn: Yup.string(),
  monthlyIncome: Yup.number().min(0, 'Monthly income must be positive'),
  employmentMonths: Yup.number().min(0, 'Employment months must be positive'),
  numberOfOccupants: Yup.number().min(1, 'Number of occupants must be at least 1')
});

const getInitialValues = () => ({
  // Tenant Selection
  selectedTenantId: null,

  // Property/Unit
  propertyId: '',
  unitId: null,

  // Applicant Information
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  dateOfBirth: null,
  ssn: '',
  currentAddress: '',
  currentCity: '',
  currentState: '',
  currentZipCode: '',

  // Employment Information
  employerName: '',
  jobTitle: '',
  monthlyIncome: '',
  employmentMonths: '',

  // References
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  previousLandlordName: '',
  previousLandlordPhone: '',

  // Application Details
  numberOfOccupants: '',
  hasPets: false,
  petDetails: '',
  hasVehicles: false,
  vehicleDetails: '',
  desiredMoveInDate: null,
  additionalNotes: '',

  // Status
  status: 0 // Draft
});

export default function ApplicationAddDrawer() {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const selectedProperty = useSelector(selectProperty);
  const properties = useSelector(selectProperties);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const { propertiesRefetch } = useFetchProperties();
  const [loading, setLoading] = useState(false);
  const [fillOutMyself, setFillOutMyself] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [initialEmail, setInitialEmail] = useState('');
  const [initialPropertyId, setInitialPropertyId] = useState('');
  const [initialUnitId, setInitialUnitId] = useState(null);
  const [showTenantSelectionModal, setShowTenantSelectionModal] = useState(false);
  const [pendingPropertyId, setPendingPropertyId] = useState(null);
  const [pendingUnitId, setPendingUnitId] = useState(null);
  const [selectedTenantFromModal, setSelectedTenantFromModal] = useState(null);
  // Simple initial form state - must be declared before useEffects that use it
  const [initialForm, setInitialForm] = useState({
    email: '',
    propertyId: '',
    unitId: ''
  });
  const { tenants } = useFetchTenants();
  const [pendingApplications, setPendingApplications] = useState([]);
  const [loadingApplications, setLoadingApplications] = useState(false);

  // Load applications to check for pending statuses when drawer opens
  useEffect(() => {
    const loadApplications = async () => {
      if (!drawer.isOpenApplicationAdd || !user?.id) return;
      
      setLoadingApplications(true);
      try {
        const response = await applicationApi.getApplicationsByLandlord(user.id);
        if (response.success && response.data) {
          // Filter for pending applications (status 8)
          const pending = response.data.filter(app => {
            const status = typeof app.status === 'string' 
              ? (app.status.toLowerCase() === 'pending' ? 8 : null)
              : (app.status === 8);
            return status === 8;
          });
          setPendingApplications(pending);
        }
      } catch (error) {
        console.error('Error loading applications:', error);
      } finally {
        setLoadingApplications(false);
      }
    };

    loadApplications();
  }, [drawer.isOpenApplicationAdd, user?.id]);

  // Get unit options for selected property
  const unitOptions = useMemo(() => {
    if (!selectedProperty?.units || selectedProperty.units.length === 0) return [];
    return selectedProperty.units.map((u) => ({
      value: u.id,
      label: u.name || `Unit ${u.id}`
    }));
  }, [selectedProperty]);

  // Tenant options for autocomplete
  const tenantOptions = useMemo(() => {
    if (!tenants || tenants.length === 0) return [];
    return tenants.map((tenant) => {
      const firstname = tenant.firstname || tenant.firstName || '';
      const lastname = tenant.lastname || tenant.lastName || '';
      return {
        id: tenant.id,
        label: `${firstname} ${lastname}`.trim() || 'Unnamed Tenant',
        email: tenant.email || '',
        phoneNumber: tenant.phoneNumber || '',
        propertyId: tenant.propertyId,
        unitId: tenant.unitId,
        tenant // Store full tenant object
      };
    });
  }, [tenants]);

  // Check if tenant has pending application for the same property/unit
  const hasPendingApplication = useCallback((tenantEmail, propertyId, unitId) => {
    if (!tenantEmail || !propertyId || !pendingApplications.length) return false;
    return pendingApplications.some(app => 
      app.email?.toLowerCase() === tenantEmail.toLowerCase() &&
      app.propertyId === propertyId &&
      (unitId ? app.unitId === unitId : app.unitId === null)
    );
  }, [pendingApplications]);

  // Get the pending application for a tenant
  const getPendingApplication = useCallback((tenantEmail, propertyId, unitId) => {
    if (!tenantEmail || !propertyId || !pendingApplications.length) return null;
    return pendingApplications.find(app => 
      app.email?.toLowerCase() === tenantEmail.toLowerCase() &&
      app.propertyId === propertyId &&
      (unitId ? app.unitId === unitId : app.unitId === null)
    ) || null;
  }, [pendingApplications]);

  // Filter tenants by property (and optionally unit)
  const filteredTenantsForProperty = useMemo(() => {
    if (!tenants || tenants.length === 0 || !pendingPropertyId) return [];
    
    return tenants.filter((tenant) => {
      const matchesProperty = tenant.propertyId === pendingPropertyId;
      if (!matchesProperty) return false;
      
      // If unit is selected, filter by unit; otherwise show all tenants for the property
      if (pendingUnitId) {
        return tenant.unitId === pendingUnitId;
      }
      return true;
    });
  }, [tenants, pendingPropertyId, pendingUnitId]);

  const formik = useFormik({
    initialValues: getInitialValues(),
    validationSchema: ApplicationSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      if (!user?.id) {
        openSnackbar({
          open: true,
          message: 'User not found',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setSubmitting(false);
        return;
      }

      try {
        setLoading(true);

        // Prepare payload
        const payload = {
          propertyId: Number(values.propertyId),
          unitId: values.unitId ? Number(values.unitId) : null,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phoneNumber: values.phoneNumber?.trim() || null,
          dateOfBirth: values.dateOfBirth || null,
          ssn: values.ssn?.trim() || null,
          currentAddress: values.currentAddress?.trim() || null,
          currentCity: values.currentCity?.trim() || null,
          currentState: values.currentState?.trim() || null,
          currentZipCode: values.currentZipCode?.trim() || null,
          employerName: values.employerName?.trim() || null,
          jobTitle: values.jobTitle?.trim() || null,
          monthlyIncome: values.monthlyIncome ? Number(values.monthlyIncome) : null,
          employmentMonths: values.employmentMonths ? Number(values.employmentMonths) : null,
          emergencyContactName: values.emergencyContactName?.trim() || null,
          emergencyContactPhone: values.emergencyContactPhone?.trim() || null,
          emergencyContactRelationship: values.emergencyContactRelationship?.trim() || null,
          previousLandlordName: values.previousLandlordName?.trim() || null,
          previousLandlordPhone: values.previousLandlordPhone?.trim() || null,
          numberOfOccupants: values.numberOfOccupants ? Number(values.numberOfOccupants) : null,
          hasPets: values.hasPets || false,
          petDetails: values.petDetails?.trim() || null,
          hasVehicles: values.hasVehicles || false,
          vehicleDetails: values.vehicleDetails?.trim() || null,
          desiredMoveInDate: values.desiredMoveInDate || null,
          additionalNotes: values.additionalNotes?.trim() || null,
          status: Number(values.status), // 0 = Draft, 1 = Submitted
          isLandlordEntered: showFullForm && fillOutMyself // True if landlord manually filled out the form
        };

        const response = await applicationApi.addApplication(payload);

        if (response.success) {
          openSnackbar({
            open: true,
            message: `Application ${values.status === 1 ? 'submitted' : 'saved as draft'} successfully`,
            variant: 'alert',
            alert: { color: 'success' }
          });

          resetForm();
          drawer.closeApplicationAddDrawer();
        } else {
          openSnackbar({
            open: true,
            message: response.message || 'Failed to create application',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (error) {
        console.error('Error creating application:', error);
        const errorMessage = error?.response?.data?.message || 'Failed to create application';
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  // Handle tenant selection and auto-fill
  useEffect(() => {
    if (values.selectedTenantId) {
      const selectedTenant = tenantOptions.find((opt) => opt.id === values.selectedTenantId);
      if (selectedTenant?.tenant) {
        const tenant = selectedTenant.tenant;
        // Auto-fill basic tenant information (handle both field name formats)
        const firstname = tenant.firstname || tenant.firstName || '';
        const lastname = tenant.lastname || tenant.lastName || '';
        if (firstname) setFieldValue('firstName', firstname);
        if (lastname) setFieldValue('lastName', lastname);
        if (tenant.email) setFieldValue('email', tenant.email);
        if (tenant.phoneNumber) setFieldValue('phoneNumber', tenant.phoneNumber);
      }
    }
  }, [values.selectedTenantId, tenantOptions, setFieldValue]);

  // Update propertyId when property selection changes and auto-fill address
  useEffect(() => {
    if (selectedProperty?.id) {
      setFieldValue('propertyId', selectedProperty.id, true); // true = validate
      // Clear unitId if property changes
      if (values.propertyId && values.propertyId !== selectedProperty.id) {
        setFieldValue('unitId', null);
      }
      
      // Auto-fill address fields from selected property
      if (selectedProperty.streetAddress) {
        setFieldValue('currentAddress', selectedProperty.streetAddress);
      }
      if (selectedProperty.city) {
        setFieldValue('currentCity', selectedProperty.city);
      }
      if (selectedProperty.state) {
        setFieldValue('currentState', selectedProperty.state);
      }
      if (selectedProperty.zipCode) {
        setFieldValue('currentZipCode', selectedProperty.zipCode);
      }
    } else {
      setFieldValue('propertyId', '', true); // true = validate
      setFieldValue('unitId', null);
    }
  }, [selectedProperty, setFieldValue, values.propertyId]);

  // Track previous property/unit to detect changes
  const prevPropertyUnitRef = useRef({ propertyId: null, unitId: null });

  // Check for existing tenants when property/unit is selected in initial form
  useEffect(() => {
    // Only check in initial form, not full form
    if (showFullForm) return;
    
    const propertyId = selectedProperty?.id;
    const isMultiUnit = selectedProperty?.propertyType === 'multiUnit' || selectedProperty?.propertyType === 'MultiUnit';
    const unitId = initialForm.unitId || null;
    
    // For multi-unit properties, require both property and unit to be selected
    // For single-unit properties, only property is required
    const isSelectionComplete = propertyId && (isMultiUnit ? unitId : true);
    
    // Check if property or unit has changed
    const hasChanged = 
      prevPropertyUnitRef.current.propertyId !== propertyId ||
      prevPropertyUnitRef.current.unitId !== unitId;
    
    // Show modal when selection is complete (regardless of whether tenants exist)
    if (isSelectionComplete && hasChanged && !showTenantSelectionModal) {
      setPendingPropertyId(propertyId);
      setPendingUnitId(unitId);
      setShowTenantSelectionModal(true);
      
      // Update ref to track current selection
      prevPropertyUnitRef.current = { propertyId, unitId };
    } else if (propertyId) {
      // Update ref even if we don't show modal
      prevPropertyUnitRef.current = { propertyId, unitId };
    }
  }, [selectedProperty?.id, selectedProperty?.propertyType, initialForm.unitId, tenants, showFullForm, showTenantSelectionModal]);

  // Handle tenant selection from modal
  const handleSelectTenant = (tenant) => {
    if (tenant) {
      setSelectedTenantFromModal(tenant);
      if (tenant.email) {
        setInitialForm(prev => ({ ...prev, email: tenant.email }));
      }
      // Set selectedTenantId in formik if tenant exists in tenantOptions
      const tenantOption = tenantOptions.find(opt => opt.id === tenant.id);
      if (tenantOption) {
        setFieldValue('selectedTenantId', tenant.id);
      }
    }
    setShowTenantSelectionModal(false);
    setPendingPropertyId(null);
    setPendingUnitId(null);
  };

  // Handle bypass (manual email entry)
  const handleBypassTenantSelection = () => {
    setSelectedTenantFromModal(null);
    setShowTenantSelectionModal(false);
    setPendingPropertyId(null);
    setPendingUnitId(null);
  };

  // Handle resend invite for tenant with pending application
  const handleResendInviteForTenant = async (tenant) => {
    const tenantEmail = tenant.email || '';
    const pendingApp = getPendingApplication(tenantEmail, pendingPropertyId, pendingUnitId);
    
    if (!pendingApp?.id) {
      openSnackbar({
        open: true,
        message: 'Pending application not found',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      const response = await applicationInviteAPI.resendApplicationInviteByApplicationId(pendingApp.id);
      
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Application invite resent successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        
        // Close modal and drawer
        setShowTenantSelectionModal(false);
        setPendingPropertyId(null);
        setPendingUnitId(null);
        drawer.closeApplicationAddDrawer();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to resend invite',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error resending invite:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to resend invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Handle initial step submission (email + property selection)
  const handleInitialSubmit = async () => {
    const email = initialForm.email.trim();
    const propertyId = selectedProperty?.id || initialForm.propertyId;
    const unitId = initialForm.unitId || null;

    if (!email) {
      openSnackbar({
        open: true,
        message: 'Please provide an email address',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    if (!propertyId) {
      openSnackbar({
        open: true,
        message: 'Please select a property',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    if (fillOutMyself) {
      // Show full form with pre-filled email and property
      setInitialEmail(email);
      setInitialPropertyId(propertyId);
      setInitialUnitId(unitId);
      setFieldValue('email', email);
      setFieldValue('propertyId', propertyId);
      if (unitId) {
        setFieldValue('unitId', unitId);
      }
      // If tenant was selected from modal, populate their information
      if (selectedTenantFromModal) {
        const firstname = selectedTenantFromModal.firstname || selectedTenantFromModal.firstName || '';
        const lastname = selectedTenantFromModal.lastname || selectedTenantFromModal.lastName || '';
        if (firstname) setFieldValue('firstName', firstname);
        if (lastname) setFieldValue('lastName', lastname);
        if (selectedTenantFromModal.phoneNumber) setFieldValue('phoneNumber', selectedTenantFromModal.phoneNumber);
        // Set selectedTenantId if tenant exists in tenantOptions
        const tenantOption = tenantOptions.find(opt => opt.id === selectedTenantFromModal.id);
        if (tenantOption) {
          setFieldValue('selectedTenantId', selectedTenantFromModal.id);
        }
      }
      setShowFullForm(true);
    } else {
      // Send invite
      try {
        setLoading(true);
        const payload = {
          propertyId: Number(propertyId),
          unitId: unitId ? Number(unitId) : null,
          email: email.trim()
        };

        const response = await applicationInviteAPI.createApplicationInvite(payload);

        if (response.success) {
          openSnackbar({
            open: true,
            message: 'Application invite sent successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
          drawer.closeApplicationAddDrawer();
          // Reset state
          setFillOutMyself(false);
          setShowFullForm(false);
          setInitialEmail('');
          setInitialPropertyId('');
          setInitialUnitId(null);
          setInitialForm({ email: '', propertyId: '', unitId: '' });
        } else {
          openSnackbar({
            open: true,
            message: response.message || 'Failed to send invite',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (error) {
        console.error('Error sending invite:', error);
        const errorMessage = error?.response?.data?.message || 'Failed to send invite';
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Reset state when drawer closes
  useEffect(() => {
    if (!drawer.isOpenApplicationAdd) {
      setFillOutMyself(false);
      setShowFullForm(false);
      setInitialEmail('');
      setInitialPropertyId('');
      setInitialUnitId(null);
      setInitialForm({ email: '', propertyId: '', unitId: '' });
      setShowTenantSelectionModal(false);
      setPendingPropertyId(null);
      setPendingUnitId(null);
      setSelectedTenantFromModal(null);
      prevPropertyUnitRef.current = { propertyId: null, unitId: null };
    }
  }, [drawer.isOpenApplicationAdd]);

  // Initialize form values when showing full form
  useEffect(() => {
    if (showFullForm && initialEmail && initialPropertyId) {
      setFieldValue('email', initialEmail);
      setFieldValue('propertyId', initialPropertyId);
      if (initialUnitId) {
        setFieldValue('unitId', initialUnitId);
      }
    }
  }, [showFullForm, initialEmail, initialPropertyId, initialUnitId, setFieldValue]);

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={drawer.isOpenApplicationAdd}
      onClose={() => {
        drawer.closeApplicationAddDrawer();
        setFillOutMyself(false);
        setShowFullForm(false);
        setInitialEmail('');
        setInitialPropertyId('');
        setInitialUnitId(null);
        setInitialForm({ email: '', propertyId: '', unitId: '' });
        setSelectedTenantFromModal(null);
      }}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: isDarkMode ? 'rgba(1, 11, 22, 0.62)' : 'rgba(6, 30, 53, 0.32)',
            backdropFilter: 'blur(2px)'
          }
        }
      }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 600, md: 700 },
          display: 'flex',
          flexDirection: 'column',
          color: isDarkMode ? '#FFFFFF' : 'text.primary',
          bgcolor: isDarkMode ? '#061E35' : 'background.paper',
          backgroundImage: isDarkMode ? 'linear-gradient(155deg, rgba(126, 227, 163, 0.08) 0%, rgba(6, 30, 53, 0) 34%)' : 'none',
          borderLeft: isDarkMode ? '1px solid rgba(126, 227, 163, 0.48)' : `1px solid ${theme.palette.divider}`,
          boxShadow: isDarkMode ? '-24px 0 64px rgba(0, 0, 0, 0.42)' : '-18px 0 48px rgba(6, 30, 53, 0.14)',
          '& .MuiDivider-root': { borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.16)' : 'divider' },
          '& .MuiInputLabel-root': { color: isDarkMode ? 'rgba(255, 255, 255, 0.72)' : 'text.secondary' },
          '& .MuiInputLabel-root.Mui-focused': { color: isDarkMode ? '#7EE3A3' : 'primary.main' },
          '& .MuiOutlinedInput-root': {
            color: isDarkMode ? '#FFFFFF' : 'text.primary',
            bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'background.default',
            '& fieldset': { borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.42)' : 'divider' },
            '&:hover fieldset': { borderColor: isDarkMode ? 'rgba(126, 227, 163, 0.78)' : 'primary.main' },
            '&.Mui-focused': { bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'background.paper' },
            '&.Mui-focused fieldset': { borderColor: isDarkMode ? '#7EE3A3' : 'primary.main', borderWidth: 2 },
            '& input::placeholder': { color: isDarkMode ? 'rgba(255, 255, 255, 0.58)' : 'text.secondary', opacity: 1 }
          },
          '& .MuiSelect-icon': { color: isDarkMode ? 'rgba(255, 255, 255, 0.78)' : 'text.secondary' },
          '& .MuiFormHelperText-root:not(.Mui-error)': { color: isDarkMode ? 'rgba(255, 255, 255, 0.68)' : 'text.secondary' }
        }
      }}
    >
      {!showFullForm ? (
        // Initial Step: Email + Property Selection
        <>
          <Toolbar sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2, minHeight: '88px !important', gap: 2 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                color: isDarkMode ? '#061E35' : 'primary.main',
                bgcolor: isDarkMode ? '#7EE3A3' : alpha(theme.palette.primary.main, 0.12),
                borderRadius: 1,
                boxShadow: isDarkMode ? '0 10px 24px rgba(126, 227, 163, 0.2)' : `0 8px 20px ${alpha(theme.palette.primary.main, 0.14)}`
              }}
            >
              <SendOutlined style={{ fontSize: 19 }} />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ color: isDarkMode ? '#7EE3A3' : 'primary.main', fontWeight: 700, letterSpacing: '0.12em', lineHeight: 1.2 }}>
                Applications
              </Typography>
              <Typography variant="h5" sx={{ color: isDarkMode ? '#FFFFFF' : 'text.primary', fontWeight: 700, lineHeight: 1.25 }}>
                New Rental Application
              </Typography>
            </Box>
            <IconButton
              onClick={() => {
                drawer.closeApplicationAddDrawer();
                setInitialForm({ email: '', propertyId: '', unitId: '' });
                setSelectedTenantFromModal(null);
              }}
              size="large"
              aria-label="Close new application drawer"
              sx={{
                color: isDarkMode ? '#FFFFFF' : 'text.secondary',
                bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'action.hover',
                '&:hover': { bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.16)' : alpha(theme.palette.primary.main, 0.1) }
              }}
            >
              <CloseOutlined />
            </IconButton>
          </Toolbar>
          <Divider />

          <Box sx={{ px: { xs: 2.5, sm: 3.5 }, py: 3, flex: 1, overflowY: 'auto' }}>
            <Stack spacing={3}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: isDarkMode ? 'rgba(126, 227, 163, 0.1)' : alpha(theme.palette.primary.main, 0.045),
                  border: `1px solid ${isDarkMode ? 'rgba(126, 227, 163, 0.28)' : alpha(theme.palette.primary.main, 0.16)}`,
                  borderLeft: `4px solid ${isDarkMode ? '#7EE3A3' : theme.palette.primary.main}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="body1" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.86)' : 'text.secondary', lineHeight: 1.65 }}>
                  Choose a property and enter the tenant's email to send an invite, or complete the application on their behalf.
                </Typography>
              </Box>

              {/* Property/Unit Selection */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1.25, color: isDarkMode ? '#FFFFFF' : 'text.primary', fontWeight: 700 }}>
                  Property & Unit
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? 'rgba(255, 255, 255, 0.68)' : 'text.secondary' }}>
                  Select the home this application is for.
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <PropertySelect 
                      width="100%" 
                      disableAllOption={true}
                    />
                  </Grid>
                  {selectedProperty &&
                    (selectedProperty.propertyType === 'multiUnit' || selectedProperty.propertyType === 'MultiUnit') &&
                    selectedProperty.units?.length > 0 && (
                      <Grid size={{ xs: 12 }}>
                        <FormControl fullWidth>
                          <InputLabel>Unit (Optional)</InputLabel>
                          <Select
                            value={initialForm.unitId || ''}
                            onChange={(e) => setInitialForm(prev => ({ ...prev, unitId: e.target.value || '' }))}
                            label="Unit (Optional)"
                          >
                            <MenuItem value="">
                              <em>None</em>
                            </MenuItem>
                            {selectedProperty.units.map((unit) => (
                              <MenuItem key={unit.id} value={unit.id}>
                                {unit.name || `Unit ${unit.id}`}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                </Grid>
              </Box>

              <Divider />

              {/* Selected Tenant Display */}
              {selectedTenantFromModal && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Selected Tenant
                  </Typography>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      borderColor: theme.palette.primary.main,
                      borderWidth: 1,
                      borderStyle: 'solid'
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar 
                        sx={{ 
                          bgcolor: theme.palette.primary.main,
                          width: 40,
                          height: 40
                        }}
                      >
                        {(selectedTenantFromModal.firstname?.[0] || selectedTenantFromModal.firstName?.[0] || selectedTenantFromModal.lastname?.[0] || selectedTenantFromModal.lastName?.[0] || '?').toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" fontWeight={500}>
                          {`${selectedTenantFromModal.firstname || selectedTenantFromModal.firstName || ''} ${selectedTenantFromModal.lastname || selectedTenantFromModal.lastName || ''}`.trim() || 'Unnamed Tenant'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedTenantFromModal.email || 'No email address'}
                        </Typography>
                      </Box>
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          setSelectedTenantFromModal(null);
                          setInitialForm(prev => ({ ...prev, email: '' }));
                          setFieldValue('selectedTenantId', null);
                        }}
                        sx={{ color: 'text.secondary' }}
                      >
                        <CloseOutlined />
                      </IconButton>
                    </Stack>
                  </Paper>
                </Box>
              )}

              {/* Email Input */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1.25, color: isDarkMode ? '#FFFFFF' : 'text.primary', fontWeight: 700 }}>
                  Tenant Email
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? 'rgba(255, 255, 255, 0.68)' : 'text.secondary' }}>
                  We will send the secure application link to this address.
                </Typography>
                <TextField
                  fullWidth
                  label="Email Address *"
                  type="email"
                  value={initialForm.email}
                  onChange={(e) => {
                    setInitialForm(prev => ({ ...prev, email: e.target.value }));
                    // Clear selected tenant if email is manually changed
                    if (selectedTenantFromModal && e.target.value !== selectedTenantFromModal.email) {
                      setSelectedTenantFromModal(null);
                      setFieldValue('selectedTenantId', null);
                    }
                  }}
                  placeholder="tenant@example.com"
                />
              </Box>

              {/* Fill Out Myself Option */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: fillOutMyself
                    ? isDarkMode ? 'rgba(126, 227, 163, 0.1)' : alpha(theme.palette.primary.main, 0.06)
                    : isDarkMode ? 'rgba(255, 255, 255, 0.055)' : 'background.default',
                  border: `1px solid ${
                    fillOutMyself
                      ? isDarkMode ? 'rgba(126, 227, 163, 0.55)' : alpha(theme.palette.primary.main, 0.42)
                      : isDarkMode ? 'rgba(255, 255, 255, 0.16)' : theme.palette.divider
                  }`,
                  borderRadius: 1,
                  transition: 'background-color 160ms ease, border-color 160ms ease'
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={fillOutMyself}
                      onChange={(e) => setFillOutMyself(e.target.checked)}
                      sx={{
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.62)' : 'text.secondary',
                        '&.Mui-checked': { color: isDarkMode ? '#7EE3A3' : 'primary.main' }
                      }}
                    />
                  }
                  label="I'll fill out the application for the tenant"
                  sx={{
                    m: 0,
                    alignItems: 'flex-start',
                    '& .MuiFormControlLabel-label': { color: isDarkMode ? '#FFFFFF' : 'text.primary', fontWeight: 600, pt: 0.9 }
                  }}
                />
                <Typography variant="body2" sx={{ mt: 0.75, ml: 4.5, color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary', lineHeight: 1.55 }}>
                  {fillOutMyself 
                    ? 'You will fill out the complete application form on behalf of the tenant.'
                    : 'An email invite will be sent to the tenant to complete the application themselves.'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Divider />
          <Box
            sx={{
              px: { xs: 2.5, sm: 3.5 },
              py: 2.25,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1.5,
              bgcolor: isDarkMode ? 'rgba(2, 18, 32, 0.76)' : 'background.paper',
              boxShadow: isDarkMode ? '0 -12px 30px rgba(0, 0, 0, 0.18)' : '0 -10px 28px rgba(6, 30, 53, 0.07)'
            }}
          >
            <Button
              variant="outlined"
              onClick={() => {
                drawer.closeApplicationAddDrawer();
                setInitialForm({ email: '', propertyId: '', unitId: '' });
              }}
              disabled={loading}
              startIcon={<CloseOutlined style={{ fontSize: 16, color: 'inherit' }} />}
              sx={{
                color: isDarkMode ? 'rgba(255, 255, 255, 0.86)' : 'text.secondary',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'divider',
                textTransform: 'none',
                minHeight: 42,
                px: 2,
                '&:hover': {
                  color: isDarkMode ? '#FFFFFF' : 'primary.main',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.58)' : 'primary.main',
                  bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : alpha(theme.palette.primary.main, 0.05)
                },
                '&:disabled': {
                  color: 'text.disabled'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={loading || !initialForm.email || !selectedProperty?.id}
              onClick={handleInitialSubmit}
              startIcon={loading ? <CircularProgress size={16} /> : fillOutMyself ? undefined : <SendOutlined style={{ fontSize: 16, color: 'inherit' }} />}
              sx={{
                color: isDarkMode ? '#061E35' : 'primary.contrastText',
                bgcolor: isDarkMode ? '#7EE3A3' : 'primary.main',
                fontWeight: 700,
                textTransform: 'none',
                minHeight: 42,
                px: 2.5,
                boxShadow: isDarkMode ? '0 10px 24px rgba(126, 227, 163, 0.2)' : `0 10px 24px ${alpha(theme.palette.primary.main, 0.22)}`,
                '&:hover': {
                  bgcolor: isDarkMode ? '#96E9B4' : 'primary.dark',
                  boxShadow: isDarkMode ? '0 12px 28px rgba(126, 227, 163, 0.3)' : `0 12px 28px ${alpha(theme.palette.primary.main, 0.3)}`
                },
                '&:disabled': {
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'action.disabled',
                  bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'action.disabledBackground',
                  boxShadow: 'none'
                }
              }}
            >
              {loading 
                ? (fillOutMyself ? 'Loading...' : 'Sending...') 
                : fillOutMyself 
                  ? 'Continue to Application Form' 
                  : 'Send Invite'}
            </Button>
          </Box>
        </>
      ) : (
        // Full Application Form
        <FormikProvider value={formik}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ display: 'contents' }}>
              {/* Header */}
              <Toolbar sx={{ px: 2.5 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  New Rental Application
                </Typography>
                <IconButton onClick={() => {
                  setShowFullForm(false);
                  setInitialForm({ email: '', propertyId: '', unitId: '' });
                }} size="large">
                  <CloseOutlined />
                </IconButton>
              </Toolbar>
              <Divider />

              {/* Content */}
              <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
                <Stack spacing={3}>
                {/* Tenant Selection (Optional) */}
                {tenantOptions.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                      Select Existing Tenant (Optional)
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      If the applicant already has a tenant account, select them to auto-fill their information.
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <Autocomplete
                          options={[{ id: null, label: 'New Applicant' }, ...tenantOptions]}
                          width="100%"
                          label="Select Tenant"
                          value={tenantOptions.find((opt) => opt.id === values.selectedTenantId) || { id: null, label: 'New Applicant' }}
                          onChange={(_, value) => {
                            setFieldValue('selectedTenantId', value?.id || null);
                            // Clear fields if "New Applicant" is selected
                            if (!value || !value.id) {
                              setFieldValue('firstName', '');
                              setFieldValue('lastName', '');
                              setFieldValue('email', '');
                              setFieldValue('phoneNumber', '');
                            }
                          }}
                          isOptionEqualToValue={(opt, val) => String(opt?.id) === String(val?.id)}
                          getOptionLabel={(option) => {
                            if (!option || option.id === null) return 'New Applicant';
                            const email = option.email ? ` (${option.email})` : '';
                            return `${option.label}${email}`;
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Property/Unit Selection */}
                <Box> 
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <PropertySelect width="100%" disableAllOption={true} />
                      {touched.propertyId && errors.propertyId && (
                        <FormHelperText error sx={{ mt: 0.5, ml: 1.75 }}>
                          {errors.propertyId}
                        </FormHelperText>
                      )}
                    </Grid>
                    {selectedProperty && 
                     (selectedProperty.propertyType === 'multiUnit' || selectedProperty.propertyType === 'MultiUnit') && 
                     unitOptions.length > 0 && (
                      <Grid size={{ xs: 12 }}>
                        <FormControl fullWidth error={touched.unitId && !!errors.unitId}>
                          <InputLabel>Unit</InputLabel>
                          <Select
                            {...getFieldProps('unitId')}
                            label="Unit"
                            value={values.unitId || ''}
                            onChange={(e) => setFieldValue('unitId', e.target.value || null)}
                          >
                            <MenuItem value="">
                              <em>None</em>
                            </MenuItem>
                            {unitOptions.map((unit) => (
                              <MenuItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </MenuItem>
                            ))}
                          </Select>
                          {touched.unitId && errors.unitId && (
                            <FormHelperText>{errors.unitId}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                    )}
                  </Grid>
                </Box>

                <Divider />

                {/* Applicant Information */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Applicant Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('firstName')}
                        label="First Name *"
                        errorText={errors.firstName}
                        touched={touched.firstName}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('lastName')}
                        label="Last Name *"
                        errorText={errors.lastName}
                        touched={touched.lastName}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('email')}
                        label="Email *"
                        type="email"
                        errorText={errors.email}
                        touched={touched.email}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('phoneNumber')}
                        label="Phone Number"
                        valueType="phone"
                        errorText={errors.phoneNumber}
                        touched={touched.phoneNumber}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box>
                        <InputLabel htmlFor="dateOfBirth-input" sx={{ mb: 1 }}>
                          Date of Birth
                        </InputLabel>
                        <DatePicker
                          value={values.dateOfBirth}
                          onChange={(newValue) => setFieldValue('dateOfBirth', newValue)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              size: 'small',
                              id: 'dateOfBirth-input',
                              name: 'dateOfBirth',
                              error: touched.dateOfBirth && !!errors.dateOfBirth,
                              sx: {
                                '& .MuiPickersOutlinedInput-root': {
                                  height: '32px'
                                }
                              }
                            }
                          }}
                        />
                        {touched.dateOfBirth && errors.dateOfBirth && (
                          <FormHelperText error sx={{ mt: 0.5, mb: 0 }}>
                            {errors.dateOfBirth}
                          </FormHelperText>
                        )}
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('ssn')}
                        label="SSN (Last 4 digits)"
                        placeholder="XXXX"
                        errorText={errors.ssn}
                        touched={touched.ssn}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <FormInput
                        {...getFieldProps('currentAddress')}
                        label="Current Address"
                        errorText={errors.currentAddress}
                        touched={touched.currentAddress}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormInput
                        {...getFieldProps('currentCity')}
                        label="City"
                        errorText={errors.currentCity}
                        touched={touched.currentCity}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormInput
                        {...getFieldProps('currentState')}
                        label="State"
                        errorText={errors.currentState}
                        touched={touched.currentState}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormInput
                        {...getFieldProps('currentZipCode')}
                        label="Zip Code"
                        errorText={errors.currentZipCode}
                        touched={touched.currentZipCode}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Employment Information */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Employment Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('employerName')}
                        label="Employer Name"
                        errorText={errors.employerName}
                        touched={touched.employerName}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('jobTitle')}
                        label="Job Title"
                        errorText={errors.jobTitle}
                        touched={touched.jobTitle}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('monthlyIncome')}
                        label="Monthly Income"
                        valueType="currency"
                        errorText={errors.monthlyIncome}
                        touched={touched.monthlyIncome}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormNumberInput
                        {...getFieldProps('employmentMonths')}
                        label="Employment Duration (Months)"
                        setFieldValue={setFieldValue}
                        errorText={errors.employmentMonths}
                        touched={touched.employmentMonths}
                        min={0}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* References */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    References
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormInput
                        {...getFieldProps('emergencyContactName')}
                        label="Emergency Contact Name"
                        errorText={errors.emergencyContactName}
                        touched={touched.emergencyContactName}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormInput
                        {...getFieldProps('emergencyContactPhone')}
                        label="Emergency Contact Phone"
                        valueType="phone"
                        errorText={errors.emergencyContactPhone}
                        touched={touched.emergencyContactPhone}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormInput
                        {...getFieldProps('emergencyContactRelationship')}
                        label="Relationship"
                        errorText={errors.emergencyContactRelationship}
                        touched={touched.emergencyContactRelationship}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('previousLandlordName')}
                        label="Previous Landlord Name"
                        errorText={errors.previousLandlordName}
                        touched={touched.previousLandlordName}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        {...getFieldProps('previousLandlordPhone')}
                        label="Previous Landlord Phone"
                        valueType="phone"
                        errorText={errors.previousLandlordPhone}
                        touched={touched.previousLandlordPhone}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Application Details */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Application Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        {...getFieldProps('numberOfOccupants')}
                        label="Number of Occupants"
                        type="number"
                        fullWidth
                        size="small"
                        error={touched.numberOfOccupants && !!errors.numberOfOccupants}
                        helperText={touched.numberOfOccupants && errors.numberOfOccupants}
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box>
                        <InputLabel htmlFor="desiredMoveInDate-input" sx={{ mb: 1 }}>
                          Desired Move-In Date
                        </InputLabel>
                        <DatePicker
                          value={values.desiredMoveInDate}
                          onChange={(newValue) => setFieldValue('desiredMoveInDate', newValue)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              size: 'small',
                              id: 'desiredMoveInDate-input',
                              error: touched.desiredMoveInDate && !!errors.desiredMoveInDate,
                              sx: {
                                '& .MuiOutlinedInput-root': {
                                  height: '32px'
                                }
                              }
                            }
                          }}
                        />
                        {touched.desiredMoveInDate && errors.desiredMoveInDate && (
                          <FormHelperText error sx={{ mt: 0.5, mb: 0 }}>
                            {errors.desiredMoveInDate}
                          </FormHelperText>
                        )}
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={values.hasPets}
                            onChange={(e) => setFieldValue('hasPets', e.target.checked)}
                          />
                        }
                        label="Has Pets"
                      />
                    </Grid>
                    {values.hasPets && (
                      <Grid size={{ xs: 12 }}>
                        <FormInput
                          {...getFieldProps('petDetails')}
                          label="Pet Details"
                          multiline
                          rows={3}
                          placeholder="Type, breed, size, etc."
                          errorText={errors.petDetails}
                          touched={touched.petDetails}
                        />
                      </Grid>
                    )}
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={values.hasVehicles}
                            onChange={(e) => setFieldValue('hasVehicles', e.target.checked)}
                          />
                        }
                        label="Has Vehicles"
                      />
                    </Grid>
                    {values.hasVehicles && (
                      <Grid size={{ xs: 12 }}>
                        <FormInput
                          {...getFieldProps('vehicleDetails')}
                          label="Vehicle Details"
                          multiline
                          rows={3}
                          placeholder="Make, model, license plate, etc."
                          errorText={errors.vehicleDetails}
                          touched={touched.vehicleDetails}
                        />
                      </Grid>
                    )}
                    <Grid size={{ xs: 12 }}>
                      <FormInput
                        {...getFieldProps('additionalNotes')}
                        label="Additional Notes"
                        multiline
                        rows={4}
                        errorText={errors.additionalNotes}
                        touched={touched.additionalNotes}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Status Selection */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Application Status
                  </Typography>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      {...getFieldProps('status')}
                      label="Status"
                      value={values.status}
                      onChange={(e) => setFieldValue('status', e.target.value)}
                    >
                      <MenuItem value={0}>Draft</MenuItem>
                      <MenuItem value={1}>Submitted</MenuItem>
                    </Select>
                    <FormHelperText>
                      Select "Draft" to save for later, or "Submitted" to mark as ready for review.
                    </FormHelperText>
                  </FormControl>
                </Box>
              </Stack>
            </Box>

                  {/* Footer */}
                  <Divider />
                  <Toolbar sx={{ px: 2.5, justifyContent: 'space-between' }}>
                    <Button
                      variant="text"
                      onClick={() => {
                        setShowFullForm(false);
                        setInitialForm({ email: '', propertyId: '', unitId: '' });
                      }}
                      startIcon={<CloseOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                      sx={{
                        color: 'text.secondary',
                        textTransform: 'none',
                        minWidth: 'auto',
                        px: 1,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.common.black, 0.04)
                        }
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      variant="text"
                      disabled={isSubmitting || loading}
                      startIcon={<SendOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                      sx={{
                        color: 'primary.main',
                        textTransform: 'none',
                        minWidth: 'auto',
                        px: 1,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08)
                        },
                        '&:disabled': {
                          color: 'text.disabled'
                        }
                      }}
                    >
                      {isSubmitting || loading
                        ? 'Saving...'
                        : values.status === 1
                        ? 'Submit Application'
                        : 'Save as Draft'}
                    </Button>
                  </Toolbar>
                </Form>
              </LocalizationProvider>
            </FormikProvider>
          )}

      {/* Tenant Selection Modal */}
      <Dialog
        open={showTenantSelectionModal}
        onClose={handleBypassTenantSelection}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Select Existing Tenant</Typography>
            <IconButton size="small" onClick={handleBypassTenantSelection}>
              <CloseOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {filteredTenantsForProperty.length > 0 ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                There are existing tenants connected to this property{pendingUnitId ? ' and unit' : ''}. Select a tenant to send the application to, or enter the email manually.
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List>
                  {filteredTenantsForProperty.map((tenant) => {
                    const firstname = tenant.firstname || tenant.firstName || '';
                    const lastname = tenant.lastname || tenant.lastName || '';
                    const fullName = `${firstname} ${lastname}`.trim() || 'Unnamed Tenant';
                    const initials = firstname?.[0]?.toUpperCase() || lastname?.[0]?.toUpperCase() || '?';
                    const tenantEmail = tenant.email || '';
                    const hasPending = hasPendingApplication(tenantEmail, pendingPropertyId, pendingUnitId);
                    
                    return (
                      <ListItem 
                        key={tenant.id} 
                        disablePadding
                        secondaryAction={
                          hasPending && (
                            <Tooltip title="Resend Invite Email">
                              <IconButton
                                edge="end"
                                size="small"
                                color="success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResendInviteForTenant(tenant);
                                }}
                                sx={{ 
                                  color: 'success.main',
                                  '&:hover': { 
                                    backgroundColor: 'success.lighter',
                                    color: 'success.dark'
                                  }
                                }}
                              >
                                <SendOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )
                        }
                      >
                        <ListItemButton 
                          onClick={() => !hasPending && handleSelectTenant(tenant)}
                          disabled={hasPending}
                          sx={{
                            opacity: hasPending ? 0.5 : 1,
                            cursor: hasPending ? 'not-allowed' : 'pointer',
                            '&:hover': {
                              backgroundColor: hasPending ? 'transparent' : undefined
                            }
                          }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: hasPending ? 'grey.400' : 'primary.main' }}>
                              {initials}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  color: hasPending ? 'text.disabled' : 'text.primary',
                                  fontWeight: 500
                                }}
                              >
                                {fullName}
                              </Typography>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" color={hasPending ? 'text.disabled' : 'text.secondary'}>
                                  {tenantEmail || 'No email address'}
                                </Typography>
                                {hasPending && (
                                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                                    Already has a pending application for this property{pendingUnitId ? '/unit' : ''}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No tenants found for this property{pendingUnitId ? ' and unit' : ''}. Please enter the email address manually.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleBypassTenantSelection} variant="outlined">
            Enter Email Manually
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeAdaptiveDrawer>
  );
}

