import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  LinearProgress,
  Chip,
  Grid,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  Slider,
  InputLabel,
  Select,
  MenuItem,
  alpha,
  useTheme
} from '@mui/material';
import {
  AuditOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  HomeOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import PropertyUnitSelector from './PropertyUnitSelector';
import { Tooltip } from '@mui/material';

// project imports
import { leaseTemplateAPI, leaseGenerationAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import Avatar from 'components/@extended/Avatar';
import useFetchProperties from 'hooks/useFetchProperties';

const steps = [
  {
    label: 'Property & unit',
    description: 'Choose the lease location.',
    icon: HomeOutlined
  },
  {
    label: 'Lease template',
    description: 'Pick or edit agreement language.',
    icon: FileProtectOutlined
  },
  {
    label: 'Review & confirm',
    description: 'Verify details before creating.',
    icon: AuditOutlined
  }
];

// ==============================|| LEASE AGREEMENT BUILDER ||============================== //

export default function LeaseAgreementBuilder({ onComplete }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get data from URL params
  const leaseId = searchParams.get('leaseId') ? parseInt(searchParams.get('leaseId')) : null;
  const propertyId = searchParams.get('propertyId') ? parseInt(searchParams.get('propertyId')) : null;
  const unitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')) : null;
  const tenantIdsParam = searchParams.get('tenantIds');
  const tenantIds = tenantIdsParam ? tenantIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
  
  // State
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [lease, setLease] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isCreatingNewTemplate, setIsCreatingNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [customPolicies, setCustomPolicies] = useState([]);
  const [leaseInstanceId, setLeaseInstanceId] = useState(null);
  const [viewTemplateDialogOpen, setViewTemplateDialogOpen] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [tone, setTone] = useState('Neutral');
  const [suggesting, setSuggesting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [signLeaseDialogOpen, setSignLeaseDialogOpen] = useState(false);
  const [createdLeaseId, setCreatedLeaseId] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyState, setSelectedPropertyState] = useState(null);
  const [selectedUnitState, setSelectedUnitState] = useState(null);
  const [leaseAgreementsMap, setLeaseAgreementsMap] = useState(new Map()); // Map<leaseId, hasFinalizedAgreement>

  const { properties: fetchedProperties } = useFetchProperties();

  // Pre-select property and unit from URL params - this runs whenever fetchedProperties or URL params change
  useEffect(() => {
    // Only proceed if we have the required params and properties are loaded
    if (!propertyId || !unitId) return;
    if (!fetchedProperties || !Array.isArray(fetchedProperties) || fetchedProperties.length === 0) return;
    
    // Find property by ID from fetched properties
    const foundProperty = fetchedProperties.find(p => p.id === propertyId);
    if (!foundProperty) {
      // Property not found in fetched list yet, wait a bit more
      return;
    }
    
    // Find unit by ID from property's units
    const foundUnit = foundProperty.units?.find(u => u.id === unitId);
    if (!foundUnit) {
      // Unit not found, might need to wait for units to load
      return;
    }
    
    // Only update if we don't already have the correct selection (avoid unnecessary re-renders)
    if (selectedPropertyState?.id !== propertyId || selectedUnitState?.id !== unitId) {
      // Set the selected property and unit (using objects from fetchedProperties for Autocomplete matching)
      setSelectedPropertyState(foundProperty);
      setProperty(foundProperty);
      setSelectedUnitState(foundUnit);
      setUnit(foundUnit);
      
      // Load lease if we have leaseId
      if (leaseId) {
        axiosServices.get(`/api/lease/${leaseId}`)
          .then(response => {
            if (response.data.success && response.data.data) {
              const loadedLease = response.data.data;
              setLease(loadedLease);
              // Ensure lease is attached to unit
              if (!foundUnit.lease && !foundUnit.Lease) {
                foundUnit.lease = loadedLease;
              }
            }
          })
          .catch(err => console.warn('Error loading lease:', err));
      } else {
        // Try to get lease from unit
        const unitLease = foundUnit.lease || foundUnit.Lease;
        if (unitLease) {
          setLease(unitLease);
        }
      }
    }
  }, [propertyId, unitId, leaseId, fetchedProperties, selectedPropertyState?.id, selectedUnitState?.id]);

  // Load data
  useEffect(() => {
    const initialize = async () => {
      // Always load properties first to populate the list
      await loadProperties();
      
      // If we have URL params, load that data and preselect
      if (leaseId || (propertyId && unitId)) {
        await loadData();
        
        // Wait for state to update, then check if we can proceed
        const checkAndProceed = async () => {
          // Check if unit has lease and doesn't have finalized agreement
          const currentUnit = unit || selectedUnitState;
          const currentProperty = property || selectedPropertyState;
          const currentLease = lease;
          
          if (currentUnit && currentProperty) {
            const unitLease = currentUnit.lease || currentUnit.Lease || currentLease;
            if (unitLease?.id) {
              await checkLeaseAgreements();
              // Wait for map to update
              setTimeout(() => {
                const hasAgreement = leaseAgreementsMap.get(unitLease.id) === true;
                if (!hasAgreement) {
                  // Valid - can proceed to template selection
                  setActiveStep(1);
                  loadTemplates();
                } else {
                  // Has agreement - show error and go to step 0 (but keep preselection)
                  setActiveStep(0);
                  openSnackbar('error', 'This lease already has a finalized agreement.');
                }
              }, 200);
            } else {
              // No lease - go to step 0 (but keep preselection)
              setActiveStep(0);
              openSnackbar('error', 'Selected unit does not have a lease. Please create a lease first.');
            }
          } else {
            // Data didn't load properly, go to step 0
            setActiveStep(0);
          }
        };
        
        // Use a small delay to ensure state is updated
        setTimeout(checkAndProceed, 200);
      } else {
        // Start with property/unit selection
        setActiveStep(0);
      }
    };
    
    initialize();
  }, [leaseId, propertyId, unitId]);

  // Load properties and check for lease agreements
  const loadProperties = async () => {
    try {
      setLoading(true);
      // Properties are loaded via useFetchProperties hook
      // Now check which leases have finalized agreements
      await checkLeaseAgreements();
    } catch (err) {
      console.error('Error loading properties:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check which leases have finalized agreements
  const checkLeaseAgreements = async () => {
    try {
      const map = new Map();
      
      // Get all properties with their units and leases
      if (fetchedProperties && Array.isArray(fetchedProperties)) {
        for (const prop of fetchedProperties) {
          const units = prop.units || [];
          for (const unit of units) {
            const unitLease = unit.lease || unit.Lease;
            if (unitLease?.id) {
              try {
                // Check if this lease has a finalized instance
                const instancesResponse = await axiosServices.get(`/api/LeaseGeneration/lease/${unitLease.id}/instances`);
                if (instancesResponse.data?.success && instancesResponse.data?.data) {
                  const instances = instancesResponse.data.data;
                  const hasFinalized = instances.some(inst => inst.isFinalized === true);
                  map.set(unitLease.id, hasFinalized);
                }
              } catch (err) {
                console.warn(`Error checking lease instances for lease ${unitLease.id}:`, err);
              }
            }
          }
        }
      }
      
      setLeaseAgreementsMap(map);
    } catch (err) {
      console.error('Error checking lease agreements:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      // First, ensure default template exists for the organization
      try {
        await leaseTemplateAPI.ensureDefaultLeaseTemplate();
      } catch (err) {
        console.warn('Error ensuring default template:', err);
        // Continue even if this fails - we'll just load existing templates
      }

      // Then load all templates
      const templatesResponse = await leaseTemplateAPI.getLeaseTemplates();
      if (templatesResponse.success && templatesResponse.data) {
        setTemplates(templatesResponse.data);
        // Auto-select default if available
        const defaultTemplate = templatesResponse.data.find(t => t.isDefaultForLandlord) || 
                                templatesResponse.data.find(t => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate);
        }
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Wait for properties to be loaded first - retry if needed
      let retries = 0;
      while ((!fetchedProperties || fetchedProperties.length === 0) && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
      }
      
      // Try to find property/unit from fetchedProperties first (to match Autocomplete objects)
      let propertyToSelect = null;
      let unitToSelect = null;
      
      if (fetchedProperties && Array.isArray(fetchedProperties) && fetchedProperties.length > 0) {
        if (propertyId) {
          propertyToSelect = fetchedProperties.find(p => p.id === propertyId);
        }
        
        if (propertyToSelect && unitId) {
          unitToSelect = propertyToSelect.units?.find(u => u.id === unitId);
        }
      }
      
      // Load lease
      if (leaseId) {
        const leaseResponse = await axiosServices.get(`/api/lease/${leaseId}`);
        if (leaseResponse.data.success && leaseResponse.data.data) {
          const loadedLease = leaseResponse.data.data;
          setLease(loadedLease);
          
          // If we found property/unit from fetchedProperties, use those
          if (propertyToSelect && unitToSelect) {
            setProperty(propertyToSelect);
            setSelectedPropertyState(propertyToSelect);
            setUnit(unitToSelect);
            setSelectedUnitState(unitToSelect);
            // Ensure lease is set on unit
            if (!unitToSelect.lease && !unitToSelect.Lease) {
              unitToSelect.lease = loadedLease;
            }
          } else {
            // Fallback: load property and unit from lease
            if (loadedLease.propertyId) {
              const propResponse = await axiosServices.get(`/api/property/${loadedLease.propertyId}`);
              if (propResponse.data.success && propResponse.data.data) {
                const loadedProperty = propResponse.data.data;
                setProperty(loadedProperty);
                setSelectedPropertyState(loadedProperty);
                // Find unit
                const foundUnit = loadedProperty.units?.find(u => u.id === loadedLease.unitId);
                if (foundUnit) {
                  setUnit(foundUnit);
                  setSelectedUnitState(foundUnit);
                  // Ensure lease is set on unit
                  if (!foundUnit.lease && !foundUnit.Lease) {
                    foundUnit.lease = loadedLease;
                  }
                }
              }
            }
          }
        }
      } else if (propertyId && unitId) {
        // We have propertyId and unitId but no leaseId
        if (propertyToSelect && unitToSelect) {
          // Use the objects from fetchedProperties so Autocomplete can match them
          setProperty(propertyToSelect);
          setSelectedPropertyState(propertyToSelect);
          setUnit(unitToSelect);
          setSelectedUnitState(unitToSelect);
          
          // Load lease from unit
          const unitLease = unitToSelect.lease || unitToSelect.Lease;
          if (unitLease) {
            setLease(unitLease);
          } else {
            // Try to get lease by unitId
            try {
              const leaseResponse = await axiosServices.get(`/api/lease/${unitId}`);
              if (leaseResponse.data.success && leaseResponse.data.data) {
                const loadedLease = leaseResponse.data.data;
                setLease(loadedLease);
                unitToSelect.lease = loadedLease;
              }
            } catch (err) {
              // No lease found for this unit - that's okay
              console.warn('No lease found for unit:', err);
            }
          }
        } else {
          // Fallback: load property directly from URL param
          const propResponse = await axiosServices.get(`/api/property/${propertyId}`);
          if (propResponse.data.success && propResponse.data.data) {
            const loadedProperty = propResponse.data.data;
            setProperty(loadedProperty);
            setSelectedPropertyState(loadedProperty);
            
            // Try to find unit from property's units array
            const foundUnit = loadedProperty.units?.find(u => u.id === unitId);
            if (foundUnit) {
              setUnit(foundUnit);
              setSelectedUnitState(foundUnit);
              // Load lease from unit
              const unitLease = foundUnit.lease || foundUnit.Lease;
              if (unitLease) {
                setLease(unitLease);
                // Ensure lease is attached to unit
                if (!foundUnit.lease) {
                  foundUnit.lease = unitLease;
                }
              } else {
                // Try to get lease by unitId
                try {
                  const leaseResponse = await axiosServices.get(`/api/lease/${unitId}`);
                  if (leaseResponse.data.success && leaseResponse.data.data) {
                    const loadedLease = leaseResponse.data.data;
                    setLease(loadedLease);
                    foundUnit.lease = loadedLease;
                  }
                } catch (err) {
                  // No lease found for this unit - that's okay
                  console.warn('No lease found for unit:', err);
                }
              }
            }
          }
        }
      }

      // Load tenants
      if (tenantIds.length > 0) {
        const tenantPromises = tenantIds.map(id => axiosServices.get(`/api/tenant/${id}`));
        const tenantResponses = await Promise.all(tenantPromises);
        const loadedTenants = tenantResponses
          .map(res => res.data.success ? res.data.data : null)
          .filter(Boolean);
        setTenants(loadedTenants);
      } else if (lease?.tenants && Array.isArray(lease.tenants)) {
        setTenants(lease.tenants);
      }

      // Check lease agreements after loading properties
      await checkLeaseAgreements();
    } catch (err) {
      setError(err.message || 'Error loading data');
      openSnackbar('error', err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (activeStep === 0) {
      // Property/Unit selection step
      if (!selectedPropertyState || !selectedUnitState) {
        openSnackbar('error', 'Please select a property and unit');
        return;
      }

      // Check if unit has a lease
      const unitLease = selectedUnitState.lease || selectedUnitState.Lease || lease;
      if (!unitLease || !unitLease.id) {
        openSnackbar('error', 'Selected unit does not have a lease. Please create a lease first.');
        return;
      }

      // Ensure lease agreements map is checked
      await checkLeaseAgreements();
      
      // Wait a moment for map to update, then check
      setTimeout(() => {
        const hasAgreement = leaseAgreementsMap.get(unitLease.id) === true;
        if (hasAgreement) {
          openSnackbar('error', 'This lease already has a finalized agreement.');
          return;
        }

        // Load the lease and set property/unit
        setProperty(selectedPropertyState);
        setUnit(selectedUnitState);
        setLease(unitLease);
        
        // Load tenants from lease
        if (unitLease.tenants && Array.isArray(unitLease.tenants)) {
          setTenants(unitLease.tenants);
        }

        // Move to template selection step
        loadTemplates();
        setActiveStep(1);
      }, 100);
    } else if (activeStep === 1) {
      // Template selection step
      if (isCreatingNewTemplate && !isEditingTemplate) {
        // Creating new template - this shouldn't happen in normal flow, but handle it
        if (!newTemplateName.trim()) {
          openSnackbar('error', 'Please enter a template name');
          return;
        }
        // Create template and move to review
        await handleCreateNewTemplate();
      } else if (selectedTemplate) {
        // Template selected, move to review step
        setActiveStep(2);
      } else {
        openSnackbar('error', 'Please select a template');
      }
    }
  };

  const handleCreateNewTemplate = async () => {
    if (!newTemplateName.trim()) {
      openSnackbar('error', 'Please enter a template name');
      return;
    }

    setLoading(true);
    try {
      const templateData = {
        name: newTemplateName.trim(),
        description: 'Custom lease agreement template',
        templateStructure: '{}',
        policies: customPolicies.map((policy, index) => ({
          title: policy.substring(0, 50) + (policy.length > 50 ? '...' : ''),
          content: policy,
          category: 'General',
          order: index + 1
        }))
      };

      const createResponse = await leaseTemplateAPI.createLeaseTemplate(templateData);
      if (!createResponse.success || !createResponse.data) {
        throw new Error(createResponse.message || 'Failed to create template');
      }

      const createdTemplate = createResponse.data;
      setSelectedTemplate(createdTemplate);
      setIsCreatingNewTemplate(false);
      
      // Reload templates and move to review
      await loadTemplates();
      setActiveStep(2);
    } catch (err) {
      setError(err.message || 'Error creating template');
      openSnackbar('error', err.message || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplateAndFinalize = async () => {
    if (!newTemplateName.trim()) {
      openSnackbar('error', 'Please enter a template name');
      return;
    }

    setLoading(true);
    try {
      if (selectedTemplate && selectedTemplate.id) {
        // Update existing template
        const templateData = {
          id: selectedTemplate.id,
          name: newTemplateName.trim() || selectedTemplate.name,
          description: selectedTemplate.description || 'Custom lease agreement template',
          templateStructure: selectedTemplate.templateStructure || '{}',
          policies: customPolicies.map((policy, index) => ({
            title: policy.substring(0, 50) + (policy.length > 50 ? '...' : ''),
            content: policy,
            category: 'General',
            order: index + 1
          }))
        };

        const updateResponse = await leaseTemplateAPI.updateLeaseTemplate(selectedTemplate.id, templateData);
        if (!updateResponse.success || !updateResponse.data) {
          throw new Error(updateResponse.message || 'Failed to update template');
        }

        const updatedTemplate = updateResponse.data;
        setSelectedTemplate(updatedTemplate);
      } else {
        // Create new template with policies
        const templateData = {
          name: newTemplateName.trim(),
          description: 'Custom lease agreement template',
          templateStructure: '{}',
          policies: customPolicies.map((policy, index) => ({
            title: policy.substring(0, 50) + (policy.length > 50 ? '...' : ''),
            content: policy,
            category: 'General',
            order: index + 1
          }))
        };

        const createResponse = await leaseTemplateAPI.createLeaseTemplate(templateData);
        if (!createResponse.success || !createResponse.data) {
          throw new Error(createResponse.message || 'Failed to create template');
        }

        const createdTemplate = createResponse.data;
        setSelectedTemplate(createdTemplate);
      }
      
      // Now finalize
      await handleFinalize();
    } catch (err) {
      setError(err.message || 'Error creating/updating template');
      openSnackbar('error', err.message || 'Failed to create/update template');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedTemplate || !lease?.id) {
      openSnackbar('error', 'Template and lease are required');
      return;
    }

    setLoading(true);
    try {
      // Get lease terms from lease
      const leaseTerms = {
        startDate: lease?.startDate,
        endDate: lease?.endDate,
        monthlyRent: lease?.rentAmount,
        securityDeposit: lease?.depositAmount,
        rentDueDay: lease?.rentDueDay || 1
      };

      // Create lease instance
      const instanceData = {
        leaseId: lease.id,
        leaseTemplateId: selectedTemplate.id,
        propertyId: property?.id,
        unitId: unit?.id,
        tenantIds: tenants.map(t => t.id),
        startDate: leaseTerms.startDate,
        endDate: leaseTerms.endDate,
        monthlyRent: leaseTerms.monthlyRent,
        securityDeposit: leaseTerms.securityDeposit,
        rentDueDay: leaseTerms.rentDueDay,
        customPolicies: customPolicies.length > 0 ? customPolicies : null
      };

      const instanceResponse = await leaseGenerationAPI.createLeaseInstance(instanceData);
      if (!instanceResponse.success || !instanceResponse.data) {
        throw new Error(instanceResponse.message || 'Failed to create lease instance');
      }

      const instance = instanceResponse.data;
      setLeaseInstanceId(instance.id);

      // Finalize the instance
      const finalizeResponse = await leaseGenerationAPI.finalizeLeaseInstance(instance.id);
      if (!finalizeResponse.success || !finalizeResponse.data) {
        throw new Error(finalizeResponse.message || 'Failed to finalize lease agreement');
      }

      openSnackbar('success', 'Lease agreement created and finalized successfully');
      
      // Set the created lease ID and show sign dialog
      setCreatedLeaseId(lease.id);
      setSignLeaseDialogOpen(true);
    } catch (err) {
      setError(err.message || 'Error finalizing lease agreement');
      openSnackbar('error', err.message || 'Failed to finalize lease agreement');
    } finally {
      setLoading(false);
    }
  };

  const handleSignNow = () => {
    setSignLeaseDialogOpen(false);
    if (createdLeaseId) {
      navigate(`/landlord/leases/${createdLeaseId}?sign=true`);
    }
  };

  const handleSignLater = () => {
    setSignLeaseDialogOpen(false);
    if (createdLeaseId) {
      if (onComplete) {
        onComplete(createdLeaseId);
      } else {
        navigate(`/landlord/leases/${createdLeaseId}`);
      }
    }
  };

  const handleBack = () => {
    if (activeStep === 1 && (isCreatingNewTemplate || isEditingTemplate)) {
      // Go back to template selection, cancel editing
      setIsCreatingNewTemplate(false);
      setIsEditingTemplate(false);
      setSelectedTemplate(null);
      setNewTemplateName('');
      setCustomPolicies([]);
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep - 1);
    }
  };

  const renderInfoBanner = () => {
    // Check if property is single unit (single family or has only one unit)
    const propertyType = property?.propertyType?.toLowerCase();
    const isSingleFamily = propertyType === 'singlefamily' || propertyType === 'single-family';
    const totalUnits = property?.units?.length || 0;
    const isSingleUnitProperty = isSingleFamily || totalUnits === 1;

    // Get property name
    const propertyName = property?.name || 'N/A';
    
    // Get unit name
    const unitName = unit?.name || 'N/A';

    return (
      <Card variant="outlined" sx={{ mb: 3, bgcolor: 'grey.50' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Lease Information</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: isSingleUnitProperty ? 12 : 6 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Property:</strong> {propertyName}
              </Typography>
            </Grid>
            {!isSingleUnitProperty && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Unit:</strong> {unitName}
                </Typography>
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Tenants:</strong> {tenants.length > 0 ? tenants.map(t => `${t.firstname || ''} ${t.lastname || ''}`).filter(Boolean).join(', ') || 'None' : 'None'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const handleViewTemplate = (template) => {
    setViewingTemplate(template);
    setViewTemplateDialogOpen(true);
  };

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setNewTemplateName(template.name || '');
    setIsEditingTemplate(true);
    // Load policies from template
    if (template.policies && template.policies.length > 0) {
      const policies = template.policies
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(p => p.content || p.title)
        .filter(Boolean);
      setCustomPolicies(policies);
    } else {
      setCustomPolicies([]);
    }
    setIsCreatingNewTemplate(true);
    // Stay on step 1 (Choose Template), don't move to policies step
    // The edit UI will be shown inline
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      openSnackbar('error', 'Please enter a template name');
      return;
    }

    setLoading(true);
    try {
      const templateData = {
        name: newTemplateName.trim(),
        description: 'Custom lease agreement template',
        templateStructure: '{}',
        policies: customPolicies.map((policy, index) => ({
          title: policy.substring(0, 50) + (policy.length > 50 ? '...' : ''),
          content: policy,
          category: 'General',
          order: index + 1
        }))
      };

      if (isEditingTemplate && selectedTemplate?.id) {
        // Update existing template
        templateData.id = selectedTemplate.id;
        templateData.description = selectedTemplate.description || templateData.description;
        templateData.templateStructure = selectedTemplate.templateStructure || templateData.templateStructure;
        
        const updateResponse = await leaseTemplateAPI.updateLeaseTemplate(selectedTemplate.id, templateData);
        if (!updateResponse.success || !updateResponse.data) {
          throw new Error(updateResponse.message || 'Failed to update template');
        }

        const updatedTemplate = updateResponse.data;
        setSelectedTemplate(updatedTemplate);
        setIsEditingTemplate(false);
        setIsCreatingNewTemplate(false);
        
        openSnackbar('success', 'Template saved successfully');
      } else {
        // Create new template
        const createResponse = await leaseTemplateAPI.createLeaseTemplate(templateData);
        if (!createResponse.success || !createResponse.data) {
          throw new Error(createResponse.message || 'Failed to create template');
        }

        const createdTemplate = createResponse.data;
        setSelectedTemplate(createdTemplate);
        setIsCreatingNewTemplate(false);
        
        openSnackbar('success', 'Template created successfully');
      }
      
      // Reload templates
      await loadTemplates();
    } catch (err) {
      setError(err.message || 'Error saving template');
      openSnackbar('error', err.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
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
      setCustomPolicies(suggestedPolicies);
      
      openSnackbar('success', `AI suggested ${suggestedPolicies.length} policies`);
    } catch (err) {
      setError(err.message || 'Error suggesting policies with AI');
      openSnackbar('error', err.message || 'Failed to suggest policies with AI');
    } finally {
      setSuggesting(false);
    }
  };

  const handleDeleteTemplate = (template) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;

    setLoading(true);
    try {
      const deleteResponse = await deleteLeaseTemplate(templateToDelete.id);
      if (!deleteResponse.success) {
        throw new Error(deleteResponse.message || 'Failed to delete template');
      }

      openSnackbar('success', 'Template deleted successfully');
      
      // Reload templates
      await loadTemplates();
      
      // Clear selection if deleted template was selected
      if (selectedTemplate?.id === templateToDelete.id) {
        setSelectedTemplate(null);
      }
      
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    } catch (err) {
      setError(err.message || 'Error deleting template');
      openSnackbar('error', err.message || 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if unit can create agreement
  const canCreateAgreement = (unit) => {
    if (!unit) return { canCreate: false, reason: 'No unit selected' };
    const unitLease = unit.lease || unit.Lease;
    if (!unitLease || !unitLease.id) {
      return { canCreate: false, reason: 'Unit does not have a lease. Please create a lease first.' };
    }
    // Only block if we know for sure there's a finalized agreement
    // If map hasn't been populated yet, allow selection (validation happens on next step)
    const hasAgreement = leaseAgreementsMap.get(unitLease.id);
    if (hasAgreement === true) {
      return { canCreate: false, reason: 'This lease already has a finalized agreement.' };
    }
    // If map entry is false or undefined, allow selection
    return { canCreate: true, reason: '' };
  };

  // Helper to check if property can create agreement
  const propertyCanCreateAgreement = (property) => {
    if (!property) return { canCreate: false, reason: 'No property selected' };
    const units = property.units || [];
    if (units.length === 0) {
      return { canCreate: false, reason: 'Property has no units' };
    }
    // Check if at least one unit can create an agreement
    const availableUnits = units.filter(u => {
      const check = canCreateAgreement(u);
      return check.canCreate;
    });
    if (availableUnits.length === 0) {
      return { canCreate: false, reason: 'All units either have no lease or already have a finalized agreement' };
    }
    return { canCreate: true, reason: '' };
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        // Property/Unit Selection Step
        return (
          <Box>
            <Typography variant="h5" sx={{ mb: 3 }}>
              Select Property & Unit
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select a property and unit that has a lease. Properties or units that already have a lease agreement or don't have a lease will be disabled.
            </Typography>
            <PropertyUnitSelector
              selectedProperty={selectedPropertyState}
              selectedUnit={selectedUnitState}
              onSelectProperty={(prop) => {
                setSelectedPropertyState(prop);
                setSelectedUnitState(null);
              }}
              onSelectUnit={(unit) => {
                setSelectedUnitState(unit);
              }}
              canSelectProperty={(prop) => propertyCanCreateAgreement(prop).canCreate}
              canSelectUnit={(unit) => canCreateAgreement(unit).canCreate}
              getPropertyTooltip={(prop) => {
                const check = propertyCanCreateAgreement(prop);
                return check.canCreate ? '' : check.reason;
              }}
              getUnitTooltip={(unit) => {
                const check = canCreateAgreement(unit);
                return check.canCreate ? '' : check.reason;
              }}
            />
          </Box>
        );
      case 1:
        // Template Selection Step (with inline edit if editing or creating new)
        if (isEditingTemplate || isCreatingNewTemplate) {
          // Show edit template UI inline (for both editing and creating new)
          return (
            <Box>
              <Typography variant="h5" sx={{ mb: 3 }}>
                {isEditingTemplate ? `Edit Template: ${selectedTemplate?.name || ''}` : 'Create New Template'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {isEditingTemplate ? 'Modify the template name and policies below.' : 'Enter a template name and add policies below.'}
              </Typography>
              
              <TextField
                fullWidth
                label="Template Name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder={isCreatingNewTemplate && !isEditingTemplate ? "Enter template name" : "My Custom Template"}
                sx={{ mb: 3 }}
                required
              />
              
              <Grid container spacing={3} sx={{ mb: 3 }}>
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
                <Grid size={{ xs: 12, md: 6 }}>
                  <Button
                    variant="contained"
                    startIcon={suggesting ? <CircularProgress size={16} /> : <ThunderboltOutlined />}
                    onClick={handleAISuggestPolicies}
                    disabled={suggesting}
                    fullWidth
                    sx={{ mt: 3 }}
                  >
                    {suggesting ? 'Suggesting...' : 'Let AI Suggest Policies'}
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Policies
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Enter one policy per line. Use AI to suggest policies based on your preferred tone.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={10}
                value={customPolicies.join('\n')}
                onChange={(e) => {
                  const policies = e.target.value.split('\n').filter(p => p.trim().length > 0);
                  setCustomPolicies(policies);
                }}
                placeholder="Enter policies, one per line:&#10;Quiet hours 10 PM to 7 AM&#10;No smoking inside&#10;Parking in assigned spaces only"
                variant="outlined"
              />
              <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIsEditingTemplate(false);
                    setIsCreatingNewTemplate(false);
                    setSelectedTemplate(null);
                    setNewTemplateName('');
                    setCustomPolicies([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveTemplate}
                  disabled={loading || !newTemplateName.trim()}
                >
                  Save Template
                </Button>
              </Stack>
            </Box>
          );
        }
        
        // Normal template selection
        return (
          <Box>
            <Typography variant="h5" sx={{ mb: 3 }}>
              Select Lease Agreement Template
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose an existing template or create a new one with custom policies.
            </Typography>
            
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={isCreatingNewTemplate ? '__new__' : (selectedTemplate?.id?.toString() || '')}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    // Create new template - show inline editing form
                    setIsCreatingNewTemplate(true);
                    setIsEditingTemplate(false);
                    setSelectedTemplate(null);
                    setNewTemplateName('');
                    setCustomPolicies([]);
                  } else {
                    setIsCreatingNewTemplate(false);
                    const template = templates.find(t => t.id.toString() === e.target.value);
                    if (template) {
                      setSelectedTemplate(template);
                    }
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
                                <Chip label="Default" size="small" color="primary" />
                              )}
                              {template.isDefaultForLandlord && (
                                <Chip label="Your Default" size="small" color="secondary" />
                              )}
                              {template.policies && (
                                <Chip label={`${template.policies.length} policies`} size="small" variant="outlined" />
                              )}
                            </Stack>
                            {template.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {template.description}
                              </Typography>
                            )}
                            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleViewTemplate(template)}
                              >
                                View Policies
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleEditTemplate(template)}
                              >
                                Edit
                              </Button>
                              {!template.isDefault && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleDeleteTemplate(template)}
                                >
                                  Delete
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                  
                  <Card
                    variant="outlined"
                    sx={{
                      border: isCreatingNewTemplate ? 2 : 1,
                      borderColor: isCreatingNewTemplate ? 'primary.main' : 'divider',
                      borderStyle: 'dashed'
                    }}
                  >
                    <CardContent>
                      <FormControlLabel
                        control={<Radio value="__new__" />}
                        label={
                          <Box>
                            <Typography variant="h6">Create New Template</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Create a new lease agreement template with custom policies
                            </Typography>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                </Stack>
              </RadioGroup>
            </FormControl>
          </Box>
        );
      case 2:
        // Review & Confirm Step
        return (
          <Box>
            <Typography variant="h5" sx={{ mb: 3 }}>
              Review & Confirm
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please review the lease information and template policies before creating the agreement.
            </Typography>

            {renderInfoBanner()}

            {selectedTemplate && (
              <Card variant="outlined" sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Selected Template: {selectedTemplate.name}
                  </Typography>
                  {selectedTemplate.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {selectedTemplate.description}
                    </Typography>
                  )}
                  {selectedTemplate.policies && selectedTemplate.policies.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Policies ({selectedTemplate.policies.length}):
                      </Typography>
                      <List dense>
                        {selectedTemplate.policies
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((policy, index) => (
                            <ListItem key={policy.id || index}>
                              <ListItemText
                                primary={policy.title || `Policy ${index + 1}`}
                                secondary={policy.content}
                              />
                            </ListItem>
                          ))}
                      </List>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  const stepCompletion = [
    Boolean(selectedPropertyState && selectedUnitState),
    Boolean(selectedTemplate),
    Boolean(activeStep === 2 && selectedTemplate)
  ];
  const completedSteps = steps.filter((_, index) => stepCompletion[index] || index < activeStep).length;
  const progress = (completedSteps / steps.length) * 100;
  const activeStepConfig = steps[activeStep] ?? steps[0];
  const ActiveStepIcon = activeStepConfig.icon;

  return (
    <Card
      sx={{
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.22 : 0.16)}`,
        boxShadow: 'none',
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={0.75} sx={{ mb: 3 }}>
          <Typography variant="h3" fontWeight={800}>
            Lease Agreement Builder
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Build the lease agreement step-by-step before sending it for signature.
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {(activeStep > 0) && renderInfoBanner()}

        <Grid container spacing={2.5} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: 3 }}>
            <Card
              variant="outlined"
              sx={{
                position: { lg: 'sticky' },
                top: { lg: 88 },
                borderRadius: 2,
                borderColor: alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.24 : 0.16),
                overflow: 'hidden',
                bgcolor: 'background.paper',
                boxShadow: 'none'
              }}
            >
              <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.16)}` }}>
                <Typography variant="h6" fontWeight={800}>Set up your lease agreement</Typography>
                <Typography variant="caption" color="text.secondary">Complete each section before finalizing.</Typography>
                <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>Steps completed</Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>{Math.round(progress)}%</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 8,
                      borderRadius: 99,
                      bgcolor: alpha(theme.palette.success.main, 0.12),
                      '& .MuiLinearProgress-bar': { borderRadius: 99, backgroundColor: theme.palette.success.main }
                    }}
                  />
                </Stack>
              </Box>

              <Stack spacing={0}>
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const complete = stepCompletion[index] || index < activeStep;
                  const selected = activeStep === index;
                  return (
                    <Box
                      key={step.label}
                      component="button"
                      type="button"
                      onClick={() => setActiveStep(index)}
                      sx={{
                        width: '100%',
                        border: 0,
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                        bgcolor: selected ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.07) : 'background.paper',
                        color: 'text.primary',
                        textAlign: 'left',
                        p: 1.5,
                        cursor: 'pointer',
                        borderLeft: selected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                        transition: 'background-color 0.15s ease, border-color 0.15s ease',
                        '&:hover': {
                          bgcolor: selected ? alpha(theme.palette.primary.main, 0.16) : alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <Box sx={{ width: 24, pt: 0.15, display: 'flex', justifyContent: 'center', color: complete ? 'success.main' : 'primary.main' }}>
                          {complete ? (
                            <CheckCircleOutlined style={{ fontSize: 20 }} />
                          ) : (
                            <Box
                              sx={{
                                width: 18,
                                height: 18,
                                mt: 0.15,
                                borderRadius: 0.75,
                                bgcolor: alpha(theme.palette.primary.main, selected ? 0.22 : 0.14),
                                border: `1px solid ${alpha(theme.palette.primary.main, selected ? 0.82 : 0.48)}`,
                                boxShadow: selected ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}` : 'none'
                              }}
                            />
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Icon style={{ fontSize: 15, color: selected ? theme.palette.primary.main : theme.palette.text.secondary }} />
                            <Typography variant="body2" fontWeight={selected ? 800 : 700}>{step.label}</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>
                            {step.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 9 }}>
            <Card variant="outlined" sx={{ borderRadius: 2, borderColor: alpha(theme.palette.divider, 0.16), boxShadow: 'none', overflow: 'hidden' }}>
              <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}`, bgcolor: alpha(theme.palette.background.paper, 0.86) }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                  <Box>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <ActiveStepIcon style={{ fontSize: 18, color: theme.palette.primary.main }} />
                      <Typography variant="h5" fontWeight={800}>{activeStepConfig.label}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{activeStepConfig.description}</Typography>
                  </Box>
                  <Chip label={stepCompletion[activeStep] ? 'Complete' : 'Needs attention'} size="small" color={stepCompletion[activeStep] ? 'success' : 'warning'} variant="outlined" />
                </Stack>
              </Box>

              <Box sx={{ minHeight: '400px', p: { xs: 2, md: 2.5 } }}>
                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                    <CircularProgress />
                  </Box>
                ) : (
                  renderStepContent()
                )}
              </Box>

              <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
                <Stack direction="row" justifyContent="space-between">
                  <Button disabled={activeStep === 0 || loading} onClick={handleBack} variant="outlined">
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={activeStep === steps.length - 1 ? handleFinalize : handleNext}
                    disabled={
                      loading ||
                      (activeStep === 0 && (!selectedPropertyState || !selectedUnitState)) ||
                      (activeStep === 1 && !selectedTemplate && !isCreatingNewTemplate) ||
                      (activeStep === 2 && !selectedTemplate)
                    }
                  >
                    {activeStep === steps.length - 1 ? 'Create & Finalize' : 'Next'}
                  </Button>
                </Stack>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </CardContent>

      {/* View Template Policies Dialog */}
      <Dialog
        open={viewTemplateDialogOpen}
        onClose={() => setViewTemplateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {viewingTemplate?.name || 'Template Policies'}
        </DialogTitle>
        <DialogContent>
          {viewingTemplate?.policies && viewingTemplate.policies.length > 0 ? (
            <List>
              {viewingTemplate.policies
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((policy, index) => (
                  <ListItem key={policy.id || index}>
                    <ListItemText
                      primary={policy.title || `Policy ${index + 1}`}
                      secondary={policy.content}
                    />
                    {policy.category && (
                      <Chip label={policy.category} size="small" sx={{ ml: 2 }} />
                    )}
                  </ListItem>
                ))}
            </List>
          ) : (
            <Alert severity="info">This template has no policies.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewTemplateDialogOpen(false)}>Close</Button>
          {viewingTemplate && (
            <Button
              variant="contained"
              onClick={() => {
                setViewTemplateDialogOpen(false);
                handleEditTemplate(viewingTemplate);
              }}
            >
              Edit Template
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setTemplateToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Template"
        message={
          templateToDelete
            ? `Are you sure you want to delete "${templateToDelete.name}"? This action cannot be undone.`
            : 'Are you sure you want to delete this template?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />

      {/* Sign Lease Dialog */}
      <SignLeaseDialog
        open={signLeaseDialogOpen}
        onSignNow={handleSignNow}
        onSignLater={handleSignLater}
      />
    </Card>
  );
}

// Sign Lease Dialog Component
function SignLeaseDialog({ open, onSignNow, onSignLater }) {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onSignLater}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`
        }
      }}
    >
      <DialogContent sx={{ mt: 2, my: 1 }}>
        <Stack sx={{ gap: 3.5, alignItems: 'center' }}>
          <Avatar color="success" sx={{ width: 72, height: 72, fontSize: '1.75rem' }}>
            <CheckCircleOutlined style={{ fontSize: '2rem' }} />
          </Avatar>
          <Stack sx={{ gap: 2, textAlign: 'center' }}>
            <Typography variant="h4" align="center">
              Lease Agreement Created
            </Typography>
            <Typography align="center" color="text.secondary">
              Your lease agreement has been created successfully. Would you like to sign it now or do it later on the lease page?
            </Typography>
          </Stack>

          <Stack direction="row" sx={{ gap: 2, width: 1 }}>
            <Button 
              fullWidth 
              onClick={onSignLater} 
              color="inherit" 
              variant="outlined"
            >
              Sign Later
            </Button>
            <Button 
              fullWidth 
              color="primary" 
              variant="contained" 
              onClick={onSignNow}
              autoFocus
            >
              Sign Now
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

SignLeaseDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onSignNow: PropTypes.func.isRequired,
  onSignLater: PropTypes.func.isRequired
};

LeaseAgreementBuilder.propTypes = {
  onComplete: PropTypes.func
};
