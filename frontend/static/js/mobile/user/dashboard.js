document.addEventListener('DOMContentLoaded', async () => {
  initMobileDashboardChart();
  bindMobileDashboardPeriods();
  await hydrateMobileDashboardEnhancements();
});

function needsMobileDashboardEnhancements() {
  return Boolean(
    document.getElementById('mobileDashboardListings')
    || document.getElementById('statMyListings')
    || document.getElementById('statMyListingsText')
    || document.getElementById('goalFavoritesText')
    || document.getElementById('goalFavoritesBar')
    || document.getElementById('goalBookingsText')
    || document.getElementById('goalBookingsBar')
    || document.getElementById('goalSearchesText')
    || document.getElementById('goalSearchesBar')
    || document.getElementById('mobileDashboardChart'),
  );
}

function initMobileDashboardChart() {
  const canvas = document.getElementById('mobileDashboardChart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const week = emptyWeekSeries();
  const month = emptyMonthSeries();

  const chart = new window.Chart(context, {
    type: 'line',
    data: {
      labels: week.labels,
      datasets: [{
        data: week.values,
        borderColor: '#12161c',
        backgroundColor: 'rgba(226, 255, 49, 0.18)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#12161c',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#12161c',
          bodyColor: '#667085',
          borderColor: '#ebefd0',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f0f2e4' },
          ticks: { color: '#98a2b3' },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#98a2b3' },
        },
      },
    },
  });

  canvas.dataset.week = JSON.stringify(week);
  canvas.dataset.month = JSON.stringify(month);
  canvas._mobileDashboardChart = chart;
}

function emptyWeekSeries() {
  return {
    labels: ['Man', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'],
    values: [0, 0, 0, 0, 0, 0, 0],
  };
}

function emptyMonthSeries() {
  return {
    labels: ['V1', 'V2', 'V3', 'V4'],
    values: [0, 0, 0, 0],
  };
}

function dateFromValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function collectActivityDates(collection = [], candidates = []) {
  const values = [];
  collection.forEach((item) => {
    const found = candidates
      .map((key) => dateFromValue(item?.[key]))
      .find(Boolean);
    if (found) values.push(found);
  });
  return values;
}

function buildWeekSeries(activityDates = []) {
  const labels = ['Man', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
  const values = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  activityDates.forEach((date) => {
    const compare = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((dayStart - compare) / 86400000);
    if (diffDays < 0 || diffDays > 6) return;
    const bucket = 6 - diffDays;
    values[bucket] += 1;
  });

  return { labels, values };
}

function buildMonthSeries(activityDates = []) {
  const labels = ['V1', 'V2', 'V3', 'V4'];
  const values = [0, 0, 0, 0];
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 27);

  activityDates.forEach((date) => {
    if (date < weekStart || date > now) return;
    const diffDays = Math.floor((now - date) / 86400000);
    const weekIndex = Math.max(0, 3 - Math.floor(diffDays / 7));
    values[weekIndex] += 1;
  });

  return { labels, values };
}

function bindMobileDashboardPeriods() {
  const buttons = document.querySelectorAll('.mobile-dashboard-periods button');
  const canvas = document.getElementById('mobileDashboardChart');
  if (!buttons.length || !canvas || !canvas._mobileDashboardChart) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');

      const chart = canvas._mobileDashboardChart;
      const payload = button.dataset.period === 'month'
        ? JSON.parse(canvas.dataset.month || '{}')
        : JSON.parse(canvas.dataset.week || '{}');

      chart.data.labels = payload.labels || [];
      chart.data.datasets[0].data = payload.values || [];
      chart.update();
    });
  });
}

