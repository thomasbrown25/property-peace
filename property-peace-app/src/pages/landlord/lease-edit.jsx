import { useEffect, useMemo, useState, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

// material-ui
import {
  Box,
  Typography,
  Stack,
  Divider,
  Grid,
  Paper,
  Button,
  Card,
  CardContent,
  IconButton,
  alpha,
  CircularProgress,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  FormHelperText,
  Chip,
  RadioGroup,
  Radio,
  FormLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  useTheme
} from '@mui/material';
import {
  ArrowLeftOutlined,
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  MailOutlined,
  PhoneOutlined,
  CheckOutlined,
  CloseOutlined,
  HomeOutlined,
  FileTextOutlined,
  UserAddOutlined,
  SearchOutlined
} from '@ant-design/icons';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider, FieldArray } from 'formik';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// project imports
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import Autocomplete from 'components/@extended/AutoComplete';
import { openSnackbar } from 'api/snackbar';
import { formatCurrency, formatPhone, formatPhoneInput } from 'utils/formatters';
import { useDrawer } from 'contexts/DrawerContext';
import TenantEditDrawer from 'components/drawers/TenantEditDrawer';
import AddTenantDialog from 'components/dialogs/AddTenantDialog';
import { tenantInviteAPI } from 'api';
import { strengthColor, strengthIndicator } from 'utils/password-strength';
import axiosServices from 'utils/axios';
import { getActiveOrganizationId } from 'utils/impersonationSession';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';

// hooks
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import useIsSingleUnitProfile from 'hooks/useIsSingleUnitProfile';
import useFetchAllTenants from 'hooks/useFetchAllTenants';

// selectors
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { selectLease } from 'store/lease/lease.selector';
import { selectTenants } from 'store/tenant/tenant.selector';

// actions
import { addOrUpdateLease, setLease } from 'store/lease/lease.action';
import { setProperty } from 'store/property/property.action';
import { setUnit } from 'store/unit/unit.action';
import { addOrUpdateTenant, deleteTenant } from 'store/tenant/tenant.action';

