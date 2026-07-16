import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  TextField,
  Button,
  alpha,
  Alert,
  Avatar,
  IconButton,
  Divider,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ShopOutlined,
  CameraOutlined,
  EditOutlined,
  BankOutlined
} from '@ant-design/icons';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import avatar1 from 'assets/images/users/avatar-1.png';
import EditOrganizationModal from 'components/dialogs/EditOrganizationModal';

// ==============================|| PROFILE SETTINGS ||============================== //

export default function ProfileSettings() {
  const { user, updateUser, reloadUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const theme = useTheme();
  const fileInputRef = useRef(null);
  
  const [profileLoading, setProfileLoading] = useState(false);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [businessSuccess, setBusinessSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [profileImage, setProfileImage] = useState(() => {
    const profileImageUrl = user?.ProfileImageUrl || user?.profileImageUrl;
    return profileImageUrl || avatar1;
  });
  const [formData, setFormData] = useState({
    firstName: user?.FirstName || user?.firstname || '',
    lastName: user?.LastName || user?.lastname || '',
    email: user?.Email || user?.email || '',
    phoneNumber: user?.PhoneNumber || user?.phoneNumber || ''
  });
  const [businessData, setBusinessData] = useState({
    businessName: user?.BusinessName || user?.businessName || '',
    businessEmail: user?.BusinessEmail || user?.businessEmail || '',
    businessPhone: user?.BusinessPhone || user?.businessPhone || ''
  });
  const [editOrgModalOpen, setEditOrgModalOpen] = useState(false);

  // Update form data when user changes (but preserve phone number if editing)
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        firstName: user?.FirstName || user?.firstname || '',
        lastName: user?.LastName || user?.lastname || '',
        email: user?.Email || user?.email || '',
        phoneNumber: user?.PhoneNumber || user?.phoneNumber || prev?.phoneNumber || ''
      }));
      setBusinessData({
        businessName: user?.BusinessName || user?.businessName || '',
        businessEmail: user?.BusinessEmail || user?.businessEmail || '',
        businessPhone: user?.BusinessPhone || user?.businessPhone || ''
      });
      // Check both casing variations for ProfileImageUrl
      const profileImageUrl = user?.ProfileImageUrl || user?.profileImageUrl;
      if (profileImageUrl) {
        setProfileImage(profileImageUrl);
      } else {
        setProfileImage(avatar1);
      }
    }
  }, [user]);

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      openSnackbar({
        open: true,
        message: 'Please select a valid image file',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      openSnackbar({
        open: true,
        message: 'Image size must be less than 5MB',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setImageUploading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImage(e.target.result);
      };
      reader.readAsDataURL(file);

      // Upload to server
      const formData = new FormData();
      formData.append('file', file);

      const response = await axiosServices.post('/api/user/upload-profile-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data?.success) {
        const imageUrl = response.data.data?.imageUrl || response.data.data?.profileImageUrl;
        if (imageUrl) {
          setProfileImage(imageUrl);
          // Reload user from server to get the latest data including ProfileImageUrl
          if (reloadUser) {
            try {
              await reloadUser();
            } catch (error) {
              console.error('Error reloading user:', error);
              // Fallback to local update if reload fails
              if (updateUser) {
                updateUser({ ProfileImageUrl: imageUrl, profileImageUrl: imageUrl });
              }
            }
          } else if (updateUser) {
            // Fallback if reloadUser is not available
            updateUser({ ProfileImageUrl: imageUrl, profileImageUrl: imageUrl });
          }
        }
        openSnackbar({
          open: true,
          message: 'Profile image updated successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        throw new Error(response.data?.message || 'Failed to upload image');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to upload profile image',
        variant: 'alert',
        alert: { color: 'error' }
      });
      // Revert to previous image on error
      setProfileImage(user?.ProfileImageUrl || avatar1);
    } finally {
      setImageUploading(false);
    }
  };

  const handleProfileChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleBusinessChange = (e) => {
    setBusinessData({
      ...businessData,
      [e.target.name]: e.target.value
    });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess(false);
    
    try {
      const response = await axiosServices.put('/api/user/update-account', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        businessName: businessData.businessName,
        businessEmail: businessData.businessEmail,
        businessPhone: businessData.businessPhone
      });
      
      if (response.data?.success && response.data?.data) {
        if (updateUser) {
          updateUser({
            FirstName: response.data.data.Firstname || response.data.data.firstname,
            LastName: response.data.data.Lastname || response.data.data.lastname,
            Email: response.data.data.Email || response.data.data.email,
            PhoneNumber: response.data.data.PhoneNumber || response.data.data.phoneNumber,
            BusinessName: response.data.data.BusinessName || response.data.data.businessName,
            BusinessEmail: response.data.data.BusinessEmail || response.data.data.businessEmail,
            BusinessPhone: response.data.data.BusinessPhone || response.data.data.businessPhone
          });
        }
        
        openSnackbar({
          open: true,
          message: response.data?.message || 'Profile updated successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setProfileSuccess(true);
        setIsEditing(false);
        setTimeout(() => setProfileSuccess(false), 3000);
        // Reset form data after successful save
        setFormData({
          firstName: response.data.data.Firstname || response.data.data.firstname || '',
          lastName: response.data.data.Lastname || response.data.data.lastname || '',
          email: response.data.data.Email || response.data.data.email || '',
          phoneNumber: response.data.data.PhoneNumber || response.data.data.phoneNumber || ''
        });
      } else {
        throw new Error(response.data?.message || 'Failed to update profile');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to update profile',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleBusinessSubmit = async (e) => {
    e.preventDefault();
    setBusinessLoading(true);
    setBusinessSuccess(false);
    
    try {
      const response = await axiosServices.put('/api/user/update-account', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        businessName: businessData.businessName,
        businessEmail: businessData.businessEmail,
        businessPhone: businessData.businessPhone
      });
      
      if (response.data?.success && response.data?.data) {
        if (updateUser) {
          updateUser({
            FirstName: response.data.data.Firstname || response.data.data.firstname,
            LastName: response.data.data.Lastname || response.data.data.lastname,
            Email: response.data.data.Email || response.data.data.email,
            PhoneNumber: response.data.data.PhoneNumber || response.data.data.phoneNumber,
            BusinessName: response.data.data.BusinessName || response.data.data.businessName,
            BusinessEmail: response.data.data.BusinessEmail || response.data.data.businessEmail,
            BusinessPhone: response.data.data.BusinessPhone || response.data.data.businessPhone
          });
        }
        
        openSnackbar({
          open: true,
          message: response.data?.message || 'Business information updated successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setBusinessSuccess(true);
        setIsEditingBusiness(false);
        setTimeout(() => setBusinessSuccess(false), 3000);
        // Reset form data after successful save
        setBusinessData({
          businessName: response.data.data.BusinessName || response.data.data.businessName || '',
          businessEmail: response.data.data.BusinessEmail || response.data.data.businessEmail || '',
          businessPhone: response.data.data.BusinessPhone || response.data.data.businessPhone || ''
        });
      } else {
        throw new Error(response.data?.message || 'Failed to update business information');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to update business information',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setBusinessLoading(false);
    }
  };

  const displayName = `${user?.FirstName || user?.firstname || ''} ${user?.LastName || user?.lastname || ''}`.trim();

  return (
    <Box>
      <Stack spacing={3}>
        {/* Profile Information */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <UserOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Typography variant="h6" fontWeight="bold">
                Profile Information
              </Typography>
            </Box>
            <Button
              onClick={() => setIsEditing(true)}
              variant="text"
              size="small"
              startIcon={<EditOutlined style={{ fontSize: 16 }} />}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: alpha('#1890ff', 0.08)
                }
              }}
            >
              Edit
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Manage your profile information and personal details.
          </Typography>

          {profileSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setProfileSuccess(false)}>
              Profile updated successfully!
            </Alert>
          )}

          <Box>
            <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar alt="profile user" src={profileImage} sx={{ width: 80, height: 80 }} />
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                    width: 28,
                    height: 28
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                >
                  <CameraOutlined style={{ fontSize: 14 }} />
                </IconButton>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleProfileImageChange}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {displayName || 'No name'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <MailOutlined style={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />
                  <Typography variant="body2" color="text.secondary">
                    {user?.Email || user?.email || 'No email'}
                  </Typography>
                </Stack>
                {user?.PhoneNumber || user?.phoneNumber ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneOutlined style={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />
                    <Typography variant="body2" color="text.secondary">
                      {user?.PhoneNumber || user?.phoneNumber}
                    </Typography>
                  </Stack>
                ) : null}
              </Box>
            </Stack>
          </Box>
        </Paper>

        {/* Business Information */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShopOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Typography variant="h6" fontWeight="bold">
                Business Information
              </Typography>
            </Box>
            <Button
              onClick={() => setIsEditingBusiness(true)}
              variant="text"
              size="small"
              startIcon={<EditOutlined style={{ fontSize: 16 }} />}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: alpha('#1890ff', 0.08)
                }
              }}
            >
              Edit
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Update your business information and contact details.
          </Typography>

          {businessSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setBusinessSuccess(false)}>
              Business information updated successfully!
            </Alert>
          )}

          <Box>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Business Name
                </Typography>
                <Typography variant="body1">
                  {businessData.businessName || 'Not set'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Business Email
                </Typography>
                <Typography variant="body1">
                  {businessData.businessEmail || 'Not set'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Business Phone
                </Typography>
                <Typography variant="body1">
                  {businessData.businessPhone || 'Not set'}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>

        {/* Current Organization */}
        {currentOrganization && (
          <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BankOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                <Typography variant="h6" fontWeight="bold">
                  Current Organization
                </Typography>
              </Box>
              <Button
                onClick={() => setEditOrgModalOpen(true)}
                variant="text"
                size="small"
                startIcon={<EditOutlined style={{ fontSize: 16 }} />}
                sx={{
                  color: 'primary.main',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: alpha('#1890ff', 0.08)
                  }
                }}
              >
                Edit
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The organization you are currently working in.
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              {currentOrganization.name || 'No organization name'}
            </Typography>
            {currentOrganization.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {currentOrganization.description}
              </Typography>
            )}
          </Paper>
        )}
      </Stack>

      {/* Profile Edit Modal */}
      <Dialog
        open={isEditing}
        onClose={() => {
          setIsEditing(false);
          setFormData({
            firstName: user?.FirstName || user?.firstname || '',
            lastName: user?.LastName || user?.lastname || '',
            email: user?.Email || user?.email || '',
            phoneNumber: user?.PhoneNumber || user?.phoneNumber || ''
          });
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <UserOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Edit Profile Information
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <form onSubmit={handleProfileSubmit} id="profile-edit-form">
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar alt="profile user" src={profileImage} sx={{ width: 100, height: 100 }} />
                  <IconButton
                    size="small"
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                      width: 32,
                      height: 32
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    <CameraOutlined style={{ fontSize: 16 }} />
                  </IconButton>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleProfileImageChange}
                  />
                </Box>
              </Box>
              <TextField
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleProfileChange}
                fullWidth
                variant="outlined"
                size="medium"
              />
              <TextField
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleProfileChange}
                fullWidth
                variant="outlined"
                size="medium"
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleProfileChange}
                fullWidth
                variant="outlined"
                size="medium"
                InputProps={{
                  startAdornment: <MailOutlined style={{ marginRight: 8, color: '#999' }} />
                }}
              />
              <TextField
                label="Phone Number"
                name="phoneNumber"
                value={formData.phoneNumber || ''}
                onChange={handleProfileChange}
                fullWidth
                variant="outlined"
                size="medium"
                placeholder="Enter phone number"
                InputProps={{
                  startAdornment: <PhoneOutlined style={{ marginRight: 8, color: '#999' }} />
                }}
              />
            </Stack>
          </form>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setIsEditing(false);
              setFormData({
                firstName: user?.FirstName || user?.firstname || '',
                lastName: user?.LastName || user?.lastname || '',
                email: user?.Email || user?.email || '',
                phoneNumber: user?.PhoneNumber || user?.phoneNumber || ''
              });
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="profile-edit-form"
            variant="contained"
            disabled={profileLoading}
          >
            {profileLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Business Information Edit Modal */}
      <Dialog
        open={isEditingBusiness}
        onClose={() => {
          setIsEditingBusiness(false);
          setBusinessData({
            businessName: user?.BusinessName || user?.businessName || '',
            businessEmail: user?.BusinessEmail || user?.businessEmail || '',
            businessPhone: user?.BusinessPhone || user?.businessPhone || ''
          });
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <ShopOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Edit Business Information
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <form onSubmit={handleBusinessSubmit} id="business-edit-form">
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Business Name"
                name="businessName"
                value={businessData.businessName}
                onChange={handleBusinessChange}
                fullWidth
                variant="outlined"
                size="medium"
              />
              <TextField
                label="Business Email"
                name="businessEmail"
                type="email"
                value={businessData.businessEmail}
                onChange={handleBusinessChange}
                fullWidth
                variant="outlined"
                size="medium"
                InputProps={{
                  startAdornment: <MailOutlined style={{ marginRight: 8, color: '#999' }} />
                }}
              />
              <TextField
                label="Business Phone Number"
                name="businessPhone"
                value={businessData.businessPhone}
                onChange={handleBusinessChange}
                fullWidth
                variant="outlined"
                size="medium"
                InputProps={{
                  startAdornment: <PhoneOutlined style={{ marginRight: 8, color: '#999' }} />
                }}
              />
            </Stack>
          </form>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setIsEditingBusiness(false);
              setBusinessData({
                businessName: user?.BusinessName || user?.businessName || '',
                businessEmail: user?.BusinessEmail || user?.businessEmail || '',
                businessPhone: user?.BusinessPhone || user?.businessPhone || ''
              });
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="business-edit-form"
            variant="contained"
            disabled={businessLoading}
          >
            {businessLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Organization Modal */}
      {currentOrganization && (
        <EditOrganizationModal
          open={editOrgModalOpen}
          onClose={() => setEditOrgModalOpen(false)}
          organization={currentOrganization}
        />
      )}
    </Box>
  );
}
