import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  Alert,
  Stack,
  Button
} from '@mui/material';

// project imports
import { leaseTemplateAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

// ==============================|| TEMPLATE SELECTOR ||============================== //

export default function TemplateSelector({ selectedTemplate, onSelectTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await leaseTemplateAPI.getLeaseTemplates();
      if (response.success && response.data) {
        setTemplates(response.data);
        // Auto-select default if none selected
        if (!selectedTemplate && response.data.length > 0) {
          const defaultTemplate = response.data.find(t => t.isDefault) || response.data[0];
          onSelectTemplate(defaultTemplate);
        }
      } else {
        throw new Error(response.message || 'Failed to load templates');
      }
    } catch (err) {
      setError(err.message || 'Error loading templates');
      openSnackbar('error', err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button size="small" onClick={loadTemplates}>Retry</Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Select Lease Template
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose a template to use as the base for your lease agreement. You can customize it later.
      </Typography>

      <FormControl component="fieldset" fullWidth>
        <RadioGroup
          value={selectedTemplate?.id?.toString() || ''}
          onChange={(e) => {
            const template = templates.find(t => t.id.toString() === e.target.value);
            if (template) {
              onSelectTemplate(template);
            }
          }}
        >
          <Stack spacing={2}>
            {templates.map((template) => (
              <Card
                key={template.id}
                variant="outlined"
                sx={{
                  border: selectedTemplate?.id === template.id ? 2 : 1,
                  borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider'
                }}
              >
                <CardActionArea onClick={() => onSelectTemplate(template)}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Radio
                        checked={selectedTemplate?.id === template.id}
                        value={template.id.toString()}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <Typography variant="h6">{template.name}</Typography>
                          {template.isDefault && (
                            <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                              (Default)
                            </Typography>
                          )}
                          {template.isDefaultForLandlord && (
                            <Typography variant="caption" color="secondary" sx={{ fontWeight: 600 }}>
                              (Your Default)
                            </Typography>
                          )}
                        </Stack>
                        {template.description && (
                          <Typography variant="body2" color="text.secondary">
                            {template.description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                          {template.state && (
                            <Typography variant="caption" color="text.secondary">
                              State: {template.state}
                            </Typography>
                          )}
                          {template.propertyType && (
                            <Typography variant="caption" color="text.secondary">
                              Type: {template.propertyType}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            Version: {template.version}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </RadioGroup>
      </FormControl>
    </Box>
  );
}

TemplateSelector.propTypes = {
  selectedTemplate: PropTypes.object,
  onSelectTemplate: PropTypes.func.isRequired
};
