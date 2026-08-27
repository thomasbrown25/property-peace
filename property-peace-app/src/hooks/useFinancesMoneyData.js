import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadMoneyCenterExport, moneyCenterAPI, moneyCenterErrorMessage } from 'api/moneyCenter';
import { normalizeMoneyCenterItemsResponse, normalizeMoneyCenterOverview } from 'utils/moneyCenter';
import { buildFinancesMoneyQuery, deriveFinancesMoneyItems } from 'utils/finances';

export default function useFinancesMoneyData(searchParams, mutationVersion) {
  const [overview, setOverview] = useState(null);
  const [itemsResponse, setItemsResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [itemsError, setItemsError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const requestIdRef = useRef(0);
  const params = useMemo(() => buildFinancesMoneyQuery(searchParams), [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestIdRef.current += 1;
    setLoading(true);
    setOverviewError('');
    setItemsError('');

    Promise.allSettled([
      moneyCenterAPI.overview(params, controller.signal),
      moneyCenterAPI.items(params, controller.signal)
    ]).then(([overviewResult, itemsResult]) => {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;

      if (overviewResult.status === 'fulfilled') {
        setOverview(normalizeMoneyCenterOverview(overviewResult.value));
      } else {
        setOverview(null);
        setOverviewError(moneyCenterErrorMessage(overviewResult.reason));
      }

      if (itemsResult.status === 'fulfilled') {
        setItemsResponse(normalizeMoneyCenterItemsResponse(itemsResult.value));
      } else {
        setItemsResponse(null);
        setItemsError(moneyCenterErrorMessage(itemsResult.reason));
      }

      setLoading(false);
    });

    return () => controller.abort();
  }, [params.from, params.to, params.propertyId, params.unitId, params.upcomingDays, mutationVersion, retryVersion]);

  const { activityEntries, reviewItems, accountActivity, clientDerivationsAvailable } = useMemo(
    () => deriveFinancesMoneyItems(itemsResponse),
    [itemsResponse]);
  const retry = useCallback(() => setRetryVersion((version) => version + 1), []);
  const exportActivity = useCallback(async () => {
    setExportError('');
    setExporting(true);
    try {
      downloadMoneyCenterExport(await moneyCenterAPI.export(params));
    } catch (error) {
      setExportError(moneyCenterErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }, [params]);

  return {
    overview,
    itemsResponse,
    activityEntries,
    reviewItems,
    accountActivity,
    clientDerivationsAvailable,
    loading,
    overviewError,
    itemsError,
    exporting,
    exportError,
    retry,
    exportActivity
  };
}
