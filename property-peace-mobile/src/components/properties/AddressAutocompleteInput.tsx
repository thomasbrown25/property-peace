import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import googlePlacesAPI from '../../api/googlePlacesAPI';
import {
  addressAutocompleteReducer,
  createLatestRequestGate,
  GooglePlaceDetails,
  GooglePlaceSuggestion,
  initialAddressAutocompleteState,
  nextAddressSessionToken,
  shouldFetchAddressSuggestions,
} from '../../features/properties/addressAutocomplete';

type AddressAutocompleteInputProps = {
  value: string;
  onChangeText(value: string): void;
  onPlaceSelected(details: GooglePlaceDetails): void;
  disabled?: boolean;
};

const manualFallbackMessage =
  'Address suggestions are unavailable. Continue entering it manually.';

const isCancellation = (error: unknown, controller: AbortController) =>
  controller.signal.aborted ||
  (typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_CANCELED');

export default function AddressAutocompleteInput({
  value,
  onChangeText,
  onPlaceSelected,
  disabled = false,
}: AddressAutocompleteInputProps) {
  const [state, dispatch] = useReducer(
    addressAutocompleteReducer,
    initialAddressAutocompleteState,
  );
  const [resolving, setResolving] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);
  const previousValueRef = useRef(value);
  const latestValueRef = useRef(value);
  const mountedRef = useRef(true);
  const disabledRef = useRef(disabled);
  const requestGateRef = useRef(createLatestRequestGate());
  const detailsGateRef = useRef(createLatestRequestGate());
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const detailsAbortRef = useRef<AbortController | null>(null);
  disabledRef.current = disabled;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      autocompleteAbortRef.current?.abort();
      detailsAbortRef.current?.abort();
      requestGateRef.current.invalidate();
      detailsGateRef.current.invalidate();
    };
  }, []);

  useEffect(() => {
    if (!disabled) return;

    autocompleteAbortRef.current?.abort();
    detailsAbortRef.current?.abort();
    requestGateRef.current.invalidate();
    detailsGateRef.current.invalidate();
    setResolving(false);
    dispatch({ type: 'closed' });
  }, [disabled]);

  useEffect(() => {
    latestValueRef.current = value;

    if (
      disabled ||
      !shouldFetchAddressSuggestions(value) ||
      !sessionTokenRef.current
    ) {
      autocompleteAbortRef.current?.abort();
      requestGateRef.current.invalidate();
      dispatch({ type: 'closed' });
      return;
    }

    const controller = new AbortController();
    const requestId = requestGateRef.current.begin();
    const sessionToken = sessionTokenRef.current;
    autocompleteAbortRef.current = controller;
    dispatch({ type: 'requestStarted' });

    const timeout = setTimeout(() => {
      googlePlacesAPI
        .autocomplete(value, sessionToken, controller.signal)
        .then((suggestions) => {
          if (
            mountedRef.current &&
            requestGateRef.current.isCurrent(requestId) &&
            !controller.signal.aborted &&
            !disabledRef.current
          ) {
            dispatch({ type: 'requestSucceeded', suggestions });
          }
        })
        .catch((error: unknown) => {
          if (
            mountedRef.current &&
            requestGateRef.current.isCurrent(requestId) &&
            !isCancellation(error, controller) &&
            !disabledRef.current
          ) {
            dispatch({ type: 'requestFailed', message: manualFallbackMessage });
          }
        });
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
      if (requestGateRef.current.isCurrent(requestId)) {
        requestGateRef.current.invalidate();
      }
      if (autocompleteAbortRef.current === controller) {
        autocompleteAbortRef.current = null;
      }
    };
  }, [disabled, value]);

  const handleChange = (next: string) => {
    if (disabledRef.current) return;

    sessionTokenRef.current = nextAddressSessionToken(
      previousValueRef.current,
      next,
      sessionTokenRef.current,
      () => Crypto.randomUUID(),
    );
    previousValueRef.current = next;
    latestValueRef.current = next;
    autocompleteAbortRef.current?.abort();
    detailsAbortRef.current?.abort();
    requestGateRef.current.invalidate();
    detailsGateRef.current.invalidate();
    setResolving(false);
    dispatch({ type: 'inputChanged', value: next });
    onChangeText(next);
  };

  const selectSuggestion = async (suggestion: GooglePlaceSuggestion) => {
    const token = sessionTokenRef.current;
    if (!token || disabledRef.current) return;

    const selectedValue = latestValueRef.current;
    autocompleteAbortRef.current?.abort();
    requestGateRef.current.invalidate();
    detailsAbortRef.current?.abort();
    const controller = new AbortController();
    const requestId = detailsGateRef.current.begin();
    detailsAbortRef.current = controller;
    setResolving(true);

    try {
      const details = await googlePlacesAPI.details(
        suggestion.placeId,
        token,
        controller.signal,
      );
      const stillSelected =
        mountedRef.current &&
        detailsGateRef.current.isCurrent(requestId) &&
        !controller.signal.aborted &&
        !disabledRef.current &&
        latestValueRef.current === selectedValue &&
        sessionTokenRef.current === token;
      if (!stillSelected) return;

      onPlaceSelected(details);
      dispatch({ type: 'closed' });
      sessionTokenRef.current = null;
    } catch (error) {
      if (
        mountedRef.current &&
        detailsGateRef.current.isCurrent(requestId) &&
        !isCancellation(error, controller) &&
        !disabledRef.current
      ) {
        dispatch({ type: 'requestFailed', message: manualFallbackMessage });
      }
    } finally {
      if (
        mountedRef.current &&
        detailsGateRef.current.isCurrent(requestId) &&
        !disabledRef.current
      ) {
        setResolving(false);
      }
      if (detailsAbortRef.current === controller) {
        detailsAbortRef.current = null;
      }
    }
  };

  const showSuggestions = !disabled && (state.open || resolving);

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Street address"
          value={value}
          onChangeText={handleChange}
          editable={!disabled}
          accessibilityLabel="Street address"
        />
        {!disabled && (state.loading || resolving) && (
          <ActivityIndicator style={styles.loader} size="small" color="#1976d2" />
        )}
      </View>
      {showSuggestions && (
        <View style={styles.suggestionContainer}>
          {state.suggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.placeId}
              style={styles.suggestionRow}
              onPress={() => selectSuggestion(suggestion)}
              disabled={disabled || resolving}
              accessibilityRole="button"
              accessibilityLabel={`Select address ${suggestion.text}`}
            >
              <Ionicons name="location-outline" size={20} color="#555" />
              <Text style={styles.suggestionText}>{suggestion.text}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.attribution} numberOfLines={1}>Google Maps</Text>
        </View>
      )}
      {!!state.error && <Text style={styles.error}>{state.error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  inputContainer: { position: 'relative' },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  loader: { position: 'absolute', right: 12, top: 12 },
  suggestionContainer: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: { color: '#222', flex: 1, fontSize: 16 },
  attribution: {
    borderTopColor: '#eee',
    borderTopWidth: 1,
    color: '#5E5E5E',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  error: { color: '#a33', fontSize: 13, marginTop: 6 },
});
