import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  alpha,
  useTheme,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { getListingById, setSelectedListing, updateListing } from 'store/listing/listing.action';
import { selectSelectedListing, selectListingLoading } from 'store/listing/listing.selector';
import { selectCurrentUser } from 'store/user/user.selector';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';

function getUserContactDisplay(user) {
  if (!user) return { name: '', email: '', phone: '' };
  const first = user.Firstname ?? user.firstname ?? '';
  const last = user.Lastname ?? user.lastname ?? '';
  const name = ([first, last].filter(Boolean).join(' ') || (user.Name ?? user.name ?? ''));
  return {
    name: (name || '').trim(),
    email: ((user.Email ?? user.email) ?? '').trim(),
    phone: ((user.PhoneNumber ?? user.phoneNumber) ?? '').trim()
  };
}

export default function ListingSetupApplicationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useDispatch();
  const listing = useSelector(selectSelectedListing);
  const loading = useSelector(selectListingLoading);
  const currentUser = useSelector(selectCurrentUser);
  const { canInvoke: syndicationCanInvoke } = useFeatureReadiness(FEATURE_KEYS.listingSyndication);
  const { canInvoke: screeningCanInvoke } = useFeatureReadiness(FEATURE_KEYS.tenantScreening);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [emailToVerify, setEmailToVerify] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [contactNameErrorShown, setContactNameErrorShown] = useState(false);

  useEffect(() => {
    if (id) dispatch(getListingById(parseInt(id)));
    return () => dispatch(setSelectedListing(null));
  }, [id, dispatch]);

  useEffect(() => {
    if (listing) {
      const userContact = getUserContactDisplay(currentUser);
      setFormData({
        acceptOnlineApplications: listing.acceptOnlineApplications ?? true,
        applicationFeeRequired: listing.applicationFeeRequired ?? false,
        applicationFee: listing.applicationFee ?? '0',
        requireScreening: screeningCanInvoke && Boolean(listing.requireScreening ?? true),
        screeningType: screeningCanInvoke ? listing.screeningType ?? 'Essential' : null,
        requireIncomeVerification: screeningCanInvoke && Boolean(listing.requireIncomeVerification ?? false),
        incomeVerificationCost: screeningCanInvoke ? listing.incomeVerificationCost ?? '12' : 0,
        listingContactName: (listing.listingContactName?.trim() || userContact.name) ?? '',
        listingContactPhone: (listing.listingContactPhone?.trim() || userContact.phone) ?? '',
        listingContactEmail: (listing.listingContactEmail?.trim() || userContact.email) ?? '',
        syndicateToListingWebsite: Boolean(listing.syndicateToListingWebsite ?? true),
        syndicateToFreeSites: syndicationCanInvoke && Boolean(listing.syndicateToFreeSites ?? false),
        syndicateToPremiumSites: syndicationCanInvoke && Boolean(listing.syndicateToPremiumSites ?? false)
      });
    }
  }, [listing, currentUser, syndicationCanInvoke, screeningCanInvoke]);

  const handleBack = () => navigate(`/landlord/listings/${id}/setup`);

  const userSignupEmail = (getUserContactDisplay(currentUser).email || '').toLowerCase();

  const performSave = async () => {
    if (!id || !formData) return;
    const nameTrimmed = formData.listingContactName?.trim();
    const payload = {
      acceptOnlineApplications: formData.acceptOnlineApplications,
      applicationFeeRequired: formData.applicationFeeRequired,
      applicationFee: formData.applicationFeeRequired ? parseFloat(formData.applicationFee) : 0,
      requireScreening: screeningCanInvoke && Boolean(formData.requireScreening),
      screeningType: screeningCanInvoke ? formData.screeningType : null,
      requireIncomeVerification: screeningCanInvoke && Boolean(formData.requireIncomeVerification),
      incomeVerificationCost:
        screeningCanInvoke && formData.requireIncomeVerification ? parseFloat(formData.incomeVerificationCost) : 0,
      listingContactName: nameTrimmed || null,
      listingContactPhone: formData.listingContactPhone?.trim() || null,
      listingContactEmail: formData.listingContactEmail?.trim() || null,
      syndicateToListingWebsite: Boolean(formData.syndicateToListingWebsite),
      syndicateToFreeSites: syndicationCanInvoke && Boolean(formData.syndicateToFreeSites),
      syndicateToPremiumSites: syndicationCanInvoke && Boolean(formData.syndicateToPremiumSites)
    };
    const result = await dispatch(updateListing(parseInt(id), payload));
    if (result?.success) {
      dispatch(getListingById(parseInt(id)));
      openSnackbar({ open: true, message: 'Contact details saved', variant: 'alert', alert: { color: 'success' } });
      navigate(`/landlord/listings/${id}/setup`);
    } else throw new Error(result?.message);
  };

  const handleSave = async () => {
    if (!id || !formData) return;
    const nameTrimmed = formData.listingContactName?.trim();
    if (!nameTrimmed) {
      setContactNameErrorShown(true);
      openSnackbar({
        open: true,
        message: 'Contact name is required',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }
    setContactNameErrorShown(false);
    const contactEmail = formData.listingContactEmail?.trim() || '';
    const needsVerification =
      contactEmail.length > 0 &&
      userSignupEmail.length > 0 &&
      contactEmail.toLowerCase() !== userSignupEmail;

    if (needsVerification) {
      setSendingCode(true);
      setCodeError('');
      try {
        const res = await axiosServices.post('/api/user/send-verification-code', { email: contactEmail });
        if (res.data?.success) {
          setEmailToVerify(contactEmail);
          setVerificationCode('');
          setVerifyDialogOpen(true);
          openSnackbar({
            open: true,
            message: 'Verification code sent to your email',
            variant: 'alert',
            alert: { color: 'success' }
          });
        } else {
          openSnackbar({
            open: true,
            message: res.data?.message || 'Failed to send verification code',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (e) {
        openSnackbar({
          open: true,
          message: e?.response?.data?.message || e?.message || 'Failed to send verification code',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSendingCode(false);
      }
      return;
    }

    setSaving(true);
    try {
      await performSave();
    } catch (e) {
      openSnackbar({
        open: true,
        message: e?.response?.data?.message || e?.message || 'Failed to save',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      setCodeError('Enter the 6-digit code');
      return;
    }
    setCodeError('');
    setVerifying(true);
    try {
      const res = await axiosServices.post('/api/user/verify-code', { email: emailToVerify, code });
      if (res.data?.success && res.data?.data) {
        setVerifyDialogOpen(false);
        setSaving(true);
        try {
          await performSave();
        } finally {
          setSaving(false);
        }
      } else {
        setCodeError(res.data?.message || 'Invalid or expired code');
      }
    } catch (e) {
      setCodeError(e?.response?.data?.message || e?.message || 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!emailToVerify) return;
    setSendingCode(true);
    setCodeError('');
    try {
      const res = await axiosServices.post('/api/user/send-verification-code', { email: emailToVerify });
      if (res.data?.success) {
        openSnackbar({ open: true, message: 'Code sent again', variant: 'alert', alert: { color: 'success' } });
      } else {
        setCodeError(res.data?.message || 'Failed to resend');
      }
    } catch (e) {
      setCodeError(e?.response?.data?.message || 'Failed to resend');
    } finally {
      setSendingCode(false);
    }
  };

  if (loading || !listing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const propertyDisplay = listing.propertyName || 'Property';
  const unitDisplay = listing.unitName || 'Whole property';
  const addressDisplay = listing.propertyAddress ?? '';

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Listings', path: '/landlord/listings' },
          { label: listing.listingNumber ?? 'Listing' },
          { label: 'Set Up', path: `/landlord/listings/${id}/setup` },
          { label: 'Contact details' }
        ]}
      />

      <Box
        sx={{
          mb: 4,
          p: 3,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}`,
          boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.04)}`
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack spacing={1} alignItems="flex-start">
            <Button
              variant="text"
              size="small"
              startIcon={<ArrowLeftOutlined style={{ fontSize: 14 }} />}
              onClick={handleBack}
              sx={{
                color: 'text.secondary',
                textTransform: 'none',
                minWidth: 'auto',
                width: 'fit-content',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
              }}
            >
              BACK
            </Button>
            <Typography variant="h4" fontWeight={700}>
              {propertyDisplay} – {unitDisplay}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {addressDisplay}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <MainCard
        title="Contact details"
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2
        }}
      >
        {formData && (
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Shown to applicants. Pre-filled from your account—confirm or update and click Save to complete this section.
            </Typography>
            <TextField
              fullWidth
              required
              label="Contact name"
              placeholder="Name of the person applicants can reach"
              value={formData.listingContactName ?? ''}
              onChange={(e) => {
                setFormData((p) => ({ ...p, listingContactName: e.target.value }));
                if (contactNameErrorShown) setContactNameErrorShown(false);
              }}
              error={contactNameErrorShown && !formData.listingContactName?.trim()}
              helperText={contactNameErrorShown && !formData.listingContactName?.trim() ? 'Required' : null}
            />
            <TextField
              fullWidth
              label="Contact phone"
              value={formData.listingContactPhone}
              onChange={(e) => setFormData((p) => ({ ...p, listingContactPhone: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Contact email"
              type="email"
              value={formData.listingContactEmail}
              onChange={(e) => setFormData((p) => ({ ...p, listingContactEmail: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={handleBack}
                sx={{ textTransform: 'uppercase', fontWeight: 700, px: 2, py: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || sendingCode}
                sx={{ textTransform: 'uppercase', fontWeight: 700, px: 2, py: 1 }}
              >
                {saving ? 'Saving...' : sendingCode ? 'Sending code...' : 'Save'}
              </Button>
            </Stack>
          </Stack>
        )}
      </MainCard>

      <Dialog open={verifyDialogOpen} onClose={() => !verifying && setVerifyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Verify your email</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We sent a 6-digit code to <strong>{emailToVerify}</strong>. Enter it below to save this contact email.
          </Typography>
          <TextField
            fullWidth
            label="Verification code"
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => {
              setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              setCodeError('');
            }}
            error={!!codeError}
            helperText={codeError}
            inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
            sx={{ mb: 1 }}
          />
          <Button
            size="small"
            onClick={handleResendCode}
            disabled={sendingCode}
            sx={{ textTransform: 'none', p: 0 }}
          >
            {sendingCode ? 'Sending...' : 'Resend code'}
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVerifyDialogOpen(false)} disabled={verifying}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleVerifyCode} disabled={verifying || verificationCode.length !== 6}>
            {verifying ? 'Verifying...' : 'Verify and save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
