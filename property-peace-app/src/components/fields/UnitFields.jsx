import { FieldArray } from 'formik';
import { Grid, Card, CardContent, CardHeader, IconButton, Button, Stack, Checkbox, FormControlLabel } from '@mui/material';
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
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={unit.isOccupied || false}
                            onChange={(e) => {
                              const newUnits = [...values.units];
                              newUnits[index] = { ...newUnits[index], isOccupied: e.target.checked };
                              setFieldValue('units', newUnits);
                            }}
                          />
                        }
                        label="Unit is currently occupied"
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

