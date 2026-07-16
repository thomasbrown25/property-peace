import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FormControlLabel, Radio, RadioGroup, Stack, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { AppstoreOutlined, TableOutlined } from '@ant-design/icons';
import { saveSettings, getSettings } from 'store/user/user.action';
import { selectUserSettings } from 'store/user/user.selector';
import { openSnackbar } from 'api/snackbar';

// ==============================|| CUSTOMIZATION - PROPERTY LAYOUT ||============================== //

export default function PropertyLayout() {
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);
  const [layout, setLayout] = useState(userSettings?.propertyLayout || 'cards');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dispatch(getSettings());
  }, [dispatch]);

  useEffect(() => {
    if (userSettings?.propertyLayout) {
      setLayout(userSettings.propertyLayout);
    }
  }, [userSettings]);

  const handleLayoutChange = async (event, newLayout) => {
    if (newLayout === null || newLayout === layout) return;
    
    setLoading(true);
    try {
      const updatedSettings = {
        ...userSettings,
        propertyLayout: newLayout
      };
      
      await dispatch(saveSettings(updatedSettings));
      setLayout(newLayout);
      
      openSnackbar({
        open: true,
        message: 'Property layout preference saved.',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      console.error('Error saving property layout:', error);
      openSnackbar({
        open: true,
        message: 'Failed to save property layout preference.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Choose how you want to view properties on the Properties page.
      </Typography>
      
      <ToggleButtonGroup
        value={layout}
        exclusive
        onChange={handleLayoutChange}
        disabled={loading}
        aria-label="property layout"
        fullWidth
        sx={{
          '& .MuiToggleButton-root': {
            flex: 1,
            py: 1.5
          }
        }}
      >
        <ToggleButton value="cards" aria-label="cards">
          <Stack direction="row" spacing={1} alignItems="center">
            <AppstoreOutlined />
            <Typography>Card View</Typography>
          </Stack>
        </ToggleButton>
        <ToggleButton value="table" aria-label="table">
          <Stack direction="row" spacing={1} alignItems="center">
            <TableOutlined />
            <Typography>Table View</Typography>
          </Stack>
        </ToggleButton>
      </ToggleButtonGroup>
      
      <Typography variant="caption" color="text.secondary">
        Your preference will be saved and applied automatically.
      </Typography>
    </Stack>
  );
}

