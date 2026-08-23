import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { UNSTABLE_usePreventRemove as usePreventRemove, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropertyAPI, { type Property, type Unit } from '../../api/propertyAPI';
import expenseAPI from '../../api/expenseAPIRuntime';
import { useAppSelector } from '../../store/hooks';
import {
  buildCreateExpensePayload,
  emptyExpenseForm,
  getTaxCategoryPresentation,
  setExpenseProperty,
  validateExpenseStep,
  type ExpenseStep,
  type LocalExpenseReceipt,
} from '../../features/expenses/expenseModel';
import { toLocalExpenseReceipt } from '../../features/expenses/expenseReceiptModel';
import {
  getExpenseErrorMessage,
  retryExpenseReceipt,
  submitExpense,
  type ExpenseSubmissionResult,
} from '../../features/expenses/expenseSubmission';

const stepDetails: Record<ExpenseStep, { number: number; title: string; subtitle: string }> = {
  details: { number: 1, title: 'Expense details', subtitle: 'Where and when was it paid?' },
  description: { number: 2, title: 'Describe and attach', subtitle: 'Add a note and an optional receipt.' },
  review: { number: 3, title: 'Review expense', subtitle: 'Confirm the details before saving.' },
};

const propertyId = (property: Property) => {
  const value = Number(property.id ?? property.Id);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const unitId = (unit: Unit) => {
  const value = Number(unit.id ?? unit.Id);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const label = (item: Record<string, unknown>, fallback: string) => {
  for (const value of [item.name, item.Name, item.address, item.Address, item.streetAddress, item.StreetAddress]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
};

const propertyUnits = (property: Property | undefined): Unit[] => {
  const units = property?.units ?? property?.Units;
  return Array.isArray(units) ? units as Unit[] : [];
};

const displayDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsMultipleSelection: false,
  quality: 0.8,
};

export default function AddExpenseScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const [step, setStep] = useState<ExpenseStep>('details');
  const [form, setForm] = useState(() => emptyExpenseForm());
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyLoading, setPropertyLoading] = useState(true);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<LocalExpenseReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExpenseSubmissionResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadProperties = useCallback(async () => {
    setPropertyLoading(true);
    setPropertyError(null);
    try {
      setProperties((await PropertyAPI.getProperties()) ?? []);
    } catch (error) {
      setPropertyError(getExpenseErrorMessage(error, 'Properties could not be loaded.'));
    } finally {
      setPropertyLoading(false);
    }
  }, []);

  useEffect(() => { void loadProperties(); }, [loadProperties]);

  usePreventRemove(submitting, () => {
    Alert.alert('Please wait', 'Your expense is still being saved.');
  });

  const selectedProperty = useMemo(
    () => properties.find((property) => propertyId(property) === form.propertyId),
    [properties, form.propertyId],
  );
  const units = useMemo(() => propertyUnits(selectedProperty), [selectedProperty]);
  const selectedUnit = useMemo(
    () => units.find((unit) => unitId(unit) === form.unitId),
    [units, form.unitId],
  );

  const moveForward = () => {
    const validation = validateExpenseStep(form, step);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setStep(step === 'details' ? 'description' : 'review');
  };

  const chooseReceipt = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access in your device settings to attach a receipt. You can still save this expense without one.');
      return;
    }

    const response = source === 'camera'
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (response.canceled || !response.assets?.[0]) return;
    try {
      setReceipt(toLocalExpenseReceipt(response.assets[0]));
    } catch (error) {
      Alert.alert('Receipt not added', getExpenseErrorMessage(error, 'Use a JPEG, PNG, or WebP image.'));
    }
  };

  const save = async () => {
    if (submitting) return;
    const landlordId = Number(currentUser?.id ?? currentUser?.Id);
    const validation = validateExpenseStep(form, 'review');
    setErrors(validation);
    setSaveError(null);
    if (!Number.isInteger(landlordId) || landlordId <= 0) {
      setSaveError('Your landlord account could not be identified.');
      return;
    }
    if (Object.keys(validation).length > 0) {
      setSaveError(Object.values(validation)[0]);
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildCreateExpensePayload(form, landlordId, new Date().toISOString());
      setResult(await submitExpense(payload, receipt, expenseAPI));
    } catch (error) {
      setSaveError(getExpenseErrorMessage(error, 'Expense could not be saved.'));
    } finally {
      setSubmitting(false);
    }
  };

  const retryReceipt = async () => {
    if (!result || result.status !== 'receipt-failed' || submitting) return;
    setSaveError(null);
    setSubmitting(true);
    try {
      await retryExpenseReceipt(result.expense.id, result.receipt, expenseAPI);
      setResult({ status: 'saved', expense: result.expense });
    } catch (error) {
      setSaveError(getExpenseErrorMessage(error, 'Receipt could not be uploaded.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const category = getTaxCategoryPresentation(result.expense.taxCategory);
    const receiptFailed = result.status === 'receipt-failed';
    return (
      <View style={styles.successPage}>
        <View style={styles.successMark}><Ionicons name={receiptFailed ? 'cloud-offline-outline' : 'checkmark'} size={34} color="#fff" /></View>
        <Text style={styles.successTitle}>{receiptFailed ? 'Expense saved' : 'Expense saved'}</Text>
        <Text style={styles.successCopy}>{receiptFailed ? 'Expense saved; receipt not uploaded' : 'Your paid property expense is recorded.'}</Text>
        <View style={styles.resultSlip}>
          <Text style={styles.resultName}>{result.expense.name}</Text>
          <Text style={styles.resultAmount}>${result.expense.amount.toFixed(2)}</Text>
          <View style={styles.categoryRow}><Ionicons name={category.status === 'categorized' ? 'sparkles-outline' : 'alert-circle-outline'} size={18} color={category.status === 'categorized' ? '#2f8f46' : '#8a5a17'} /><Text style={styles.categoryText}>{category.label}</Text></View>
        </View>
        {saveError && <Text style={styles.inlineError}>{saveError}</Text>}
        {receiptFailed && <ActionButton label="Retry receipt" onPress={() => void retryReceipt()} loading={submitting} secondary />}
        <ActionButton label="Done" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const meta = stepDetails[step];
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 28 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{meta.number} of 3</Text>
          <View style={styles.rail}><View style={[styles.railFill, { width: `${meta.number / 3 * 100}%` }]} /></View>
        </View>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.subtitle}>{meta.subtitle}</Text>

        {step === 'details' && <>
          <Field label="Amount" error={errors.amount}><TextInput testID="expense-amount" accessibilityLabel="Expense amount" value={form.amount} onChangeText={(amount) => setForm((current) => ({ ...current, amount }))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8a98a6" style={styles.input} /></Field>
          <Field label="Expense date" error={errors.expenseDate}>
            <TouchableOpacity accessibilityLabel="Choose expense date" style={styles.selector} onPress={() => setShowDatePicker(true)}><Text style={styles.selectorText}>{displayDate(form.expenseDate)}</Text><Ionicons name="calendar-outline" size={20} color="#2475cf" /></TouchableOpacity>
            {showDatePicker && <DateTimePicker value={new Date(`${form.expenseDate}T12:00:00`)} mode="date" onChange={(_, date) => { if (Platform.OS === 'android') setShowDatePicker(false); if (date) setForm((current) => ({ ...current, expenseDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` })); }} />}
          </Field>
          <Field label="Property" error={errors.propertyId}>
            {propertyLoading ? <View style={styles.loadingRow}><ActivityIndicator color="#2475cf" /><Text style={styles.muted}>Loading properties…</Text></View> : propertyError ? <View style={styles.notice}><Text style={styles.inlineError}>{propertyError}</Text><TouchableOpacity accessibilityLabel="Retry loading properties" onPress={() => void loadProperties()} style={styles.textButton}><Text style={styles.textButtonLabel}>Retry</Text></TouchableOpacity></View> : properties.length === 0 ? <View style={styles.notice}><Text style={styles.muted}>An expense must belong to a property.</Text><TouchableOpacity accessibilityLabel="Add property" onPress={() => navigation.navigate('Properties', { screen: 'AddProperty' })} style={styles.textButton}><Text style={styles.textButtonLabel}>Add property</Text></TouchableOpacity></View> : <View style={styles.choiceList}>{properties.map((property, index) => { const id = propertyId(property); if (!id) return null; const selected = id === form.propertyId; return <Choice key={String(id)} label={label(property, `Property ${index + 1}`)} selected={selected} onPress={() => setForm((current) => setExpenseProperty(current, id))} />; })}</View>}
          </Field>
          {units.length > 0 && <Field label="Unit (optional)"><View style={styles.choiceList}>{units.map((unit, index) => { const id = unitId(unit); if (!id) return null; return <Choice key={String(id)} label={label(unit, `Unit ${index + 1}`)} selected={id === form.unitId} onPress={() => setForm((current) => ({ ...current, unitId: id }))} />; })}</View></Field>}
          <ActionButton label="Continue" onPress={moveForward} disabled={propertyLoading || Boolean(propertyError) || properties.length === 0} />
        </>}

        {step === 'description' && <>
          <Field label="Description" error={errors.description}><TextInput testID="expense-description" accessibilityLabel="Expense description" value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} multiline maxLength={200} placeholder="e.g., Repaired the kitchen sink" placeholderTextColor="#8a98a6" style={[styles.input, styles.descriptionInput]} textAlignVertical="top" /><Text style={styles.counter}>{form.description.length}/200</Text></Field>
          <Field label="Receipt (optional)"><Text style={styles.help}>JPEG, PNG, or WebP up to 10 MB.</Text>{receipt ? <ReceiptPreview receipt={receipt} onRemove={() => !submitting && setReceipt(null)} disabled={submitting} /> : <View style={styles.receiptActions}><ActionButton label="Take photo" onPress={() => void chooseReceipt('camera')} secondary compact /><ActionButton label="Choose photo" onPress={() => void chooseReceipt('library')} secondary compact /></View>}</Field>
          <View style={styles.actionRow}><ActionButton label="Back" onPress={() => setStep('details')} secondary /><ActionButton label="Continue" onPress={moveForward} /></View>
        </>}

        {step === 'review' && <>
          <View style={styles.reviewSlip}>
            <ReviewRow label="Amount" value={`$${form.amount || '0.00'}`} />
            <ReviewRow label="Date" value={displayDate(form.expenseDate)} />
            <ReviewRow label="Property" value={selectedProperty ? label(selectedProperty, 'Property') : 'Not selected'} />
            {selectedUnit && <ReviewRow label="Unit" value={label(selectedUnit, 'Unit')} />}
            <ReviewRow label="Description" value={form.description.trim() || 'Not provided'} />
            {receipt && <ReceiptPreview receipt={receipt} onRemove={() => !submitting && setReceipt(null)} disabled={submitting} />}
          </View>
          <View style={styles.autoNote}><Ionicons name="sparkles-outline" size={19} color="#2f8f46" /><Text style={styles.autoNoteText}>Your expense will be categorized automatically after it is saved.</Text></View>
          {saveError && <Text style={styles.inlineError}>{saveError}</Text>}
          <View style={styles.actionRow}><ActionButton label="Back" onPress={() => setStep('description')} secondary disabled={submitting} /><ActionButton label="Save expense" onPress={() => void save()} loading={submitting} /></View>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label: fieldLabel, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{fieldLabel}</Text>{children}{error && <Text style={styles.fieldError}>{error}</Text>}</View>;
}

function Choice({ label: choiceLabel, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={choiceLabel} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View><Text style={styles.choiceText}>{choiceLabel}</Text></TouchableOpacity>;
}

function ReceiptPreview({ receipt, onRemove, disabled }: { receipt: LocalExpenseReceipt; onRemove: () => void; disabled: boolean }) {
  return <View style={styles.receiptPreview}><Image source={{ uri: receipt.uri }} style={styles.receiptImage} accessibilityLabel="Selected receipt preview" /><View style={styles.receiptCopy}><Text style={styles.receiptName} numberOfLines={1}>{receipt.fileName}</Text><Text style={styles.help}>{receipt.mimeType.replace('image/', '').toUpperCase()}</Text><TouchableOpacity accessibilityLabel="Remove receipt" onPress={onRemove} disabled={disabled} style={styles.removeButton}><Text style={styles.removeText}>Remove receipt</Text></TouchableOpacity></View></View>;
}

function ReviewRow({ label: rowLabel, value }: { label: string; value: string }) {
  return <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{rowLabel}</Text><Text style={styles.reviewValue}>{value}</Text></View>;
}

function ActionButton({ label: buttonLabel, onPress, secondary, compact, disabled, loading }: { label: string; onPress: () => void; secondary?: boolean; compact?: boolean; disabled?: boolean; loading?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={buttonLabel} onPress={onPress} disabled={disabled || loading} activeOpacity={0.84} style={[styles.button, secondary ? styles.buttonSecondary : styles.buttonPrimary, compact && styles.buttonCompact, (disabled || loading) && styles.buttonDisabled]}>{loading ? <ActivityIndicator color={secondary ? '#2475cf' : '#fff'} /> : <Text style={[styles.buttonText, secondary ? styles.buttonTextSecondary : styles.buttonTextPrimary]}>{buttonLabel}</Text>}</TouchableOpacity>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fbf7f4' }, content: { paddingHorizontal: 20, paddingTop: 22 },
  progressHeader: { gap: 8, marginBottom: 23 }, progressLabel: { color: '#2f8f46', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' }, rail: { height: 5, backgroundColor: '#e1e8e8', borderRadius: 3, overflow: 'hidden' }, railFill: { height: '100%', backgroundColor: '#2475cf', borderRadius: 3 },
  title: { color: '#082941', fontSize: 30, lineHeight: 37, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { color: '#596b79', fontSize: 16, lineHeight: 23, marginTop: 6, marginBottom: 26 },
  field: { marginBottom: 22 }, fieldLabel: { color: '#0b3558', fontSize: 15, fontWeight: '900', marginBottom: 8 }, input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#dce3e5', backgroundColor: '#fff', color: '#102d43', fontSize: 17, paddingHorizontal: 14 }, descriptionInput: { minHeight: 112, paddingTop: 13 }, counter: { color: '#71808b', fontSize: 12, textAlign: 'right', marginTop: 5 }, fieldError: { color: '#b23d3d', fontSize: 13, lineHeight: 18, marginTop: 6 },
  selector: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#dce3e5', backgroundColor: '#fff', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectorText: { color: '#102d43', fontSize: 16, fontWeight: '700' }, loadingRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10 }, muted: { color: '#607080', fontSize: 14, lineHeight: 20 }, notice: { backgroundColor: '#fff', borderColor: '#e3e9ed', borderWidth: 1, borderRadius: 13, padding: 14, gap: 8 }, textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, textButtonLabel: { color: '#2475cf', fontSize: 15, fontWeight: '900' },
  choiceList: { gap: 8 }, choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderWidth: 1, borderColor: '#dce3e5', backgroundColor: '#fff', borderRadius: 13 }, choiceSelected: { borderColor: '#2475cf', backgroundColor: '#eef6ff' }, choiceText: { flex: 1, color: '#102d43', fontSize: 15, fontWeight: '700' }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#94a4af', alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: '#2475cf' }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2475cf' },
  help: { color: '#697987', fontSize: 13, lineHeight: 18, marginBottom: 10 }, receiptActions: { flexDirection: 'row', gap: 10 }, receiptPreview: { minHeight: 104, flexDirection: 'row', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#dce3e5', backgroundColor: '#fff' }, receiptImage: { width: 82, height: 82, borderRadius: 9, backgroundColor: '#e9eef0' }, receiptCopy: { flex: 1, justifyContent: 'center', minWidth: 0 }, receiptName: { color: '#102d43', fontWeight: '900', fontSize: 14 }, removeButton: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' }, removeText: { color: '#b23d3d', fontSize: 13, fontWeight: '900' },
  reviewSlip: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#e3e9ed', paddingHorizontal: 15, marginBottom: 16 }, reviewRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#edf0f1', gap: 3 }, reviewLabel: { color: '#70808c', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }, reviewValue: { color: '#102d43', fontSize: 16, lineHeight: 22, fontWeight: '800' }, autoNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#edf9ef', borderRadius: 13, padding: 13, marginBottom: 16 }, autoNoteText: { flex: 1, color: '#245e35', fontSize: 13, lineHeight: 19 }, inlineError: { color: '#b23d3d', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 }, button: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17, flex: 1 }, buttonPrimary: { backgroundColor: '#2475cf' }, buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cfd9de' }, buttonCompact: { minWidth: 0 }, buttonDisabled: { opacity: 0.52 }, buttonText: { fontSize: 16, fontWeight: '900' }, buttonTextPrimary: { color: '#fff' }, buttonTextSecondary: { color: '#0b3558' },
  successPage: { flex: 1, backgroundColor: '#fbf7f4', paddingHorizontal: 24, justifyContent: 'center' }, successMark: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2f8f46', marginBottom: 18 }, successTitle: { color: '#082941', fontSize: 30, fontWeight: '900', letterSpacing: -0.8 }, successCopy: { color: '#596b79', fontSize: 16, lineHeight: 23, marginTop: 6, marginBottom: 22 }, resultSlip: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#e3e9ed', padding: 17, marginBottom: 18 }, resultName: { color: '#102d43', fontSize: 17, fontWeight: '900' }, resultAmount: { color: '#0b3558', fontSize: 28, fontWeight: '900', marginTop: 6 }, categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 }, categoryText: { color: '#30505f', fontSize: 14, fontWeight: '800' },
});
