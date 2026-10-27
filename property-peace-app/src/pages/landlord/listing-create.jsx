import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box, Button, CircularProgress, Dialog, IconButton, Stack, TextField, Typography
} from '@mui/material';
import { ArrowLeftOutlined, EnvironmentOutlined, HomeOutlined, RightOutlined, CloseOutlined } from '@ant-design/icons';
import { selectCurrentUser } from 'store/user/user.selector';
import usePlacesSuggestions from 'hooks/usePlacesSuggestions';
import { parseListingAddress } from './listing-address.mjs';

const blankAddress = { streetAddress: '', unit: '', city: '', state: '', zipCode: '', country: 'US' };
const outlinedButton = { textTransform: 'none', borderRadius: 6, color: '#172b3d', borderColor: '#d4d9dd', fontWeight: 650, px: 2.3, '&:hover': { borderColor: '#718b95', bgcolor: '#f6f9f7' } };
const primaryButton = { textTransform: 'none', borderRadius: 6, px: 3.5, py: 1.2, bgcolor: '#061e35', color: '#fff', fontWeight: 700, '&:hover': { bgcolor: '#042238', color: '#fff' } };
const required = ['streetAddress', 'city', 'state', 'zipCode'];

export default function ListingCreatePage({ propertyMode = false, onContinue } = {}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const currentUser = useSelector(selectCurrentUser);
  const userId = currentUser?.id ?? currentUser?.Id ?? currentUser?.email ?? currentUser?.Email;
  const draftKey = `pp-${propertyMode ? 'property' : 'listing'}-onboarding:${userId}`;
  const [saved, setSaved] = useState(() => {
    if (!userId) return null;
    try {
      const value = JSON.parse(localStorage.getItem(draftKey));
      return value?.address ? value : null;
    } catch { return null; }
  });
  const [address, setAddress] = useState(saved?.address || blankAddress);
  const [rentalMode, setRentalMode] = useState(saved?.rentalMode || '');
  useEffect(() => {
    if (!userId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(draftKey));
      if (stored?.address) {
        setSaved(stored);
        setAddress(stored.address);
        setRentalMode(stored.rentalMode || '');
      }
    } catch { /* Ignore malformed drafts. */ }
  }, [draftKey, userId]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState('search');
  const [candidate, setCandidate] = useState(blankAddress);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  const { value, setValue, suggestions, loading, clear, toPlaceDetails, resetSession } = usePlacesSuggestions({ debounceMs: 250, region: 'us' });
  const requestedStep = params.get('step');
  const propertyStep = (requestedStep === 'place' || (propertyMode && requestedStep === 'rental')) && address.streetAddress;
  const step = requestedStep === 'address' || propertyStep
    ? requestedStep : propertyMode ? (saved?.address ? (saved.step === 'rental' ? 'rental' : 'place') : 'address') : 'welcome';
  const firstName = (currentUser?.firstname ?? currentUser?.Firstname ?? currentUser?.firstName ?? '').trim() || 'there';

  const go = (next) => setParams(next === 'welcome' ? {} : { step: next });
  const close = () => navigate(propertyMode ? '/landlord/properties' : '/landlord/listings');
  const saveAndExit = () => {
    if (step !== 'welcome' && address.streetAddress) {
      const draft = { address, rentalMode, step };
      if (userId) localStorage.setItem(draftKey, JSON.stringify(draft));
      setSaved(draft);
    }
    close();
  };
  const startNew = () => {
    setAddress(blankAddress);
    setRentalMode('');
    if (userId) localStorage.removeItem(draftKey);
    setSaved(null);
    go('address');
  };
  const openSearch = () => {
    setError('');
    setModalStep('search');
    setValue('');
    clear();
    setModalOpen(true);
  };
  const selectSuggestion = async (suggestion) => {
    setError('');
    setResolving(true);
    const place = await toPlaceDetails(suggestion, ['formattedAddress', 'addressComponents']);
    setResolving(false);
    if (!place) {
      setError('We could not load that address. Try another result.');
      return;
    }
    resetSession();
    setCandidate(parseListingAddress(place));
    setModalStep('confirm');
  };
  const confirmAddress = () => {
    if (required.some((field) => !candidate[field].trim())) {
      setError('Enter the street address, city, state, and ZIP code to continue.');
      return;
    }
    if (!/^\d{5}$/.test(candidate.zipCode.trim())) {
      setError('Enter a five-digit ZIP code to continue.');
      return;
    }
    const confirmed = Object.fromEntries(Object.entries(candidate).map(([key, entry]) => [key, entry.trim()]));
    setAddress(confirmed);
    setModalOpen(false);
    setError('');
    setValue('');
    clear();
    const draft = { address: confirmed, rentalMode, step: 'place' };
    if (userId) localStorage.setItem(draftKey, JSON.stringify(draft));
    setSaved(draft);
    go('place');
  };

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1400, overflowY: 'auto', bgcolor: '#fff', color: '#172b3d', fontFamily: 'inherit' }}>
      <Box component="header" sx={{ height: { xs: 76, md: 96 }, px: { xs: 2.5, md: 6 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box component="img" src="/listing-onboarding-logo.png" alt="Property Peace" sx={{ width: { xs: 148, md: 185 }, height: 'auto' }} />
        <Stack direction="row" spacing={1}>
          {step === 'welcome' ? <Button variant="outlined" sx={outlinedButton} onClick={close}>Exit</Button> :
            <Button variant="outlined" sx={outlinedButton} onClick={saveAndExit}>Save &amp; exit</Button>}
        </Stack>
      </Box>

      {step === 'welcome' && (
        <Box component="main" sx={{ maxWidth: 630, mx: 'auto', px: 3, pt: { xs: 12, md: '17vh' } }}>
          <Typography component="h1" sx={{ fontSize: { xs: 31, md: 38 }, letterSpacing: '-0.035em', fontWeight: 760, mb: 6 }}>Welcome back, {firstName}.</Typography>
          <Typography component="h2" sx={{ fontSize: 23, fontWeight: 720, mb: 2 }}>Start a new listing</Typography>
          <Box component="button" onClick={startNew} sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'transparent', color: 'inherit', border: 0, borderBottom: '1px solid #e4e7e5', py: 2.3, textAlign: 'left', cursor: 'pointer', font: 'inherit', fontWeight: 650, '&:hover': { bgcolor: '#f7faf8' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'success.main' } }}>
            <Box sx={{ width: 50, height: 50, display: 'grid', placeItems: 'center', border: '1px solid #dce3df', borderRadius: 2, fontSize: 25 }}><HomeOutlined /></Box>
            <Box sx={{ flex: 1 }}>Create a new listing</Box><RightOutlined />
          </Box>
          {saved && <Box component="button" onClick={() => { setAddress(saved.address); go(saved.step || 'address'); }} sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', bgcolor: 'transparent', color: 'inherit', border: 0, borderBottom: '1px solid #e4e7e5', py: 2.5, textAlign: 'left', cursor: 'pointer', font: 'inherit', fontWeight: 650 }}>Continue saved address <RightOutlined /></Box>}
        </Box>
      )}

      {step === 'address' && (
        <Box component="main" sx={{ maxWidth: 1140, mx: 'auto', px: { xs: 3, md: 5 }, pt: { xs: 5, md: '10vh' }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 0.95fr' }, alignItems: 'center', gap: { xs: 5, md: 9 } }}>
          <Box>
            {!propertyMode && <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'success.dark', mb: 2 }}>STEP 1 · YOUR ADDRESS</Typography>}
            <Typography component="h1" sx={{ fontSize: { xs: 36, md: 51 }, lineHeight: 1.12, letterSpacing: '-0.045em', fontWeight: 760, mb: 2 }}>{propertyMode ? 'Where is your property?' : 'Set up your Property Peace listing'}</Typography>
            <Typography sx={{ color: '#53646c', fontSize: 17, lineHeight: 1.65, maxWidth: 475, mb: 5 }}>{propertyMode ? 'Start with the street address. We’ll help you find it, then you can check the details before moving on.' : "Let's start with the location. Search for your property's street address, then confirm the details before we move on."}</Typography>
            {!propertyMode && <Typography component="label" htmlFor="listing-address-trigger" sx={{ display: 'block', fontWeight: 700, mb: 1.3 }}>Street address</Typography>}
            <Box component="button" id="listing-address-trigger" aria-label={propertyMode ? 'Street address' : undefined} onClick={openSearch} sx={{ width: '100%', maxWidth: 495, py: 2.1, px: 2.2, border: '1px solid #b8c6c2', borderRadius: 2, bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 1.5, textAlign: 'left', color: address.streetAddress ? '#172b3d' : '#687b80', cursor: 'pointer', font: 'inherit', '&:hover': { borderColor: 'success.dark' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'success.dark' } }}><EnvironmentOutlined />{address.streetAddress || 'Enter your street address'}</Box>
            {propertyMode ? null : <Button startIcon={<ArrowLeftOutlined />} sx={{ mt: 4, textTransform: 'none', color: '#53646c' }} onClick={() => go('welcome')}>Back</Button>}
          </Box>
          <Box component="img" src="/listing-onboarding-home.png" alt="Residential building and landscaped courtyard" sx={{ width: '100%', height: { xs: 230, md: 475 }, objectFit: 'cover', borderRadius: 3, objectPosition: 'center' }} />
        </Box>
      )}

      {step === 'place' && (
        <>
          {propertyMode ? (
            <Box component="main" sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 3, md: 5 }, minHeight: 'calc(100dvh - 190px)', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'center', gap: { xs: 3, md: 8 }, pb: { xs: 4, md: 0 } }}>
              <Box>
                <Typography sx={{ fontSize: 17, fontWeight: 650, mb: 2 }}>Step 1</Typography>
                <Typography component="h1" sx={{ fontSize: { xs: 38, md: 52 }, lineHeight: 1.12, letterSpacing: '-0.04em', fontWeight: 760, mb: 3 }}>Tell us about your place</Typography>
                <Typography sx={{ color: '#53646c', fontSize: { xs: 17, md: 19 }, lineHeight: 1.65, maxWidth: 475 }}>We’ll ask what type of rental you have, then learn more about the property and its units.</Typography>
              </Box>
              <Box component="img" src="/listing-onboarding-home.png" alt="Residential building and landscaped courtyard" sx={{ width: '100%', maxHeight: { xs: 260, md: 490 }, objectFit: 'cover', borderRadius: 3 }} />
            </Box>
          ) : (
          <Box component="main" sx={{ maxWidth: 1060, mx: 'auto', px: 3, pt: { xs: 10, md: '18vh' }, pb: 140 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'success.dark', mb: 2 }}>STEP 2 · YOUR PLACE</Typography>
            <Typography component="h1" sx={{ fontSize: { xs: 37, md: 56 }, lineHeight: 1.13, letterSpacing: '-0.045em', fontWeight: 760, mb: 2 }}>Tell us about your place</Typography>
            <Typography sx={{ color: '#53646c', fontSize: 18, maxWidth: 540, lineHeight: 1.6 }}>Your address is confirmed. Next, you'll add the details that make this place yours.</Typography>
            <Box sx={{ mt: 5, p: 3, maxWidth: 520, border: '1px solid #e2e8e5', borderRadius: 2.5, display: 'flex', gap: 2, alignItems: 'flex-start' }}><EnvironmentOutlined style={{ fontSize: 21, marginTop: 3 }} /><Box><Typography fontWeight={700}>{address.streetAddress}{address.unit ? `, ${address.unit}` : ''}</Typography><Typography color="text.secondary">{address.city}, {address.state} {address.zipCode}</Typography><Button onClick={openSearch} sx={{ p: 0, mt: 1, minWidth: 0, textTransform: 'none', color: 'success.dark' }}>Edit address</Button></Box></Box>
          </Box>
          )}
        </>
      )}

      {propertyMode && step === 'rental' && (
        <Box component="main" sx={{ maxWidth: 690, mx: 'auto', px: 3, pt: { xs: 8, md: '15vh' }, pb: 145 }}>
          <Typography component="h1" sx={{ fontSize: { xs: 32, md: 43 }, lineHeight: 1.17, letterSpacing: '-0.035em', fontWeight: 750, mb: 5 }}>What type of rental describes your place best?</Typography>
          <Stack spacing={2} role="radiogroup" aria-label="Rental type">
            {[['shortTerm', 'Short-term leasing'], ['longTerm', 'Long-term leasing']].map(([mode, label]) => (
              <Box key={mode} component="button" role="radio" aria-checked={rentalMode === mode} onClick={() => setRentalMode(mode)} sx={{ width: '100%', minHeight: 92, px: 3, border: '2px solid', borderColor: rentalMode === mode ? '#061e35' : '#d6deda', borderRadius: 2, bgcolor: rentalMode === mode ? '#f4f8f6' : '#fff', color: '#172b3d', textAlign: 'left', font: 'inherit', fontSize: 20, fontWeight: 650, cursor: 'pointer', '&:hover': { borderColor: '#061e35' }, '&:focus-visible': { outline: '3px solid #6baf93', outlineOffset: 2 } }}>{label}</Box>
            ))}
          </Stack>
        </Box>
      )}

      {(step === 'place' || (propertyMode && step === 'rental')) && (
        <Box component="footer" sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, bgcolor: '#fff', borderTop: '1px solid #e4e8e5', px: { xs: 3, md: 6 }, pt: 2.5, pb: 'max(20px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ position: 'absolute', top: -2, left: 0, width: step === 'place' ? '18%' : '36%', height: 3, bgcolor: '#061e35' }} />
          {step === 'rental' || !propertyMode ? <Button onClick={() => go(step === 'rental' ? 'place' : 'address')} sx={{ textTransform: 'none', color: '#172b3d', minWidth: 0, px: 0, fontSize: 16 }}>Back</Button> : <Box />}
          {propertyMode ? <Button variant="contained" disabled={step === 'rental' && !rentalMode} onClick={() => { if (step === 'place') { go('rental'); } else { if (userId) localStorage.setItem(draftKey, JSON.stringify({ address, rentalMode, step: 'rental' })); onContinue?.({ ...address, rentalMode }); } }} sx={primaryButton}>Next</Button> : <Stack direction="row" spacing={2} alignItems="center"><Typography sx={{ fontSize: 13, color: '#687b80' }}>The next setup step is coming soon.</Typography><Button disabled variant="contained" sx={primaryButton}>Next</Button></Stack>}
        </Box>
      )}

      <Dialog sx={{ zIndex: 1500 }} open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm" aria-labelledby="address-dialog-title" BackdropProps={{ sx: { bgcolor: 'rgba(0, 0, 0, 0.3)' } }} PaperProps={{ sx: { borderRadius: 3, p: { xs: 1, sm: 2 }, minHeight: modalStep === 'search' ? 'min(72vh, 690px)' : undefined, maxHeight: '88vh' } }}>
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, px: 6, py: { xs: 2, sm: 3 }, mb: 2 }}>
          {modalStep === 'confirm' && <IconButton aria-label="Back to address results" onClick={() => { setModalStep('search'); setError(''); }} sx={{ position: 'absolute', left: 8 }}><ArrowLeftOutlined /></IconButton>}
          <Typography id="address-dialog-title" component="h2" sx={{ fontSize: 21, fontWeight: 750, textAlign: 'center' }}>{modalStep === 'search' ? 'Enter your address' : 'Confirm your address'}</Typography>
          <IconButton aria-label="Close address search" onClick={() => setModalOpen(false)} sx={{ position: 'absolute', right: 8 }}><CloseOutlined /></IconButton>
        </Box>
        {modalStep === 'search' ? (
          <Box sx={{ px: 1, pb: 2 }}>
            <TextField autoFocus fullWidth aria-label="Enter your address" placeholder="Enter your address" value={value} onChange={(event) => { setValue(event.target.value); setError(''); }} InputProps={{ startAdornment: <EnvironmentOutlined style={{ marginRight: 10 }} /> }} />
            <Box role="listbox" aria-label="Google address results" sx={{ mt: 1, maxHeight: 340, overflowY: 'auto' }}>
              {loading || resolving ? <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={25} /></Stack> : suggestions.map((suggestion, index) => <Box component="button" role="option" aria-selected={false} key={suggestion.placePrediction?.placeId || index} disabled={resolving} onClick={() => selectSuggestion(suggestion)} sx={{ width: '100%', display: 'flex', gap: 2, alignItems: 'center', py: 2, px: 1, border: 0, borderBottom: '1px solid #e7eae8', bgcolor: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: '#172b3d', '&:hover': { bgcolor: '#f3f8f5' } }}><EnvironmentOutlined /><span>{suggestion.placePrediction?.text?.toString() || suggestion._legacy?.description}</span></Box>)}
            </Box>
            {!loading && !suggestions.length && value.trim() && <Typography sx={{ color: '#53646c', py: 1.5 }}>No results yet? Check the address and try again.</Typography>}
          </Box>
        ) : (
          <Box sx={{ px: 1, pb: 2 }}>
            <Typography sx={{ color: '#53646c', mb: 2 }}>Make sure these details are right. You can edit any field.</Typography>
            <Stack spacing={2}>
              {[['streetAddress', 'Street address'], ['unit', 'Apartment, suite, or unit (optional)'], ['city', 'City'], ['state', 'State'], ['zipCode', 'ZIP code']].map(([field, label]) => <TextField key={field} label={label} required={field !== 'unit'} fullWidth value={candidate[field]} inputProps={field === 'zipCode' ? { maxLength: 5, inputMode: 'numeric' } : undefined} onChange={(event) => { setCandidate((prev) => ({ ...prev, [field]: field === 'zipCode' ? event.target.value.replace(/\D/g, '').slice(0, 5) : event.target.value })); setError(''); }} />)}
              <TextField label="Country" fullWidth value={candidate.country} onChange={(event) => setCandidate((prev) => ({ ...prev, country: event.target.value }))} />
            </Stack>
            <Button variant="contained" fullWidth onClick={confirmAddress} sx={{ ...primaryButton, mt: 3 }}>Next</Button>
          </Box>
        )}
        {error && <Typography role="alert" sx={{ color: '#ad342b', px: 1, pb: 2 }}>{error}</Typography>}
      </Dialog>
    </Box>
  );
}
