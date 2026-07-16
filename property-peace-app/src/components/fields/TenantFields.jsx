import { FieldArray } from 'formik';
import { Grid, Card, CardContent, CardHeader, IconButton, Button, Stack } from '@mui/material';
import DeleteFilled from '@ant-design/icons/DeleteFilled';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import FormInput from 'components/input/FormInput';

export default function TenantFields({ values, errors, touched, setFieldValue }) {
  return (
    <FieldArray
      name="tenants"
      render={(arrayHelpers) => (
        <Grid size={12}>
          <Stack spacing={2}>
            {values.tenants.map((tenant, index) => (
              <Card key={index} variant="outlined">
                <CardHeader
                  title={`Tenant ${index + 1}`}
                  action={
                    values.tenants.length > 1 && (
                      <IconButton color="error" onClick={() => arrayHelpers.remove(index)}>
                        <DeleteFilled />
                      </IconButton>
                    )
                  }
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
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
              size="small"
              variant="outlined"
              onClick={() => arrayHelpers.push({ firstname: '', lastname: '', email: '', phoneNumber: '' })}
            >
              Add Another Tenant
            </Button>
          </Stack>
        </Grid>
      )}
    />
  );
}
