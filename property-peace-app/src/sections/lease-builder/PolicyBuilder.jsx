import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Card,
  CardContent,
  Stack,
  Slider,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';

// project imports
import { policyPackAPI, leaseGenerationAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

// ==============================|| POLICY BUILDER ||============================== //

export default function PolicyBuilder({
  policyPack,
  customPolicies,
  formattedPolicies,
  onSelectPolicyPack,
  onCustomPoliciesChange,
  onFormattedPoliciesChange,
  onPolicyPacksReload,
  onPoliciesFilledFromPack,
  onToneChange,
  onNewPolicyPackCreated
}) {
  const [policyPacks, setPolicyPacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [tone, setTone] = useState('Neutral');
  const [customPolicyText, setCustomPolicyText] = useState('');
  const [error, setError] = useState(null);
  const formattedPackIdRef = useRef(null); // Track which pack we've formatted to avoid double-formatting
  
  // Add New Policy modal state
  const [newPolicyModalOpen, setNewPolicyModalOpen] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [creatingPolicy, setCreatingPolicy] = useState(false);

  useEffect(() => {
    loadPolicyPacks();
  }, []);

  // Reload policy packs when requested (e.g., after saving a new pack)
  useEffect(() => {
    // Reload when the trigger value changes (initial mount is handled by the first useEffect above)
    // Only reload if trigger is > 0 to avoid reloading on initial mount
    if (typeof onPolicyPacksReload === 'number' && onPolicyPacksReload > 0) {
      loadPolicyPacks();
    }
  }, [onPolicyPacksReload]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill policies when policy pack is selected (but don't auto-format)
  useEffect(() => {
    const items = policyPack?.items || policyPack?.Items || [];
    // Only auto-fill if:
    // 1. We have a policy pack
    // 2. The pack has items
    // 3. We're not currently loading or formatting
    // 4. We haven't already filled this pack (check if custom policies match)
    if (policyPack && items.length > 0 && !loading && !formatting) {
      // Check if we need to fill policies (if custom policies are empty or don't match)
      const shouldFill = customPolicies.length === 0 || formattedPackIdRef.current !== policyPack.id;
      
      if (shouldFill) {
        // Use a small delay to ensure loadPolicyPacks has finished if it's running
        const timer = setTimeout(() => {
          fillPoliciesFromPack(policyPack);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [policyPack?.id]); // Only trigger when policyPack changes (by ID to avoid infinite loops)

  useEffect(() => {
    if (customPolicies && customPolicies.length > 0) {
      setCustomPolicyText(customPolicies.join('\n'));
    }
  }, []);

  // Track if we should auto-format when tone changes
  const [shouldAutoFormat, setShouldAutoFormat] = useState(false);

  // Auto-format policies when tone changes (if a pack is selected or policies are already formatted)
  useEffect(() => {
    if (!shouldAutoFormat) return;
    
    const autoFormat = async () => {
      const items = policyPack?.items || policyPack?.Items || [];
      if (policyPack && items.length > 0) {
        await handlePolicyPackSelected(policyPack);
      } else if (customPolicies && customPolicies.length > 0 && formattedPolicies) {
        setFormatting(true);
        try {
          const formatResponse = await leaseGenerationAPI.formatPolicies(customPolicies, tone);
          if (formatResponse.success && formatResponse.data) {
            onFormattedPoliciesChange(formatResponse.data);
          }
        } catch (err) {
          console.error('Error re-formatting policies:', err);
        } finally {
          setFormatting(false);
        }
      }
      setShouldAutoFormat(false);
    };

    // Debounce the auto-format
    const timer = setTimeout(() => {
      autoFormat();
    }, 500);

    return () => clearTimeout(timer);
  }, [tone]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPolicyPacks = async () => {
    try {
      setLoading(true);
      const response = await policyPackAPI.getPolicyPacks();
      // Extract the data array from ServiceResponse
      const packs = (response?.success && response?.data) ? response.data : (Array.isArray(response) ? response : []);
      
      if (Array.isArray(packs)) {
        setPolicyPacks(packs);
        // Auto-select default if none selected
        if (!policyPack && packs.length > 0) {
          const defaultPack = packs.find(p => p.isDefault) || packs[0];
          onSelectPolicyPack(defaultPack);
          // Auto-fill policies from default pack (but don't auto-format)
          fillPoliciesFromPack(defaultPack);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load policy packs');
      console.error('Error loading policy packs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomPoliciesChange = (text) => {
    setCustomPolicyText(text);
    const policies = text.split('\n').filter(p => p.trim().length > 0);
    onCustomPoliciesChange(policies);
  };

  const handleAISuggestPolicies = async () => {
    setSuggesting(true);
    setError(null);

    try {
      const suggestResponse = await suggestPolicies(tone);
      if (!suggestResponse.success || !suggestResponse.data) {
        throw new Error(suggestResponse.message || 'Failed to get suggested policies');
      }

      const suggestedPolicies = suggestResponse.data;
      
      // Update custom policies with suggested policies
      onCustomPoliciesChange(suggestedPolicies);
      const updatedText = suggestedPolicies.join('\n');
      setCustomPolicyText(updatedText);
      
      openSnackbar('success', `AI suggested ${suggestedPolicies.length} policies`);
    } catch (err) {
      setError(err.message || 'Error suggesting policies with AI');
      openSnackbar('error', err.message || 'Failed to suggest policies with AI');
    } finally {
      setSuggesting(false);
    }
  };

  const handleAIFormatPolicies = async () => {
    if (!customPolicies || customPolicies.length === 0) {
      openSnackbar('warning', 'Please add some policies to format first');
      return;
    }

    setFormatting(true);
    setError(null);

    try {
      const formatResponse = await formatPolicies(customPolicies, tone);
      if (formatResponse.success && formatResponse.data) {
        onFormattedPoliciesChange(formatResponse.data);
        openSnackbar('success', `AI formatted ${customPolicies.length} policies`);
      } else {
        throw new Error(formatResponse.message || 'Failed to format policies');
      }
    } catch (err) {
      setError(err.message || 'Error formatting policies with AI');
      openSnackbar('error', err.message || 'Failed to format policies with AI');
    } finally {
      setFormatting(false);
    }
  };

  const handleAIBuildPolicies = async () => {
    setFormatting(true);
    setSuggesting(true);
    setError(null);

    try {
      // First, get suggested policies
      const suggestResponse = await suggestPolicies(tone);
      if (!suggestResponse.success || !suggestResponse.data) {
        throw new Error(suggestResponse.message || 'Failed to get suggested policies');
      }

      const suggestedPolicies = suggestResponse.data;
      
      // Update custom policies with suggested policies
      onCustomPoliciesChange(suggestedPolicies);
      const updatedText = suggestedPolicies.join('\n');
      setCustomPolicyText(updatedText);

      // Then format the suggested policies
      const formatResponse = await formatPolicies(suggestedPolicies, tone);
      if (formatResponse.success && formatResponse.data) {
        onFormattedPoliciesChange(formatResponse.data);
        openSnackbar('success', `AI generated and formatted ${suggestedPolicies.length} policies`);
      } else {
        throw new Error(formatResponse.message || 'Failed to format policies');
      }
    } catch (err) {
      setError(err.message || 'Error building policies with AI');
      openSnackbar('error', err.message || 'Failed to build policies with AI');
    } finally {
      setFormatting(false);
      setSuggesting(false);
    }
  };

  // Fill policies from pack without formatting (just populate the custom policies input)
  const fillPoliciesFromPack = (pack) => {
    // Handle both camelCase and PascalCase property names
    const items = pack?.items || pack?.Items || [];
    if (!pack || items.length === 0) {
      return;
    }

    // Mark this pack as filled to prevent double-filling
    formattedPackIdRef.current = pack.id;

    // Extract policy content from pack items
    // Use Content if available, otherwise use Title
    const policyOneLiners = items
      .sort((a, b) => {
        const orderA = a.order || a.Order || 0;
        const orderB = b.order || b.Order || 0;
        return orderA - orderB;
      })
      .map(item => {
        // Handle both camelCase and PascalCase
        const content = item.content || item.Content || '';
        const title = item.title || item.Title || '';
        
        // If Content exists and is meaningful, use it; otherwise use Title
        if (content && content.trim().length > 0) {
          return content.trim();
        }
        return title.trim();
      })
      .filter(p => p.length > 0);

    // Update custom policies with pack items (but don't format)
    onCustomPoliciesChange(policyOneLiners);
    const updatedText = policyOneLiners.join('\n');
    setCustomPolicyText(updatedText);
    
    // Notify parent that policies were filled from pack (for tracking original)
    if (onPoliciesFilledFromPack) {
      onPoliciesFilledFromPack(policyOneLiners);
    }
  };

  const handlePolicyPackSelected = async (pack) => {
    // Handle both camelCase and PascalCase property names
    const items = pack?.items || pack?.Items || [];
    if (!pack || items.length === 0) {
      return;
    }

    // Mark this pack as formatted to prevent double-formatting
    formattedPackIdRef.current = pack.id;
    
    setFormatting(true);
    setError(null);

    try {
      // Extract policy content from pack items
      // Use Content if available, otherwise use Title
      const policyOneLiners = items
        .sort((a, b) => {
          const orderA = a.order || a.Order || 0;
          const orderB = b.order || b.Order || 0;
          return orderA - orderB;
        })
        .map(item => {
          // Handle both camelCase and PascalCase
          const content = item.content || item.Content || '';
          const title = item.title || item.Title || '';
          
          // If Content exists and is meaningful, use it; otherwise use Title
          if (content && content.trim().length > 0) {
            return content.trim();
          }
          return title.trim();
        })
        .filter(p => p.length > 0);

      // Update custom policies with pack items
      onCustomPoliciesChange(policyOneLiners);
      const updatedText = policyOneLiners.join('\n');
      setCustomPolicyText(updatedText);

      // Format the policies with current tone
      const formatResponse = await formatPolicies(policyOneLiners, tone);
      if (formatResponse.success && formatResponse.data) {
        onFormattedPoliciesChange(formatResponse.data);
        openSnackbar('success', `Loaded and formatted ${policyOneLiners.length} policies from ${pack.name}`);
      } else {
        throw new Error(formatResponse.message || 'Failed to format policies');
      }
    } catch (err) {
      setError(err.message || 'Error loading policy pack');
      openSnackbar('error', err.message || 'Failed to load policy pack');
    } finally {
      setFormatting(false);
    }
  };

  const handleReset = () => {
    // Clear custom policies
    onCustomPoliciesChange([]);
    setCustomPolicyText('');
    
    // Reset tone to Neutral
    setTone('Neutral');
    
    // Unselect policy pack
    onSelectPolicyPack(null);
    
    // Clear formatted policies
    onFormattedPoliciesChange(null);
    
    // Reset formatted pack tracking
    formattedPackIdRef.current = null;
    
    openSnackbar('success', 'Policies reset');
  };

  const handleCreateNewPolicyPack = async () => {
    if (!newPolicyName.trim()) {
      openSnackbar('error', 'Please enter a name for the policy pack');
      return;
    }

    setCreatingPolicy(true);
    try {
      // Create an empty policy pack (policies will be saved when clicking next)
      const createData = {
        name: newPolicyName.trim(),
        description: 'Custom policy pack',
        items: []
      };
      
      const response = await createPolicyPack(createData);
      if (response?.success && response?.data) {
        // Select the newly created policy pack
        onSelectPolicyPack(response.data);
        
        // Notify parent that a new policy pack was created
        if (onNewPolicyPackCreated) {
          onNewPolicyPackCreated(response.data);
        }
        
        // Reload policy packs list
        await loadPolicyPacks();
        
        // Close modal
        setNewPolicyModalOpen(false);
        setNewPolicyName('');
        
        openSnackbar('success', 'Policy pack created successfully');
      } else {
        throw new Error(response?.message || 'Failed to create policy pack');
      }
    } catch (err) {
      console.error('Error creating policy pack:', err);
      openSnackbar('error', err.message || 'Failed to create policy pack');
    } finally {
      setCreatingPolicy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Policies & House Rules
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select a policy pack or add custom policies. Use AI to format them professionally.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth sx={{ mt: 3}}>
            <InputLabel>Policy Pack (Optional)</InputLabel>
            <Select
              value={policyPack?.id || ''}
              label="Policy Pack (Optional)"
              onChange={async (e) => {
                const value = e.target.value;
                
                // Check if "Add New Policy" was selected
                if (value === '__add_new__') {
                  setNewPolicyModalOpen(true);
                  return;
                }
                
                const pack = policyPacks.find(p => p.id === value);
                onSelectPolicyPack(pack || null);
                
                // If a pack is selected, fill policies (but don't auto-format)
                const items = pack?.items || pack?.Items || [];
                if (pack && items.length > 0) {
                  setShouldAutoFormat(false); // Prevent tone effect from triggering
                  fillPoliciesFromPack(pack);
                } else if (!pack) {
                  // Clear formatted policies when no pack is selected
                  setShouldAutoFormat(false);
                  onFormattedPoliciesChange(null);
                  onCustomPoliciesChange([]);
                  setCustomPolicyText('');
                  formattedPackIdRef.current = null; // Reset tracking
                }
              }}
            >
              <MenuItem value="">None</MenuItem>
              {policyPacks.map((pack) => (
                <MenuItem key={pack.id} value={pack.id}>
                  {pack.name} {pack.isDefault && '(Default)'}
                </MenuItem>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <MenuItem value="__add_new__" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                + Add New Policy Pack
              </MenuItem>
            </Select>
          </FormControl>

          {policyPack && (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Selected Pack: {policyPack.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(policyPack.items || policyPack.Items || []).length} policies included
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tone: {tone}
          </Typography>
          <Box sx={{ px: 1 }}>
            <Slider
              value={tone === 'Strict' ? 0 : tone === 'Friendly' ? 100 : 50}
              onChange={(e, value) => {
                const newTone = value < 33 ? 'Strict' : value > 66 ? 'Friendly' : 'Neutral';
                setTone(newTone);
                
                // Notify parent of tone change
                if (onToneChange) {
                  onToneChange(newTone);
                }
                
                // Trigger auto-format if we have policies to format
                const items = policyPack?.items || policyPack?.Items || [];
                if ((policyPack && items.length > 0) || 
                    (customPolicies && customPolicies.length > 0 && formattedPolicies)) {
                  setShouldAutoFormat(true);
                }
              }}
              marks={[
                { value: 0, label: 'Strict' },
                { value: 50, label: 'Neutral' },
                { value: 100, label: 'Friendly' }
              ]}
              step={null}
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Custom Policies
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Enter one policy per line. These will be formatted professionally.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={8}
            value={customPolicyText}
            onChange={(e) => handleCustomPoliciesChange(e.target.value)}
            placeholder="Enter policies, one per line:&#10;Quiet hours 10 PM to 7 AM&#10;No smoking inside&#10;Parking in assigned spaces only"
            variant="outlined"
          />
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ReloadOutlined />}
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={suggesting ? <CircularProgress size={16} /> : <ThunderboltOutlined />}
              onClick={handleAISuggestPolicies}
              disabled={suggesting || formatting}
            >
              {suggesting ? 'Suggesting...' : 'Let AI Suggest Policy'}
            </Button>
            <Button
              variant="contained"
              startIcon={formatting ? <CircularProgress size={16} /> : <ThunderboltOutlined />}
              onClick={handleAIFormatPolicies}
              disabled={formatting || suggesting}
            >
              {formatting ? 'Formatting...' : 'Let AI Format Policy'}
            </Button>
          </Stack>
        </Grid>

        {formattedPolicies && (
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 2 }} />
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Formatted Policies
                </Typography>
                {formattedPolicies.policies && formattedPolicies.policies.length > 0 && (
                  <Stack spacing={2} sx={{ mb: 2 }}>
                    {formattedPolicies.policies.map((policy, index) => (
                      <Box key={index}>
                        <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle2">{policy.title}</Typography>
                          {policy.category && (
                            <Chip label={policy.category} size="small" variant="outlined" />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {policy.body}
                        </Typography>
                        {policy.riskFlags && policy.riskFlags.length > 0 && (
                          <Alert severity="warning" sx={{ mt: 1 }}>
                            {policy.riskFlags.join(', ')}
                          </Alert>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
                {formattedPolicies.markdown && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Formatted Markdown:
                    </Typography>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {formattedPolicies.markdown}
                    </Typography>
                  </Box>
                )}
                <Alert severity="info" sx={{ mt: 2 }}>
                  AI-generated content. Legal review recommended before finalizing.
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Add New Policy Pack Dialog */}
      <Dialog 
        open={newPolicyModalOpen} 
        onClose={() => {
          setNewPolicyModalOpen(false);
          setNewPolicyName('');
        }}
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Create New Policy Pack</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter a name for your new policy pack. The custom policies you've entered will be saved to this pack when you click Next.
          </Typography>
          <TextField
            fullWidth
            label="Policy Pack Name"
            value={newPolicyName}
            onChange={(e) => setNewPolicyName(e.target.value)}
            placeholder="My Policy Pack"
            disabled={creatingPolicy}
            sx={{ mt: 1 }}
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newPolicyName.trim() && !creatingPolicy) {
                handleCreateNewPolicyPack();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setNewPolicyModalOpen(false);
              setNewPolicyName('');
            }}
            disabled={creatingPolicy}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateNewPolicyPack}
            disabled={creatingPolicy || !newPolicyName.trim()}
            startIcon={creatingPolicy ? <CircularProgress size={16} /> : null}
          >
            {creatingPolicy ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

PolicyBuilder.propTypes = {
  policyPack: PropTypes.object,
  customPolicies: PropTypes.array.isRequired,
  formattedPolicies: PropTypes.object,
  onSelectPolicyPack: PropTypes.func.isRequired,
  onCustomPoliciesChange: PropTypes.func.isRequired,
  onFormattedPoliciesChange: PropTypes.func.isRequired,
  onPolicyPacksReload: PropTypes.any, // Can be a trigger value that changes to reload
  onPoliciesFilledFromPack: PropTypes.func, // Callback when policies are filled from a pack
  onToneChange: PropTypes.func, // Callback when tone changes
  onNewPolicyPackCreated: PropTypes.func // Callback when a new policy pack is created
};
