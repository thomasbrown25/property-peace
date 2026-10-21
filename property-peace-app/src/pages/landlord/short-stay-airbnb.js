// Feed URLs are credentials. Never display request/response error messages for these endpoints.
export function createAirbnbCalendar({ api, unitId, update }) {
  let active = true;
  let generation = 0;
  const valid = (token) => active && token === generation;
  const run = async (request, notice) => {
    if (!active) return false;
    const token = ++generation;
    update({ busy: true, error: '', notice: '' });
    try {
      const status = await request();
      if (!valid(token)) return false;
      if (!status || String(status.unitId) !== String(unitId)) throw new Error('Unexpected unit');
      update({ status, notice: notice || '' });
      return true;
    } catch {
      if (valid(token)) update({ error: 'Unable to update Airbnb calendar. Check the export URL or try again.' });
      return false;
    } finally {
      if (valid(token)) update({ busy: false });
    }
  };
  return {
    activate: () => { active = true; generation++; },
    invalidate: () => { active = false; generation++; },
    load: async () => {
      if (!active) return;
      const token = ++generation;
      update({ loading: true, error: '', status: null });
      try {
        const status = await api.getAirbnbCalendar(unitId);
        if (valid(token)) {
          if (!status || String(status.unitId) !== String(unitId)) throw new Error('Unexpected unit');
          update({ status });
        }
      } catch {
        if (valid(token)) update({ error: 'Unable to load Airbnb calendar status. Try again.' });
      } finally { if (valid(token)) update({ loading: false }); }
    },
    connect: (url) => run(() => api.connectAirbnbCalendar(unitId, url), 'Airbnb calendar connected. Import queued; dates will appear after a successful sync.'),
    refresh: () => run(() => api.refreshAirbnbCalendar(unitId), 'Airbnb calendar refresh queued; dates will update after sync.'),
    disconnect: () => run(() => api.disconnectAirbnbCalendar(unitId), 'Airbnb calendar disconnected; imported dates cleared.')
  };
}

export function airbnbBlockIsManual(block) {
  return block?.source === 'OwnerBlock' && Number(block.id) > 0;
}

export function formatAirbnbInstant(value, timeZoneId) {
  if (!value) return 'Never';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId, year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    }).format(new Date(value));
  } catch { return 'Unavailable'; }
}
