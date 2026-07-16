import PropTypes from 'prop-types';
import { FieldArray } from 'formik';
import {
  Grid,
  Card,
  CardHeader,
  CardContent,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Avatar,
  Button,
  Chip,
  FormControlLabel,
  Radio
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import { Delete } from '@mui/icons-material';
import FormInput from 'components/input/FormInput';

const initials = (f, l) => `${(f?.[0] || '').toUpperCase()}${(l?.[0] || '').toUpperCase()}` || 'T';

export default function TenantsFieldArray({ values, touched, errors, setFieldValue, name = 'tenants' }) {
  return (
    <FieldArray
      name={name}
      render={({ push, remove }) => (
        <Stack spacing={2}>
          {values[name].map((t, idx) => {
            const tnTouched = touched?.[name]?.[idx] || {};
            const tnErrors = errors?.[name]?.[idx] || {};
            const isPrimary = values.primaryTenantIndex === idx;

            return (
              <Card key={idx} variant="outlined" sx={{ overflow: 'hidden' }}>
                <CardHeader
                  avatar={<Avatar>{initials(t.firstName, t.lastName)}</Avatar>}
                  title={t.firstName || t.lastName ? `${t.firstName || ''} ${t.lastName || ''}`.trim() : `Tenant ${idx + 1}`}
                  sx={{ pr: 4 }}
                  action={
                    <Tooltip title="Remove tenant">
                      <span>
                        <IconButton edge="end" color="error" onClick={() => remove(idx)} disabled={values[name].length === 1}>
                          <Delete />
                        </IconButton>
                      </span>
                    </Tooltip>
                  }
                />
                <Divider />
                <CardContent>
                  <Grid container spacing={3} alignItems="center">
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name={`${name}[${idx}].firstName`}
                        label="First Name"
                        placeholder="Enter First Name"
                        value={values[name][idx].firstName}
                        setFieldValue={setFieldValue}
                        touched={Boolean(tnTouched.firstName)}
                        errorText={tnErrors.firstName}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name={`${name}[${idx}].lastName`}
                        label="Last Name"
                        placeholder="Enter Last Name"
                        value={values[name][idx].lastName}
                        setFieldValue={setFieldValue}
                        touched={Boolean(tnTouched.lastName)}
                        errorText={tnErrors.lastName}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name={`${name}[${idx}].email`}
                        label="Email"
                        type="email"
                        placeholder="e.g. tenant@email.com"
                        value={values[name][idx].email}
                        setFieldValue={setFieldValue}
                        touched={Boolean(tnTouched.email)}
                        errorText={tnErrors.email}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name={`${name}[${idx}].phone`}
                        label="Phone"
                        placeholder="e.g. (555) 123-4567"
                        value={values[name][idx].phone}
                        setFieldValue={setFieldValue}
                        touched={Boolean(tnTouched.phone)}
                        errorText={tnErrors.phone}
                        valueType="phone"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            );
          })}

          <Button
            type="button"
            variant="outlined"
            startIcon={<Add />}
            onClick={() => push({ firstName: '', lastName: '', email: '', phone: '' })}
            sx={{ alignSelf: 'flex-start' }}
          >
            Add another tenant
          </Button>
        </Stack>
      )}
    />
  );
}