// options
import { leaseLengthOptions, rentDueDayOptions, rentFrequencyOptions } from 'utils/models';
import { useSWRConfig } from 'swr';
import { dashboardEndpoints } from 'api/dashbord';

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const toInputDate = (d) => (d instanceof Date ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

// ---------- validation ----------
const LeaseSchema = Yup.object().shape({
  propertyId: Yup.mixed().required('Property is required'),
  unitId: Yup.mixed().nullable(),
  leaseStartDate: Yup.string().required('Lease start date is required'),
  leaseEndDate: Yup.string().required('Lease end date is required'),
  rentFrequency: Yup.string().oneOf(['monthly', 'quarterly', 'yearly']).required(),
  rentDueDay: Yup.number().min(1).max(31).required('Rent due day is required'),
  leaseLength: Yup.number().min(0).required('Lease length is required'),
  rentAmount: Yup.number().typeError('Enter a valid amount').min(0).required('Rent amount is required'),
  tenants: Yup.array().of(
    Yup.object().shape({
      id: Yup.number().nullable(),
      userId: Yup.number().nullable(),
      firstname: Yup.string().required('First name is required'),
      lastname: Yup.string().required('Last name is required'),
      email: Yup.string()
        .when(['createAccount', 'userId'], {
          is: (createAccount, userId) => createAccount === true && !userId,
          then: (schema) => schema.required('Email is required when creating an account').email('Invalid email'),
          otherwise: (schema) => schema.email('Invalid email').nullable()
        }),
      phoneNumber: Yup.string().nullable(),
      createAccount: Yup.boolean(),
      password: Yup.string().when(['createAccount', 'userId'], {
        is: (createAccount, userId) => createAccount === true && !userId,
        then: (schema) => schema.required('Password is required').min(6, 'Password must be at least 6 characters'),
        otherwise: (schema) => schema.nullable()
      })
    })
  )
});

export default function LeaseEditPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const { isSingleUnitProfile } = useIsSingleUnitProfile();
  const { propertiesRefetch } = useFetchProperties();

  const properties = useSelector(selectProperties);
  const selectedProperty = useSelector(selectProperty);
  const allTenants = useSelector(selectTenants) || [];
  const { isLoading: loadingTenants } = useFetchAllTenants();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [sendingInvite, setSendingInvite] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [passwordLevels, setPasswordLevels] = useState({});
  const [editingTenantIndex, setEditingTenantIndex] = useState(null); // Track which tenant is being edited
  const [tenantHasAccount, setTenantHasAccount] = useState({}); // Map of userId -> hasAccount (boolean)
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [tenantToRemove, setTenantToRemove] = useState(null); // { index, tenant }
  const [tenantInvites, setTenantInvites] = useState({}); // Map of tenantId -> invites array
  const [originalAccountMethods, setOriginalAccountMethods] = useState({}); // Map of tenantId -> 'invite' | 'create' | null
  const [resendingInvites, setResendingInvites] = useState({}); // Map of tenantId -> boolean
  const prevTenantEditDrawerOpen = useRef(drawer.isOpenTenantEdit);
  const [addTenantDialogOpen, setAddTenantDialogOpen] = useState(false);
  const [addExistingTenantDialogOpen, setAddExistingTenantDialogOpen] = useState(false);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const processedTenantsRef = useRef(new Map()); // Track tenants we've processed in current submission (key -> { userId })

  // Find the lease from properties
  const currentLease = useMemo(() => {
    if (!properties) return null;
    return properties
      ?.flatMap((p) =>
        (p.units || [])
          .filter((u) => u.lease)
          .map((u) => ({
            ...u.lease,
            unit: u,
            propertyName: p.name,
            propertyId: p.id,
            unitId: u.id
          }))
      )
      ?.find((l) => l?.id?.toString() === leaseId);
  }, [properties, leaseId]);

  // Set lease and property in Redux on mount, and check which tenants have accounts
  useEffect(() => {
    if (currentLease) {
      const property = properties?.find((p) => p.id === currentLease.propertyId);
      if (property) {
        dispatch(setProperty(property));
        // Set unit if available
        if (currentLease.unitId) {
          const unit = property.units?.find((u) => u.id === currentLease.unitId);
          if (unit) {
            dispatch(setUnit(unit));
          }
        }
      }
      dispatch(setLease(currentLease));

      // Check which tenants have accounts (userId exists in UserRoles)
      const checkTenantAccounts = async () => {
        const tenantsWithUserId = (currentLease.tenants || []).filter((t) => t.userId).map((t) => t.userId);

        if (tenantsWithUserId.length > 0) {
          try {
            const response = await axiosServices.post('/api/user/check-accounts', tenantsWithUserId);
            if (response.data?.success && response.data?.data) {
              setTenantHasAccount(response.data.data);
            }
          } catch (error) {
            console.error('Error checking tenant accounts:', error);
          }
        }
      };

      checkTenantAccounts();
      setLoading(false);
    } else if (properties && properties.length > 0) {
      setLoading(false);
    }
  }, [currentLease, properties, dispatch]);

  const propertyOptions = useMemo(
    () =>
      (properties || []).map((p) => ({
        value: Number(p.value ?? p.id),
        label: p.label ?? p.name ?? String(p.id)
      })),
    [properties]
  );

  // Build initial values from existing lease
  const initialValues = useMemo(() => {
    if (!currentLease) return {};
    return {
      propertyId: currentLease.propertyId || selectedProperty?.id || '',
      unitId: currentLease.unitId || '',
      leaseStartDate: toInputDate(new Date(currentLease.startDate)),
      leaseEndDate: toInputDate(new Date(currentLease.endDate)),
      rentFrequency: currentLease.rentFrequency?.toLowerCase() ?? 'monthly',
      rentDueDay: currentLease.rentDueDay ?? 1,
      leaseLength: currentLease.leaseLength ?? 12,
      rentAmount: currentLease.rentAmount ?? '',
      tenants: (currentLease.tenants || []).map((t) => {
        const hasAccount = t.userId && tenantHasAccount[t.userId] === true;
        return {
          id: t.id,
          firstname: t.firstname || t.firstName || '',
          lastname: t.lastname || t.lastName || '',
          email: t.email || '',
          phoneNumber: t.phoneNumber || t.phone || '',
          userId: t.userId || null,
          createAccount: hasAccount || false, // Set to true if account exists
          password: ''
        };
      })
    };
  }, [currentLease, selectedProperty, tenantHasAccount]);

  const formik = useFormik({
    initialValues,
    validationSchema: LeaseSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, setTouched, setFieldError, setFieldTouched }) => {
      console.log('Form submission started', { values, currentLease });
      
      // Clear processed tenants tracking for this submission
      processedTenantsRef.current.clear();
      // Mark all fields as touched so validation errors show
      const allTouched = {};
      if (values.tenants) {
        values.tenants.forEach((_, index) => {
          allTouched[`tenants.${index}.firstname`] = true;
          allTouched[`tenants.${index}.lastname`] = true;
          allTouched[`tenants.${index}.email`] = true;
          allTouched[`tenants.${index}.phoneNumber`] = true;
          allTouched[`tenants.${index}.password`] = true;
        });
      }
      setTouched(allTouched, false);

      try {
        if (!currentLease || !currentLease.id) {
          console.error('Current lease is missing:', currentLease);
          openSnackbar({
            open: true,
            message: 'Lease not found. Please refresh the page.',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setSubmitting(false);
          return;
        }

        const property = properties.find((p) => Number(p.id) === Number(values.propertyId));

        if (!property) {
          openSnackbar({
            open: true,
            message: 'Property not found. Please select a valid property.',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setSubmitting(false);
          return;
        }

        // Check if property is single family
        const propertyType = property?.propertyType?.toLowerCase();
        const isPropertySingleFamily = propertyType === 'singlefamily' || propertyType === 'single-family';

        // Update lease (preserve organizationId so it is never sent as null)
        const organizationId = currentLease?.organizationId ?? currentLease?.OrganizationId ?? property?.organizationId ?? getActiveOrganizationId(user);
        const payload = {
          Id: currentLease.id,
          PropertyId: Number(currentLease.propertyId),
          UnitId: isPropertySingleFamily ? property?.units?.[0]?.id || 0 : Number(currentLease.unitId || 0),
          StartDate: new Date(currentLease.startDate),
          EndDate: new Date(currentLease.endDate),
          RentAmount: Number(values.rentAmount),
          LeaseLength: Number(currentLease.leaseLength),
          RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          RentDueDay: Number(values.rentDueDay),
          ...(organizationId != null && organizationId !== '' && { organizationId: Number(organizationId) })
        };

        await dispatch(addOrUpdateLease(payload));

        // Validate email uniqueness before creating tenants
        // Check all tenant emails against Users table and Tenants table
        for (const tenant of values.tenants) {
          if (tenant.email && tenant.email.trim()) {
            const tenantEmail = tenant.email.trim();
            
            // Skip validation if this is an existing tenant with the same email
            const existingUserId = tenant.userId || tenant.UserId;
            if (tenant.id && existingUserId) {
              // Existing tenant with account - skip email check
              continue;
            }
            
            try {
              // Check if email exists in Users or Tenants table
              const emailCheckResponse = await axiosServices.get(`/api/tenant/check-email/${encodeURIComponent(tenantEmail)}`);
              
              if (emailCheckResponse.data?.success && emailCheckResponse.data?.data === true) {
                const tenantIndex = values.tenants.indexOf(tenant);
                const errorMsg = 'A user or tenant with this email already exists.';
                setFieldError(`tenants.${tenantIndex}.email`, errorMsg);
                setFieldTouched(`tenants.${tenantIndex}.email`, true);
                
                openSnackbar({
                  open: true,
                  message: `Cannot add tenant: ${errorMsg}`,
                  variant: 'alert',
                  alert: { color: 'error' }
                });
                
                setSubmitting(false);
                return;
              }
            } catch (emailCheckError) {
              // If there's an error checking email, log it but continue
              // The backend will also validate during tenant creation
              console.warn('Error checking email existence:', emailCheckError);
            }
          }
        }

        // Track which tenants were newly added (existing tenants with accounts)
        const newlyAddedTenants = [];

        // Update/add tenants
        for (const tenant of values.tenants) {
          const tenantPayload = {
            Id: tenant.id || null,
            LeaseId: currentLease.id,
            UnitId: isPropertySingleFamily ? property?.units?.[0]?.id || 0 : Number(values.unitId || 0),
            Firstname: tenant.firstname,
            Lastname: tenant.lastname,
            Email: tenant.email || null,
            PhoneNumber: tenant.phoneNumber || null
          };

          // Preserve existing userId if tenant already has an account
          const existingUserId = tenant.userId || tenant.UserId;
          const wasExistingTenant = !!existingUserId;
          if (existingUserId) {
            tenantPayload.UserId = existingUserId;
          }

          // If createAccount is enabled and password is provided, create user account first
          if (tenant.createAccount && tenant.password && tenant.email && !existingUserId) {
            // Create a unique key for this tenant to prevent duplicate processing
            const tenantKey = `${tenant.email}_${tenant.firstname}_${tenant.lastname}`;
            
            // Check if we already processed this tenant in this submission
            if (processedTenantsRef.current.has(tenantKey)) {
              console.log('Account already created for this tenant in this submission, skipping:', tenant.email);
              // Get the userId from the ref
              const savedData = processedTenantsRef.current.get(tenantKey);
              if (savedData?.userId) {
                tenantPayload.UserId = savedData.userId;
              }
            } else {
              try {
                console.log('Creating user account for tenant:', tenant.email);
                // Get organization ID from current user (landlord)
                const organizationId = getActiveOrganizationId(user);
                const registerResponse = await axiosServices.post('/api/user/register', {
                email: tenant.email.trim(),
                password: tenant.password,
                firstName: tenant.firstname,
                lastName: tenant.lastname,
                phoneNumber: tenant.phoneNumber || null,
                roles: ['Tenant'],
                organizationId: organizationId ? Number(organizationId) : null
              });

                // Handle both Id and id (case sensitivity)
                const userId = registerResponse.data?.data?.Id || registerResponse.data?.data?.id;
                if (registerResponse.data?.success && userId) {
                  // Link the user to the tenant by including userId in the payload
                  tenantPayload.UserId = userId;
                  // Store in ref to prevent duplicate calls in this submission
                  processedTenantsRef.current.set(tenantKey, { userId });
                  console.log('✅ Created user account and linked to tenant:', { userId, tenantId: tenant.id });
                } else {
                // User registration didn't return a userId - this is an error
                const errorMsg = registerResponse.data?.message || 'User account could not be created. No user ID returned.';
                throw new Error(errorMsg);
              }
            } catch (userError) {
              console.error('Error creating user account:', userError);
              
              // Extract error message from response
              let errorMessage = 'User account could not be created.';
              if (userError?.response?.data) {
                const errorData = userError.response.data;
                // Try to get detailed error message
                if (errorData.errors) {
                  const errors = errorData.errors;
                  if (typeof errors === 'object' && errors !== null) {
                    errorMessage = errors.message || errors.Message || errorData.message || errorData.Message || errorMessage;
                  } else if (typeof errors === 'string') {
                    errorMessage = errors;
                  }
                } else if (errorData.message || errorData.Message) {
                  errorMessage = errorData.message || errorData.Message;
                }
              } else if (userError?.message) {
                errorMessage = userError.message;
              }

              // Set formik error for the tenant's email field
              const tenantIndex = values.tenants.indexOf(tenant);
              if (tenantIndex >= 0) {
                setFieldError(`tenants.${tenantIndex}.email`, errorMessage);
              }

              openSnackbar({
                open: true,
                message: `User account could not be created: ${errorMessage}`,
                variant: 'alert',
                alert: { color: 'error' }
              });
              
                // Stop tenant creation if user account creation fails
                setSubmitting(false);
                return;
              }
            }
          }

          // Save tenant (with userId if account was created)
          // The backend will check if email exists and return 400 if it does
          try {
            await dispatch(addOrUpdateTenant(tenantPayload));
          } catch (tenantError) {
            // Check for email-related errors (email already exists, user already exists, etc.)
            const errors = tenantError?.response?.data?.errors;
            const errorMessage =
              typeof errors === 'object' && errors !== null
                ? errors.message || errors.Message || ''
                : tenantError?.response?.data?.message || tenantError?.response?.data?.Message || '';

            const errorMessageLower = String(errorMessage).toLowerCase();
            
            // Check for various email-related error messages
            const isEmailError = tenantError?.response?.status === 400 && (
              errorMessageLower.includes('email') && errorMessageLower.includes('already exists') ||
              errorMessageLower.includes('user already exists') ||
              errorMessageLower.includes('a user with that email') ||
              errorMessageLower.includes('email already exists')
            );

            if (isEmailError) {
              const tenantIndex = values.tenants.indexOf(tenant);
              if (tenantIndex >= 0) {
                const displayMessage = errorMessage || 'A user with this email already exists';
                setFieldError(`tenants.${tenantIndex}.email`, displayMessage);
                setFieldTouched(`tenants.${tenantIndex}.email`, true);
              }
              
              openSnackbar({
                open: true,
                message: `Email validation failed: ${errorMessage || 'A user with this email already exists'}`,
                variant: 'alert',
                alert: { color: 'error' }
              });
              
              // Skip this tenant, continue with others
              continue;
            }
            // For other errors, re-throw to be handled by outer catch
            throw tenantError;
          }
        }

        // Clear processed tenants tracking after successful submission
        processedTenantsRef.current.clear();

        // Send lease added notifications to existing tenants who were newly added
        for (const { tenantId, leaseId } of newlyAddedTenants) {
          try {
            await axiosServices.post(`/api/lease/${leaseId}/notify-tenant/${tenantId}`);
          } catch (notifyError) {
            console.error(`Error sending lease added notification to tenant ${tenantId}:`, notifyError);
            // Don't fail the save if notification fails
          }
        }

        await mutate(dashboardEndpoints.summary(user.id));
        await propertiesRefetch();

        // Refresh tenant account status after saving
        if (currentLease) {
          const tenantsWithUserId = (values.tenants || [])
            .filter((t) => t.userId || t.UserId)
            .map((t) => t.userId || t.UserId)
            .filter((id) => id != null);

          if (tenantsWithUserId.length > 0) {
            try {
              const response = await axiosServices.post('/api/user/check-accounts', tenantsWithUserId);
              if (response.data?.success && response.data?.data) {
                setTenantHasAccount(response.data.data);
              }
            } catch (error) {
              console.error('Error checking tenant accounts:', error);
            }
          }
        }

        openSnackbar({
          open: true,
          message: 'Lease updated successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Exit tenant edit mode if any tenant was being edited (inline editing)
        if (editingTenantIndex !== null) {
          setEditingTenantIndex(null);
        }

        // Close tenant edit drawer if it's open
        if (drawer.isOpenTenantEdit) {
          drawer.closeTenantEditDrawer();
        }

        // Navigate back to the lease page after successful save
        navigate(`/landlord/leases/${leaseId}`);
      } catch (error) {
        console.error(error);

        // Check if error is "User already exists" and show details, otherwise show generic message
        const isUserExistsError = error?.errors?.message === 'User already exists';
        const errorMessage = isUserExistsError ? error?.errors?.details : 'Failed to update lease.';

        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue, validateForm, submitCount } = formik;

  // Memoize setFieldValue callback to prevent tenant cards from re-rendering unnecessarily
  const memoizedSetFieldValue = useCallback(
    (name, value) => {
      setFieldValue(name, value);
    },
    [setFieldValue]
  );

  // Update tenant createAccount values when tenantHasAccount is loaded
  useEffect(() => {
    if (values.tenants && Object.keys(tenantHasAccount).length > 0) {
      values.tenants.forEach((tenant, index) => {
        if (tenant.userId) {
          const hasAccount = tenantHasAccount[tenant.userId] === true;
          if (hasAccount && !tenant.createAccount) {
            setFieldValue(`tenants.${index}.createAccount`, true);
          }
        }
      });
    }
  }, [tenantHasAccount, setFieldValue, values.tenants]);

  // Recompute end date when start/length changes
  useEffect(() => {
    const len = Number(values.leaseLength || 0);
    if (len === 0) return;
    const start = values.leaseStartDate ? new Date(values.leaseStartDate) : null;
    if (!start) return;
    const end = addMonths(start, len);
    const formatted = toInputDate(end);
    if (formatted !== values.leaseEndDate) {
      setFieldValue('leaseEndDate', formatted, false);
    }
  }, [values.leaseStartDate, values.leaseLength, values.leaseEndDate, setFieldValue]);

  // Unit options from selected property
  const currentProperty = useMemo(() => {
    if (selectedProperty?.id === Number(values.propertyId)) return selectedProperty;
    return properties?.find((p) => Number(p.id) === Number(values.propertyId));
  }, [selectedProperty, values.propertyId, properties]);

  // Check if current property is single family
  const isSingleFamilyProperty = useMemo(() => {
    if (!currentProperty) return false;
    const propertyType = currentProperty.propertyType?.toLowerCase();
    return propertyType === 'singlefamily' || propertyType === 'single-family';
  }, [currentProperty]);

  const unitOptions = useMemo(() => {
    if (!currentProperty?.units || currentProperty.units.length === 0) return [];
    return currentProperty.units.map((u) => ({
      label: u.name || `Unit ${u.id}`,
      id: u.id
    }));
  }, [currentProperty]);

  const selectedUnit = useMemo(() => {
    if (!values.unitId) return null;
    return unitOptions.find((u) => String(u.id) === String(values.unitId)) || null;
  }, [values.unitId, unitOptions]);

  // Auto-set unitId for single family properties, or clear if property changes
  useEffect(() => {
    if (currentProperty) {
      if (isSingleFamilyProperty) {
        // Auto-select first unit for single family properties
        const firstUnit = currentProperty.units?.[0];
        if (firstUnit && String(values.unitId) !== String(firstUnit.id)) {
          setFieldValue('unitId', firstUnit.id);
        }
      } else {
        // For multi-unit properties, check if current unitId is valid
        const currentUnit = currentProperty.units?.find((u) => String(u.id) === String(values.unitId));
        if (!currentUnit) {
          setFieldValue('unitId', '');
        }
      }
    }
  }, [currentProperty, isSingleFamilyProperty, setFieldValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch properties when tenant edit drawer closes
  useEffect(() => {
    if (prevTenantEditDrawerOpen.current && !drawer.isOpenTenantEdit) {
      propertiesRefetch();
      // Reload form values from updated properties
      const updatedLease = properties
        ?.flatMap((p) =>
          (p.units || [])
            .filter((u) => u.lease)
            .map((u) => ({
              ...u.lease,
              unit: u,
              propertyName: p.name,
              propertyId: p.id,
              unitId: u.id
            }))
        )
        ?.find((l) => l?.id?.toString() === leaseId);

      if (updatedLease && formik) {
        const updatedValues = {
          propertyId: updatedLease.propertyId || selectedProperty?.id || '',
          unitId: updatedLease.unitId || '',
          leaseStartDate: toInputDate(new Date(updatedLease.startDate)),
          leaseEndDate: toInputDate(new Date(updatedLease.endDate)),
          rentFrequency: updatedLease.rentFrequency?.toLowerCase() ?? 'monthly',
          rentDueDay: updatedLease.rentDueDay ?? 1,
          leaseLength: updatedLease.leaseLength ?? 12,
          rentAmount: updatedLease.rentAmount ?? '',
          tenants: (updatedLease.tenants || []).map((t) => ({
            id: t.id,
            firstname: t.firstname || t.firstName || '',
            lastname: t.lastname || t.lastName || '',
            email: t.email || '',
            phoneNumber: t.phoneNumber || t.phone || '',
            userId: t.userId || null,
            createAccount: false,
            password: ''
          }))
        };
        formik.setValues(updatedValues);
      }
    }
    prevTenantEditDrawerOpen.current = drawer.isOpenTenantEdit;
  }, [drawer.isOpenTenantEdit, propertiesRefetch, properties, leaseId, selectedProperty, formik]);

  // Fetch invites when editing a tenant
  useEffect(() => {
    const fetchTenantInvites = async () => {
      if (editingTenantIndex !== null && values.tenants && values.tenants[editingTenantIndex]?.id) {
        const tenant = values.tenants[editingTenantIndex];
        const tenantId = tenant.id;

        try {
          const response = await tenantInviteAPI.getInvitesByTenantId(tenantId);
          if (response.success && response.data) {
            setTenantInvites((prev) => ({
              ...prev,
              [tenantId]: response.data
            }));

            // Determine original account creation method
            const hasUserId = tenant.userId || tenant.UserId;
            const hasInvites = response.data && response.data.length > 0;

            if (hasUserId) {
              setOriginalAccountMethods((prev) => ({
                ...prev,
                [tenantId]: 'create'
              }));
            } else if (hasInvites) {
              setOriginalAccountMethods((prev) => ({
                ...prev,
                [tenantId]: 'invite'
              }));
            } else {
              setOriginalAccountMethods((prev) => ({
                ...prev,
                [tenantId]: null
              }));
            }
          }
        } catch (error) {
          console.error('Error fetching tenant invites:', error);
        }
      }
    };

    fetchTenantInvites();
  }, [editingTenantIndex, values.tenants]);

  // Handler to open AddTenantDialog with property and unit preselected
  // MUST be defined before early return to avoid hooks order violation
  const handleOpenAddTenantDialog = useCallback(() => {
    if (currentLease) {
      const property = properties?.find((p) => p.id === currentLease.propertyId);
      if (property) {
        dispatch(setProperty(property));
        // Set unit if available
        if (currentLease.unitId) {
          const unit = property.units?.find((u) => u.id === currentLease.unitId);
          if (unit) {
            dispatch(setUnit(unit));
          }
        }
      }
      setAddTenantDialogOpen(true);
    }
  }, [currentLease, properties, dispatch]);

  // Filter available tenants - show all tenants (they can have multiple leases)
  const availableTenants = useMemo(() => {
    if (!allTenants || allTenants.length === 0) return [];
    
    // Since tenants can have multiple leases (many-to-many), show all tenants
    // Filter out only tenants that are already in the current lease form
    const currentLeaseTenantIds = new Set(
      (values.tenants || []).map(t => t.id || t.Id).filter(Boolean)
    );
    
    return allTenants.filter(tenant => {
      const tenantId = tenant.id || tenant.Id;
      // Exclude tenants already added to this lease form
      return !currentLeaseTenantIds.has(tenantId);
    });
  }, [allTenants, values.tenants]);

  // Filter tenants based on search query
  const filteredAvailableTenants = useMemo(() => {
    if (!tenantSearchQuery.trim()) return availableTenants;
    
    const query = tenantSearchQuery.toLowerCase().trim();
    return availableTenants.filter(tenant => {
      const firstname = (tenant.firstname || tenant.Firstname || '').toLowerCase();
      const lastname = (tenant.lastname || tenant.Lastname || '').toLowerCase();
      const email = (tenant.email || tenant.Email || '').toLowerCase();
      
      return firstname.includes(query) || 
             lastname.includes(query) || 
             email.includes(query) ||
             `${firstname} ${lastname}`.includes(query);
    });
  }, [availableTenants, tenantSearchQuery]);

  // Handler to add existing tenant to the form
  const handleAddExistingTenant = useCallback((tenant) => {
    // Check if tenant is already in the form
    const isAlreadyAdded = values.tenants.some(t => t.id === tenant.id || t.Id === tenant.id);
    if (isAlreadyAdded) {
      openSnackbar({
        open: true,
        message: 'This tenant is already added to the lease',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    // Add tenant to form
    const newTenant = {
      id: tenant.id || tenant.Id,
      firstname: tenant.firstname || tenant.Firstname || '',
      lastname: tenant.lastname || tenant.Lastname || '',
      email: tenant.email || tenant.Email || '',
      phoneNumber: tenant.phoneNumber || tenant.PhoneNumber || '',
      userId: tenant.userId || tenant.UserId || null,
      createAccount: !!(tenant.userId || tenant.UserId),
      password: ''
    };

    setFieldValue('tenants', [...values.tenants, newTenant]);
    setAddExistingTenantDialogOpen(false);
    setTenantSearchQuery('');
    
    openSnackbar({
      open: true,
      message: 'Tenant added to lease',
      variant: 'alert',
      alert: { color: 'success' }
    });
  }, [values.tenants, setFieldValue]);

  if (loading || !currentLease) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  const handleSendInvite = async (tenant) => {
    if (!tenant.email) {
      openSnackbar({
        open: true,
        message: 'Tenant must have an email address to send invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    if (!tenant.id) {
      openSnackbar({
        open: true,
        message: 'Please save the tenant first before sending an invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      setSendingInvite((prev) => ({ ...prev, [tenant.id]: true }));
      const response = await tenantInviteAPI.createTenantInvite({
        tenantId: tenant.id,
        email: tenant.email
      });

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Invite sent successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
        await propertiesRefetch();

        // Refresh invites and update original method
        const refreshResponse = await tenantInviteAPI.getInvitesByTenantId(tenant.id);
        if (refreshResponse.success && refreshResponse.data) {
          setTenantInvites((prev) => ({
            ...prev,
            [tenant.id]: refreshResponse.data
          }));
          setOriginalAccountMethods((prev) => ({
            ...prev,
            [tenant.id]: 'invite'
          }));
        }
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to send invite',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to send invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingInvite((prev) => ({ ...prev, [tenant.id]: false }));
    }
  };

  const handleResendInvite = async (tenant) => {
    if (!tenant.id) return;

    const invites = tenantInvites[tenant.id] || [];
    const latestInvite = invites.length > 0 ? invites[0] : null;

    if (!latestInvite) return;

    try {
      setResendingInvites((prev) => ({ ...prev, [tenant.id]: true }));
      const response = await tenantInviteAPI.resendInvite(latestInvite.id);

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Invite resent successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Refresh invites
        const refreshResponse = await tenantInviteAPI.getInvitesByTenantId(tenant.id);
        if (refreshResponse.success && refreshResponse.data) {
          setTenantInvites((prev) => ({
            ...prev,
            [tenant.id]: refreshResponse.data
          }));
        }
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to resend invite',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to resend invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setResendingInvites((prev) => ({ ...prev, [tenant.id]: false }));
    }
  };

  const handleRemoveTenant = (index, tenant) => {
    setTenantToRemove({ index, tenant });
    setRemoveConfirmOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!tenantToRemove || !currentLease) return;

    const { index, tenant } = tenantToRemove;
    const tenantId = tenant.id;
    const leaseId = currentLease.id;

    try {
      // Remove the tenant from this specific lease only (not from all leases)
      // This only removes the TenantLease relationship, preserving the tenant record
      if (tenantId && leaseId) {
        const response = await axiosServices.delete(`/api/lease/${leaseId}/tenants/${tenantId}`);
        
        if (response.data?.success) {
          // Remove from form array after successful removal
          const newTenants = values.tenants.filter((_, i) => i !== index);
          setFieldValue('tenants', newTenants);
        } else {
          throw new Error(response.data?.message || 'Failed to remove tenant from lease');
        }
      }

      // Refresh properties to get updated data
      await propertiesRefetch();

      openSnackbar({
        open: true,
        message: 'Tenant removed from lease successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });

      // If tenant was in edit mode, exit edit mode
      if (editingTenantIndex === index) {
        setEditingTenantIndex(null);
      }
    } catch (error) {
      console.error('Error removing tenant:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to remove tenant.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setRemoveConfirmOpen(false);
      setTenantToRemove(null);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton onClick={() => navigate(`/landlord/leases/${leaseId}`)}>
              <ArrowLeftOutlined />
            </IconButton>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FileTextOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h4" fontWeight="bold">
                Edit Lease
              </Typography>
              {currentLease && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {currentLease.propertyName || 'Property'}
                  {currentLease.unit?.name && ` • ${currentLease.unit.name}`}
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <FormikProvider value={formik}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Lease Information */}
              <Grid size={12}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                    border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.04)}`
                  }}
                >
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>
                    Lease Information
                  </Typography>

                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormSelect
                        name="propertyId"
                        label="Property"
                        options={propertyOptions}
                        value={values.propertyId}
                        setFieldValue={(n, v) => {
                          setFieldValue('propertyId', v);
                          setFieldValue('unitId', '');
                        }}
                        touched={touched.propertyId}
                        errorText={errors.propertyId}
                        placeholder="Select property"
                        valueType="number"
                        displayEmpty
                        disabled={true}
                      />
                    </Grid>
                    {!isSingleFamilyProperty && (
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={1}>
                          <Typography variant="body2" fontWeight={600} color="text.primary">
                            Unit Number
                          </Typography>
                          <Autocomplete
                            options={unitOptions}
                            width="100%"
                            label="Select Unit"
                            value={selectedUnit}
                            onChange={(_, value) => {
                              setFieldValue('unitId', value?.id || '');
                            }}
                            isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                            getOptionLabel={(option) => option?.label ?? ''}
                            disabled={true}
                            disablePortal={false}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 1.5
                              }
                            }}
                          />
                          {touched.unitId && errors.unitId && (
                            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                              {errors.unitId}
                            </Typography>
                          )}
                        </Stack>
                      </Grid>
                    )}

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name="leaseStartDate"
                        label="Lease Start Date"
                        type="date"
                        value={values.leaseStartDate}
                        setFieldValue={setFieldValue}
                        touched={Boolean(touched.leaseStartDate)}
                        errorText={errors.leaseStartDate}
                        disabled={true}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name="leaseEndDate"
                        label="Lease End Date"
                        type="date"
                        value={values.leaseEndDate}
                        setFieldValue={setFieldValue}
                        touched={Boolean(touched.leaseEndDate)}
                        errorText={errors.leaseEndDate}
                        disabled={true}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name="rentAmount"
                        label="Rent Amount"
                        type="text"
                        valueType="currency"
                        placeholder="e.g. 1500"
                        value={values.rentAmount}
                        setFieldValue={setFieldValue}
                        touched={Boolean(touched.rentAmount)}
                        errorText={errors.rentAmount}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormSelect
                        name="rentFrequency"
                        label="Rent Frequency"
                        options={rentFrequencyOptions}
                        value={values.rentFrequency}
                        setFieldValue={setFieldValue}
                        touched={touched.rentFrequency}
                        errorText={errors.rentFrequency}
                        placeholder="Select frequency"
                        valueType="string"
                        displayEmpty
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormSelect
                        name="rentDueDay"
                        label="Rent Due Day"
                        options={rentDueDayOptions}
                        value={values.rentDueDay}
                        setFieldValue={setFieldValue}
                        touched={touched.rentDueDay}
                        errorText={errors.rentDueDay}
                        placeholder="Select due day"
                        valueType="number"
                        displayEmpty
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormSelect
                        name="leaseLength"
                        label="Lease Length"
                        options={leaseLengthOptions}
                        value={values.leaseLength}
                        setFieldValue={(n, v) => {
                          const len = Number(v);
                          setFieldValue('leaseLength', len);
                          if (len > 0 && values.leaseStartDate) {
                            const nextEnd = toInputDate(addMonths(new Date(values.leaseStartDate), len));
                            setFieldValue('leaseEndDate', nextEnd);
                          }
                        }}
                        touched={touched.leaseLength}
                        errorText={errors.leaseLength}
                        placeholder="Select lease length"
                        valueType="number"
                        displayEmpty
                        disabled={true}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Tenants */}
              <Grid size={12}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                    border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.04)}`
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight={700}>
                      Tenants
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<UserAddOutlined />}
                        onClick={() => setAddExistingTenantDialogOpen(true)}
                        sx={{ textTransform: 'none' }}
                      >
                        Add Existing Tenant
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PlusOutlined />}
                        onClick={handleOpenAddTenantDialog}
                        sx={{ textTransform: 'none' }}
                      >
                        Add New Tenant
                      </Button>
                    </Stack>
                  </Stack>

                  <FieldArray
                    name="tenants"
                    render={(arrayHelpers) => (
                      <Stack spacing={2}>
                        {values.tenants && values.tenants.length > 0 ? (
                          values.tenants.map((tenant, index) => {
                            const tenantErrors = errors.tenants?.[index];
                            const tenantTouched = touched.tenants?.[index];
                            const tenantId = tenant.id || tenant.tempId;
                            const isExistingTenant = !!tenant.id;
                            const isEditing = editingTenantIndex === index;
                            const showEditMode = !isExistingTenant || isEditing;

                            return (
                              <Card
                                key={tenantId}
                                variant="outlined"
                                sx={{
                                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                                  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                                }}
                              >
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                  <Stack spacing={2}>
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <UserOutlined style={{ fontSize: 16, color: '#1877F2' }} />
                                        <Typography variant="subtitle2" fontWeight={600}>
                                          {tenant.firstname || tenant.lastname
                                            ? `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim()
                                            : `Tenant ${index + 1}`}
                                        </Typography>
                                      </Stack>
                                      <Stack direction="row" spacing={0.5}>
                                        {isExistingTenant && !isEditing && tenant.email && !tenant.userId && (
                                          <IconButton
                                            size="small"
                                            onClick={() => handleSendInvite(tenant)}
                                            disabled={sendingInvite[tenantId]}
                                            sx={{ color: 'success.main' }}
                                            title="Send Invite"
                                          >
                                            {sendingInvite[tenantId] ? (
                                              <ReloadOutlined style={{ fontSize: 14 }} spin />
                                            ) : (
                                              <SendOutlined style={{ fontSize: 14 }} />
                                            )}
                                          </IconButton>
                                        )}
                                        {isExistingTenant && !isEditing && (
                                          <IconButton
                                            size="small"
                                            onClick={() => setEditingTenantIndex(index)}
                                            sx={{ color: 'primary.main' }}
                                            title="Edit Tenant"
                                          >
                                            <EditOutlined style={{ fontSize: 14 }} />
                                          </IconButton>
                                        )}
                                        {isEditing && (
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              setEditingTenantIndex(null);
                                            }}
                                            sx={{ color: 'success.main' }}
                                            title="Save Changes"
                                          >
                                            <CheckOutlined style={{ fontSize: 14 }} />
                                          </IconButton>
                                        )}
                                        {isEditing && (
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              setEditingTenantIndex(null);
                                              // Reset tenant values if canceling edit of existing tenant
                                              if (isExistingTenant) {
                                                // Formik will handle the reset through its own state
                                              }
                                            }}
                                            sx={{ color: 'text.secondary' }}
                                            title="Cancel"
                                          >
                                            <CloseOutlined style={{ fontSize: 14 }} />
                                          </IconButton>
                                        )}
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            if (isExistingTenant) {
                                              // For existing tenants, show confirmation dialog
                                              handleRemoveTenant(index, tenant);
                                            } else {
                                              // For new tenants (not saved), just remove from form
                                              if (isEditing) {
                                                setEditingTenantIndex(null);
                                              }
                                              arrayHelpers.remove(index);
                                            }
                                          }}
                                          sx={{ color: 'error.main' }}
                                          title="Remove Tenant"
                                        >
                                          <DeleteOutlined style={{ fontSize: 14 }} />
                                        </IconButton>
                                      </Stack>
                                    </Stack>

                                    {!showEditMode ? (
                                      // Read-only view for existing tenants
                                      <Stack spacing={1.5}>
                                        {tenant.email && (
                                          <Stack direction="row" spacing={1} alignItems="center">
                                            <MailOutlined style={{ fontSize: 14, color: '#52c41a' }} />
                                            <Typography variant="body2">{tenant.email}</Typography>
                                          </Stack>
                                        )}
                                        {(tenant.phoneNumber || tenant.phone) && (
                                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                            <Stack direction="row" spacing={1} alignItems="center">
                                              <PhoneOutlined style={{ fontSize: 14, color: '#faad14' }} />
                                              <Typography variant="body2">
                                                {formatPhoneInput(tenant.phoneNumber || tenant.phone)}
                                              </Typography>
                                            </Stack>
                                            {(() => {
                                              const userId = tenant.userId || tenant.UserId;
                                              const hasAccount = !!userId; // If userId exists, they have an account
                                              return (
                                                <Chip
                                                  label={hasAccount ? 'Active' : 'No Account'}
                                                  color={hasAccount ? 'success' : 'default'}
                                                  size="small"
                                                  sx={{ fontWeight: 500 }}
                                                />
                                              );
                                            })()}
                                          </Stack>
                                        )}
                                        {!tenant.phoneNumber && (
                                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                                            {(() => {
                                              const userId = tenant.userId || tenant.UserId;
                                              const hasAccount = !!userId; // If userId exists, they have an account
                                              return (
                                                <Chip
                                                  label={hasAccount ? 'Active' : 'No Account'}
                                                  color={hasAccount ? 'success' : 'default'}
                                                  size="small"
                                                  sx={{ fontWeight: 500 }}
                                                />
                                              );
                                            })()}
                                          </Stack>
                                        )}
                                      </Stack>
                                    ) : (
                                      // Editable form view
                                      (() => {
                                        const hasAccount = tenant.userId && tenantHasAccount[tenant.userId] === true;
                                        const tenantInvitesList = tenant.id ? (tenantInvites[tenant.id] || []) : [];
                                        const latestInvite = tenantInvitesList.length > 0 ? tenantInvitesList[0] : null;
                                        const originalMethod = tenant.id ? (originalAccountMethods[tenant.id] || null) : null;
                                        const canResendInvite = !hasAccount && latestInvite && !latestInvite.isUsed;
                                        const canSendInvite = !hasAccount && originalMethod === 'create' && tenant.id;

                                        return (
                                          <Stack spacing={2}>
                                            {/* Account Creation Method - Disabled, showing original selection */}
                                            {isExistingTenant && originalMethod && (
                                              <FormControl component="fieldset" disabled>
                                                <FormLabel component="legend">Account Creation</FormLabel>
                                                <RadioGroup
                                                  row
                                                  value={originalMethod}
                                                  name={`tenants.${index}.accountCreationMethod`}
                                                >
                                                  <FormControlLabel
                                                    value="invite"
                                                    control={<Radio />}
                                                    label="Send Invite Link"
                                                  />
                                                  <FormControlLabel
                                                    value="create"
                                                    control={<Radio />}
                                                    label="Create Account Now"
                                                  />
                                                </RadioGroup>
                                              </FormControl>
                                            )}

                                            {/* Re-send Invite or Send New Invite Button */}
                                            {isExistingTenant && !hasAccount && (
                                              <Stack direction="row" spacing={2}>
                                                {canResendInvite && (
                                                  <Button
                                                    variant="outlined"
                                                    color="primary"
                                                    size="small"
                                                    startIcon={
                                                      resendingInvites[tenant.id] ? (
                                                        <CircularProgress size={16} />
                                                      ) : (
                                                        <SendOutlined />
                                                      )
                                                    }
                                                    onClick={() => handleResendInvite(tenant)}
                                                    disabled={resendingInvites[tenant.id]}
                                                  >
                                                    {resendingInvites[tenant.id] ? 'Resending...' : 'Re-send Invite Link'}
                                                  </Button>
                                                )}
                                                {canSendInvite && (
                                                  <Button
                                                    variant="outlined"
                                                    color="primary"
                                                    size="small"
                                                    startIcon={
                                                      sendingInvite[tenant.id] ? (
                                                        <CircularProgress size={16} />
                                                      ) : (
                                                        <SendOutlined />
                                                      )
                                                    }
                                                    onClick={() => handleSendInvite(tenant)}
                                                    disabled={sendingInvite[tenant.id] || !tenant.email}
                                                  >
                                                    {sendingInvite[tenant.id] ? 'Sending...' : 'Send Invite Link'}
                                                  </Button>
                                                )}
                                              </Stack>
                                            )}

                                            <Grid container spacing={2}>
                                              <Grid size={12}>
                                                <FormInput
                                                  name={`tenants.${index}.firstname`}
                                                  label="First Name"
                                                  value={tenant.firstname}
                                                  setFieldValue={memoizedSetFieldValue}
                                                  touched={submitCount > 0 && Boolean(tenantTouched?.firstname)}
                                                  errorText={submitCount > 0 ? tenantErrors?.firstname : undefined}
                                                />
                                              </Grid>
                                              <Grid size={12}>
                                                <FormInput
                                                  name={`tenants.${index}.lastname`}
                                                  label="Last Name"
                                                  value={tenant.lastname}
                                                  setFieldValue={memoizedSetFieldValue}
                                                  touched={submitCount > 0 && Boolean(tenantTouched?.lastname)}
                                                  errorText={submitCount > 0 ? tenantErrors?.lastname : undefined}
                                                />
                                              </Grid>
                                              <Grid size={12}>
                                                <FormInput
                                                  name={`tenants.${index}.email`}
                                                  label={originalMethod === 'invite' ? 'Email' : 'Email'}
                                                  type="email"
                                                  value={tenant.email}
                                                  setFieldValue={memoizedSetFieldValue}
                                                  touched={(submitCount > 0 && Boolean(tenantTouched?.email)) || Boolean(tenantTouched?.email)}
                                                  errorText={typeof tenantErrors?.email === 'string' ? tenantErrors.email : undefined}
                                                />
                                              </Grid>
                                              {/* Only show phone number if originally "Create Account Now" or if new tenant */}
                                              {(originalMethod === 'create' || !originalMethod) && (
                                                <Grid size={12}>
                                                  <FormInput
                                                    name={`tenants.${index}.phoneNumber`}
                                                    label="Phone Number"
                                                    value={tenant.phoneNumber}
                                                    setFieldValue={memoizedSetFieldValue}
                                                    touched={submitCount > 0 && Boolean(tenantTouched?.phoneNumber)}
                                                    errorText={submitCount > 0 ? tenantErrors?.phoneNumber : undefined}
                                                    valueType="phone"
                                                  />
                                                </Grid>
                                              )}

                                              {/* Create Account Switch - only show for new tenants or if originally was "Create Account Now" */}
                                              {!isExistingTenant && (
                                                <Grid size={12}>
                                                  <FormControlLabel
                                                    control={
                                                      <Switch
                                                        checked={tenant.createAccount || false}
                                                        onChange={(e) => {
                                                          setFieldValue(`tenants.${index}.createAccount`, e.target.checked);
                                                          if (!e.target.checked) {
                                                            setFieldValue(`tenants.${index}.password`, '');
                                                            setPasswordLevels((prev) => {
                                                              const newLevels = { ...prev };
                                                              delete newLevels[tenantId];
                                                              return newLevels;
                                                            });
                                                          }
                                                        }}
                                                        color="primary"
                                                      />
                                                    }
                                                    label="Create Account"
                                                  />
                                                </Grid>
                                              )}

                                              {/* Password Fields - only show if createAccount is enabled and tenant doesn't have account */}
                                              {(() => {
                                                const hasAccount = tenant.userId && tenantHasAccount[tenant.userId] === true;
                                                return tenant.createAccount && !hasAccount;
                                              })() && (
                                                <>
                                                  <Grid size={12}>
                                              <FormControl
                                                fullWidth
                                                error={submitCount > 0 && Boolean(tenantTouched?.password && tenantErrors?.password)}
                                              >
                                                <InputLabel htmlFor={`password-${index}`}>Password</InputLabel>
                                                <OutlinedInput
                                                  id={`password-${index}`}
                                                  type={showPasswords[`${tenantId}-password`] ? 'text' : 'password'}
                                                  value={tenant.password || ''}
                                                  name={`tenants.${index}.password`}
                                                  onBlur={() => {}}
                                                  onChange={(e) => {
                                                    setFieldValue(`tenants.${index}.password`, e.target.value);
                                                    const temp = strengthIndicator(e.target.value);
                                                    setPasswordLevels((prev) => ({
                                                      ...prev,
                                                      [tenantId]: strengthColor(temp)
                                                    }));
                                                  }}
                                                  endAdornment={
                                                    <InputAdornment position="end">
                                                      <IconButton
                                                        aria-label="toggle password visibility"
                                                        onClick={() => {
                                                          setShowPasswords((prev) => ({
                                                            ...prev,
                                                            [`${tenantId}-password`]: !prev[`${tenantId}-password`]
                                                          }));
                                                        }}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        edge="end"
                                                        size="large"
                                                      >
                                                        {showPasswords[`${tenantId}-password`] ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                                      </IconButton>
                                                    </InputAdornment>
                                                  }
                                                  label="Password"
                                                />
                                                {submitCount > 0 && tenantTouched?.password && tenantErrors?.password && (
                                                  <FormHelperText error>{tenantErrors.password}</FormHelperText>
                                                )}
                                              </FormControl>
                                            </Grid>

                                            {tenant.password && passwordLevels[tenantId] && (
                                              <Grid size={12}>
                                                <Stack spacing={1}>
                                                  <Typography variant="body2">Password Strength</Typography>
                                                  <Stack direction="row" spacing={1} alignItems="center">
                                                    <Box
                                                      sx={{
                                                        width: '100%',
                                                        height: 8,
                                                        borderRadius: '4px',
                                                        bgcolor: passwordLevels[tenantId]?.color || 'grey.300'
                                                      }}
                                                    />
                                                  </Stack>
                                                  <Typography variant="caption" color={passwordLevels[tenantId]?.color}>
                                                    {passwordLevels[tenantId]?.label}
                                                  </Typography>
                                                </Stack>
                                              </Grid>
                                                  )}
                                                </>
                                              )}
                                            </Grid>
                                          </Stack>
                                        );
                                      })()
                                    )}

                                    {/* Display validation errors at bottom of card - only after submit attempt */}
                                    {submitCount > 0 && tenantErrors && Object.keys(tenantErrors).length > 0 && (
                                      <Box sx={{ mt: 2, pt: 2, borderTop: (theme) => `1px solid ${alpha(theme.palette.error.main, 0.2)}` }}>
                                        <Typography variant="caption" color="error" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                                          Please fix the following errors:
                                        </Typography>
                                        <Stack spacing={0.5}>
                                          {Object.entries(tenantErrors).map(([field, error]) => {
                                            if (typeof error === 'string') {
                                              return (
                                                <Typography key={field} variant="caption" color="error" sx={{ display: 'block' }}>
                                                  • {error}
                                                </Typography>
                                              );
                                            }
                                            return null;
                                          })}
                                        </Stack>
                                      </Box>
                                    )}
                                  </Stack>
                                </CardContent>
                              </Card>
                            );
                          })
                        ) : (
                          <Box
                            sx={{
                              p: 3,
                              textAlign: 'center',
                              bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
                              borderRadius: 1,
                              border: (theme) => `1px dashed ${theme.palette.divider}`
                            }}
                          >
                            <UserOutlined style={{ fontSize: 32, color: 'rgba(0,0,0,0.12)', marginBottom: 8 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              No tenants added yet.
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<PlusOutlined />}
                              onClick={handleOpenAddTenantDialog}
                            >
                              Add New Tenant
                            </Button>
                          </Box>
                        )}
                      </Stack>
                    )}
                  />
                </Paper>
              </Grid>

              {/* Submit Button */}
              <Grid size={12}>
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
                  <Button variant="outlined" onClick={() => navigate(`/landlord/leases/${leaseId}`)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting || !values.propertyId || !currentLease}
                    onClick={async (e) => {
                      // Prevent double submission
                      if (isSubmitting) {
                        e.preventDefault();
                        return;
                      }

                      console.log('Save button clicked', {
                        isSubmitting,
                        propertyId: values.propertyId,
                        currentLease: !!currentLease,
                        hasErrors: Object.keys(errors).length > 0,
                        errors,
                        touched,
                        values,
                        tenants: values.tenants?.map((t, idx) => ({
                          index: idx,
                          firstname: t.firstname,
                          lastname: t.lastname,
                          email: t.email,
                          createAccount: t.createAccount,
                          hasPassword: !!t.password,
                          passwordLength: t.password?.length || 0,
                          userId: t.userId
                        }))
                      });

                      // Manually validate to see if there are any errors
                      const validationErrors = await validateForm();
                      console.log('Validation result:', validationErrors);

                      if (Object.keys(validationErrors).length > 0) {
                        console.warn('Form has validation errors, submission prevented:', validationErrors);
                        e.preventDefault();
                        // Log detailed tenant validation errors
                        if (validationErrors.tenants) {
                          validationErrors.tenants.forEach((tenantErrors, idx) => {
                            if (tenantErrors && Object.keys(tenantErrors).length > 0) {
                              console.warn(`Tenant ${idx} validation errors:`, tenantErrors);
                              console.log(`Tenant ${idx} data:`, values.tenants?.[idx]);
                            }
                          });
                        }
                      } else {
                        console.log('No validation errors, form should submit');
                      }
                    }}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Form>
        </LocalizationProvider>
      </FormikProvider>

      <TenantEditDrawer />
      
      {/* Add Tenant Dialog */}
      <AddTenantDialog
        open={addTenantDialogOpen}
        onClose={() => {
          setAddTenantDialogOpen(false);
          // Clear property/unit selection when dialog closes
          // Don't clear if we're still on the lease edit page - keep them for context
        }}
        unitId={currentLease?.unitId || null}
        leaseId={currentLease?.id || currentLease?.Id || null}
        onSuccess={async (tenant, shouldReopenWizard) => {
          // If we're on a lease edit page, link the tenant to the lease's unit and lease
          // Note: unitId and leaseId are now passed directly to AddTenantDialog, so this update may not be needed
          // but keeping it for backwards compatibility in case tenant was created without these values
          if (currentLease && tenant) {
            try {
              const tenantId = tenant.id || tenant.Id;
              const tenantPayload = {
                Id: tenantId,
                LeaseId: currentLease.id,
                UnitId: currentLease.unitId,
                Firstname: tenant.firstname || tenant.Firstname || '',
                Lastname: tenant.lastname || tenant.Lastname || '',
                Email: tenant.email || tenant.Email || null,
                PhoneNumber: tenant.phoneNumber || tenant.PhoneNumber || null,
                UserId: tenant.userId || tenant.UserId || null
              };
              
              // Update tenant to link to lease
              await axiosServices.put(`/api/tenant/${tenantId}`, tenantPayload);
            } catch (error) {
              console.error('Error linking tenant to lease:', error);
              // Don't show error to user - tenant was created successfully
              // They can manually link it later if needed
            }
          }
          
          // Refresh properties to get updated tenant list
          await propertiesRefetch();
          // The form will automatically update when properties are refetched
          // since currentLease is derived from properties
        }}
      />

      {/* Add Existing Tenant Dialog */}
      <Dialog
        open={addExistingTenantDialogOpen}
        onClose={() => {
          setAddExistingTenantDialogOpen(false);
          setTenantSearchQuery('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="h6" fontWeight={600}>
              Add Existing Tenant
            </Typography>
            <IconButton
              size="small"
              onClick={() => {
                setAddExistingTenantDialogOpen(false);
                setTenantSearchQuery('');
              }}
            >
              <CloseOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              placeholder="Search by first name, last name, or email"
              value={tenantSearchQuery}
              onChange={(e) => setTenantSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined style={{ fontSize: 18, opacity: 0.6 }} />
                  </InputAdornment>
                )
              }}
              sx={{ mb: 2 }}
            />

            {loadingTenants ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredAvailableTenants.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <UserOutlined style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }} />
                <Typography variant="body2" color="text.secondary">
                  {tenantSearchQuery.trim()
                    ? 'No tenants found matching your search'
                    : 'No available tenants. All tenants are already on a lease.'}
                </Typography>
              </Box>
            ) : (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {filteredAvailableTenants.map((tenant) => {
                  const firstname = tenant.firstname || tenant.Firstname || '';
                  const lastname = tenant.lastname || tenant.Lastname || '';
                  const email = tenant.email || tenant.Email || '';
                  const name = `${firstname} ${lastname}`.trim() || 'Unnamed Tenant';
                  
                  return (
                    <ListItem
                      key={tenant.id || tenant.Id}
                      disablePadding
                      sx={{ mb: 1 }}
                    >
                      <ListItemButton
                        onClick={() => handleAddExistingTenant(tenant)}
                        sx={{
                          borderRadius: 1,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            borderColor: theme.palette.primary.main
                          }
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                            {name.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={name}
                          secondary={email || 'No email'}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => {
              setAddExistingTenantDialogOpen(false);
              setTenantSearchQuery('');
            }}
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Tenant Confirmation Dialog */}
      <ConfirmationDialog
        open={removeConfirmOpen}
        onClose={() => {
          setRemoveConfirmOpen(false);
          setTenantToRemove(null);
        }}
        onConfirm={handleConfirmRemove}
        title="Remove Tenant"
        message={`Are you sure you want to remove ${tenantToRemove?.tenant?.firstname || ''} ${tenantToRemove?.tenant?.lastname || ''} from this lease? The tenant's account and historical documents will be preserved.`}
        confirmText="Remove"
        cancelText="Cancel"
        confirmColor="error"
      />
    </Box>
  );
}
