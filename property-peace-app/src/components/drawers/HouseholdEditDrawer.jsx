import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

// material-ui
import { Box, Button, Drawer, Divider, Grid, IconButton, Stack, Toolbar, Typography, Card, CardContent, CardHeader } from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import DeleteFilled from '@ant-design/icons/DeleteFilled';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

// form
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider, FieldArray } from 'formik';

// app
import { useDrawer } from 'contexts/DrawerContext';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import FormInput from 'components/input/FormInput';
import { openSnackbar } from 'api/snackbar';

// hooks
import { useDispatch, useSelector } from 'react-redux';
import useAuth from 'hooks/useAuth';
import { useSWRConfig } from 'swr';
import { dashboardEndpoints } from 'api/dashbord';

// api
import { addOrUpdateTenant, deleteTenant } from 'store/tenant/tenant.action';

// selectors
import { selectTenants } from 'store/tenant/tenant.selector';

// ---------- validation ----------
const TenantSchema = Yup.object().shape({
  tenants: Yup.array().of(
    Yup.object().shape({
      id: Yup.number().nullable(),
      firstname: Yup.string().required('First name is required'),
      lastname: Yup.string().required('Last name is required'),
      email: Yup.string().email('Invalid email').nullable(),
      phoneNumber: Yup.string().nullable()
    })
  )
});

export default function HouseholdEditDrawer({ household, propertyId }) {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();

  const tenants = useSelector(selectTenants);

  const [loading, setLoading] = useState(true);
  const [removedTenantIds, setRemovedTenantIds] = useState([]);
  
  useEffect(() => setLoading(false), []);

  const filteredTenants = tenants?.filter((t) => t.propertyId === Number(propertyId));

  const formik = useFormik({
    initialValues: {
      tenants: filteredTenants
        ? filteredTenants.map((t) => ({
            id: t.id,
            householdId: household?.id,
            firstname: t.firstname || '',
            lastname: t.lastname || '',
            email: t.email || '',
            phoneNumber: t.phoneNumber || '',
            PropertyId: Number(propertyId),
            leaseId: t.leaseId,
            unitId: t.unitId
          }))
        : [{ firstname: '', lastname: '', email: '', phoneNumber: '' }]
    },
    validationSchema: TenantSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        // First, remove tenants marked for removal
        for (const tenantId of removedTenantIds) {
          console.log('Removing tenant:', tenantId);
          await dispatch(deleteTenant(tenantId));
        }

        // Then, update/add remaining tenants
        for (const t of values.tenants) {
          const payload = {
            id: t.id || null,
            householdId: household?.id,
            Firstname: t.firstname,
            Lastname: t.lastname,
            Email: t.email || null,
            PhoneNumber: t.phoneNumber || null,
            PropertyId: Number(propertyId),
            leaseId: t.leaseId,
            unitId: t.unitId
          };

          console.log('Updating tenant:', payload);
          await dispatch(addOrUpdateTenant(payload));
        }

        await mutate(dashboardEndpoints.summary(user.id));

        const removedCount = removedTenantIds.length;
        const updatedCount = values.tenants.length;
        
        openSnackbar({
          open: true,
          message: removedCount > 0 
            ? `${updatedCount} tenant(s) updated, ${removedCount} removed successfully.`
            : `${updatedCount} tenant(s) updated successfully.`,
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Clear removed tenant IDs after successful save
        setRemovedTenantIds([]);
        drawer.closeHouseholdEditDrawer();
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to update tenant(s).',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue } = formik;

  // Handle tenant removal
  const handleRemoveTenant = (index, tenantId) => {
    // If tenant has an ID (existing tenant), add to removal list
    if (tenantId) {
      setRemovedTenantIds((prev) => [...prev, tenantId]);
    }
    // Remove from form array
    const newTenants = values.tenants.filter((_, i) => i !== index);
    setFieldValue('tenants', newTenants);
  };

  // Handle cancel - clear removed tenant IDs
  const handleCancel = () => {
    setRemovedTenantIds([]);
    drawer.closeHouseholdEditDrawer();
  };

  if (loading) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <CircularWithPath />
        </Stack>
      </Box>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={drawer.isOpenHouseholdEdit}
      onClose={drawer.closeHouseholdEditDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520, md: 560 },
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <FormikProvider value={formik}>
        <Form noValidate autoComplete="off" onSubmit={handleSubmit} style={{ display: 'contents' }}>
          {/* Header */}
          <Toolbar sx={{ px: 2.5 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Edit Tenants
            </Typography>
            <IconButton onClick={handleCancel} size="large">
              <CloseOutlined />
            </IconButton>
          </Toolbar>
          <Divider />

          {/* Content */}
          <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
            <Grid container spacing={3}>
              <FieldArray
                name="tenants"
                render={(arrayHelpers) => (
                  <Grid size={{ xs: 12 }}>
                    <Stack spacing={2}>
                      {values.tenants.map((tenant, index) => (
                        <Card key={tenant.id || index} variant="outlined">
                          <CardHeader
                            title={`Tenant ${index + 1}`}
                            action={
                              values.tenants.length > 1 && (
                                <IconButton color="error" onClick={() => handleRemoveTenant(index, tenant.id)}>
                                  <DeleteFilled />
                                </IconButton>
                              )
                            }
                          />
                          <CardContent>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormInput
                                  size="small"
                                  name={`tenants[${index}].firstname`}
                                  label="First Name"
                                  value={tenant.firstname}
                                  setFieldValue={setFieldValue}
                                  touched={touched.tenants?.[index]?.firstname}
                                  errorText={errors.tenants?.[index]?.firstname}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormInput
                                  size="small"
                                  name={`tenants[${index}].lastname`}
                                  label="Last Name"
                                  value={tenant.lastname}
                                  setFieldValue={setFieldValue}
                                  touched={touched.tenants?.[index]?.lastname}
                                  errorText={errors.tenants?.[index]?.lastname}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormInput
                                  size="small"
                                  name={`tenants[${index}].email`}
                                  label="Email (optional)"
                                  value={tenant.email}
                                  setFieldValue={setFieldValue}
                                  touched={touched.tenants?.[index]?.email}
                                  errorText={errors.tenants?.[index]?.email}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormInput
                                  size="small"
                                  name={`tenants[${index}].phoneNumber`}
                                  label="Phone (optional)"
                                  value={tenant.phoneNumber}
                                  setFieldValue={setFieldValue}
                                  touched={touched.tenants?.[index]?.phoneNumber}
                                  errorText={errors.tenants?.[index]?.phoneNumber}
                                  valueType="phone"
                                />
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      ))}
                      <Button
                        startIcon={<PlusOutlined />}
                        variant="outlined"
                        onClick={() =>
                          arrayHelpers.push({
                            firstname: '',
                            lastname: '',
                            email: '',
                            phoneNumber: ''
                          })
                        }
                      >
                        Add Another Tenant
                      </Button>
                    </Stack>
                  </Grid>
                )}
              />
            </Grid>
          </Box>

          <Divider />

          {/* Footer */}
          <Stack direction="row" sx={{ p: 2.5, gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" color="inherit" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </Form>
      </FormikProvider>
    </Drawer>
  );
}

HouseholdEditDrawer.propTypes = {
  household: PropTypes.object
};
