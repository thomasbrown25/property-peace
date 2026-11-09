import { FieldArray } from 'formik';
import { Grid, Card, CardContent, CardHeader, IconButton, Button, Stack, Typography } from '@mui/material';
import DeleteFilled from '@ant-design/icons/DeleteFilled';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import FormInput from 'components/input/FormInput';

export default function UnitFields({ values, errors, touched, setFieldValue }) {
  return (
    <FieldArray
      name="units"
      render={(arrayHelpers) => (
        <Grid size={12}>
          <Stack spacing={2}>
            {values.units.map((unit, index) => (
              <Card key={index} variant="outlined">
                <CardHeader
                  title={`Unit ${index + 1}`}
                  action={
                    values.units.length > 1 && (
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
                        name={`units[${index}].name`}
                        label="Unit Name *"
                        placeholder="Ex. Unit 1, Apartment A, etc."
                        value={unit.name}
                        setFieldValue={setFieldValue}
                        touched={touched.units?.[index]?.name}
                        errorText={errors.units?.[index]?.name}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name={`units[${index}].bedrooms`}
                        label="Bedrooms"
                        placeholder="Ex. 2"
                        value={unit.bedrooms}
                        setFieldValue={setFieldValue}
                        touched={touched.units?.[index]?.bedrooms}
                        errorText={errors.units?.[index]?.bedrooms}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name={`units[${index}].baths`}
                        label="Baths"
                        placeholder="Ex. 1.5"
                        value={unit.baths}
                        setFieldValue={setFieldValue}
                        touched={touched.units?.[index]?.baths}
                        errorText={errors.units?.[index]?.baths}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormInput
                        name={`units[${index}].squareFeet`}
                        label="Square Feet (optional)"
                        placeholder="Ex. 1200"
                        type="number"
                        value={unit.squareFeet}
                        setFieldValue={setFieldValue}
                        touched={touched.units?.[index]?.squareFeet}
                        errorText={errors.units?.[index]?.squareFeet}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="body2" color="text.secondary">
                        Occupancy is determined automatically by the unit’s active lease.
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}
            <Button
              startIcon={<PlusOutlined />}
              size="small"
              variant="outlined"
              onClick={() => arrayHelpers.push({ name: '', bedrooms: '', baths: '', squareFeet: '', isOccupied: false })}
            >
              Add Another Unit
            </Button>
          </Stack>
        </Grid>
      )}
    />
  );
}

