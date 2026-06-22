const fmt = new Intl.NumberFormat('en-US');
const compactFmt = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

function formatNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? fmt.format(num) : '-';
}

function formatCompact(value) {
  const num = Number(value);
  return Number.isFinite(num) ? compactFmt.format(num) : '-';
}

async function loadJson(path, fallback) {
  try {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return await res.json();
  } catch (err) {
    return fallback;
  }
}

function getChannelState(channel, data) {
  return data[channel.key] || data[channel.sourceId] || data[channel.youtubeChannelId] || {};
}

function getRows(channels, data) {
  return channels.map((channel) => {
    const channelState = getChannelState(channel, data);
    const subs = Number(channelState.prevValue);
    const avgHour = Number(channelState.prevAvgHour);
    const updatedAt = Number(channelState.prevUpdatedAt);

    return {
      name: channelState.displayName || channel.displayName || channel.sourceId || 'YouTube channel',
      subs: Number.isFinite(subs) ? subs : null,
      avgHour: Number.isFinite(avgHour) ? avgHour : null,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
      guildId: channel.guildId
    };
  });
}

function renderStats(channels, rows) {
  const guildIds = new Set(channels.map((channel) => channel.guildId).filter(Boolean));
  const totalSubs = rows.reduce((sum, row) => sum + (row.subs || 0), 0);
  const totalGrowth = rows.reduce((sum, row) => sum + (row.avgHour || 0), 0);

  document.querySelector('[data-stat="servers"]').textContent = formatNumber(guildIds.size || 0);
  document.querySelector('[data-stat="channels"]').textContent = formatNumber(channels.length);
  document.querySelector('[data-stat="subs"]').textContent = formatCompact(totalSubs);
  document.querySelector('[data-stat="growth"]').textContent = `${formatNumber(Math.round(totalGrowth))}/hr`;
}

function renderInsights(rows) {
  const largest = rows.filter((row) => row.subs != null).sort((a, b) => b.subs - a.subs)[0];
  const fastest = rows.filter((row) => row.avgHour != null).sort((a, b) => b.avgHour - a.avgHour)[0];
  const updatedRows = rows.filter((row) => row.updatedAt);
  const staleCount = rows.filter((row) => !row.updatedAt || (Date.now() - row.updatedAt) / 36e5 > 12).length;

  document.querySelector('[data-insight="largest"]').textContent = largest?.name || '-';
  document.querySelector('[data-insight="largest-meta"]').textContent = largest
    ? `${formatCompact(largest.subs)} subscribers`
    : 'Waiting for data';

  document.querySelector('[data-insight="fastest"]').textContent = fastest?.name || '-';
  document.querySelector('[data-insight="fastest-meta"]').textContent = fastest
    ? `${formatNumber(Math.round(fastest.avgHour || 0))} subscribers per hour`
    : 'Waiting for growth data';

  document.querySelector('[data-insight="health"]').textContent = updatedRows.length
    ? `${updatedRows.length}/${rows.length || 0} updated`
    : '-';
  document.querySelector('[data-insight="health-meta"]').textContent = staleCount
    ? `${staleCount} channel${staleCount === 1 ? '' : 's'} need fresh data`
    : 'All tracked channels have recent data';

  const demoFastest = document.querySelector('[data-demo="fastest"]');
  if (demoFastest) {
    demoFastest.textContent = fastest ? `${formatNumber(Math.round(fastest.avgHour || 0))}/hr` : '0/hr';
  }
}

async function loadDashboard() {
  const [channels, data] = await Promise.all([
    loadJson('channels.json', []),
    loadJson('data.json', {})
  ]);

  const tracked = Array.isArray(channels) ? channels.filter(Boolean) : [];
  const rows = getRows(tracked, data && typeof data === 'object' ? data : {});

  renderStats(tracked, rows);
  renderInsights(rows);
}

loadDashboard();