async function hydrateMobileDashboardEnhancements() {
  if (!window.RimalisAPI?.request) return;
  if (!needsMobileDashboardEnhancements()) return;
  try {
    const [listingsBody, favBody, msgBody, bookingsBody, searchesBody] = await Promise.all([
      window.RimalisAPI.request('/users/me/listings', { auth: true }),
      window.RimalisAPI.request('/favorites/me', { auth: true }),
      window.RimalisAPI.request('/messages/me', { auth: true }),
      window.RimalisAPI.request('/users/me/bookings', { auth: true }),
      window.RimalisAPI.request('/users/me/saved-searches', { auth: true }),
    ]);

    const listings = listingsBody?.listings || [];
    const favorites = favBody?.favorites || [];
    const messages = msgBody?.messages || [];
    const bookings = bookingsBody?.bookings || [];
    const searches = searchesBody?.savedSearches || [];

    const unreadMessages = messages.filter((item) => item.state !== 'read').length;
    const activeListings = listings.filter((item) => item.status === 'published' || item.status === 'pending').length;

    const totalListingsEl = document.getElementById('mobileDashboardListings');
    const myListingsEl = document.getElementById('statMyListings');
    const myListingsTextEl = document.getElementById('statMyListingsText');

    if (totalListingsEl) totalListingsEl.textContent = String(listings.length);
    if (myListingsEl) myListingsEl.textContent = String(activeListings);
    if (myListingsTextEl) {
      const i18n = window.RimalisI18n;
      const formattedActiveListings = i18n?.formatNumber?.(activeListings) || String(activeListings);
      const template = i18n?.t?.('user_dashboard_active_or_pending', '{count} aktiva eller väntande')
        || '{count} aktiva eller väntande';
      myListingsTextEl.textContent = template.replace('{count}', formattedActiveListings);
    }

    updateGoal('goalFavorites', favorites.length, 25);
    updateGoal('goalBookings', bookings.length, 10);
    updateGoal('goalSearches', searches.length, 12);
    updateActivityChart({ listings, messages, bookings, favorites, unreadMessages });
  } catch (_err) {
    // leave existing values as fallback
  }
}

function updateGoal(baseId, value, target) {
  const text = document.getElementById(`${baseId}Text`);
  const bar = document.getElementById(`${baseId}Bar`);
  const safeValue = Number(value || 0);
  const safeTarget = Number(target || 1);
  const percent = Math.max(0, Math.min(100, Math.round((safeValue / safeTarget) * 100)));
  if (text) {
    const i18n = window.RimalisI18n;
    const formattedValue = i18n?.formatNumber?.(safeValue) || String(safeValue);
    const formattedTarget = i18n?.formatNumber?.(safeTarget) || String(safeTarget);
    text.textContent = `${formattedValue} / ${formattedTarget}`;
  }
  if (bar) bar.style.width = `${percent}%`;
}

function updateActivityChart({ listings, messages, bookings, favorites, unreadMessages }) {
  const canvas = document.getElementById('mobileDashboardChart');
  if (!canvas || !canvas._mobileDashboardChart) return;

  const activityDates = [
    ...collectActivityDates(listings, ['updatedAt', 'createdAt']),
    ...collectActivityDates(messages, ['updatedAt', 'createdAt', 'sentAt']),
    ...collectActivityDates(bookings, ['scheduledAt', 'updatedAt', 'createdAt']),
    ...collectActivityDates(favorites, ['createdAt', 'savedAt', 'updatedAt']),
  ];

  if (!activityDates.length && unreadMessages > 0) {
    const fallback = new Date();
    for (let i = 0; i < unreadMessages; i += 1) activityDates.push(fallback);
  }

  const week = buildWeekSeries(activityDates);
  const month = buildMonthSeries(activityDates);

  canvas.dataset.week = JSON.stringify(week);
  canvas.dataset.month = JSON.stringify(month);
  const buttons = document.querySelectorAll('.mobile-dashboard-periods button');
  const monthActive = Array.from(buttons).some((button) => button.dataset.period === 'month' && button.classList.contains('is-active'));
  const payload = monthActive ? month : week;
  canvas._mobileDashboardChart.data.labels = payload.labels;
  canvas._mobileDashboardChart.data.datasets[0].data = payload.values;
  canvas._mobileDashboardChart.update();
}
