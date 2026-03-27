/* ============================================
   HEAT INDEX DASHBOARD — APPLICATION LOGIC
   โรงแยกก๊าซ ปตท. ระยอง
   ============================================ */

// ===== CONFIGURATION =====
const CONFIG = {
  // พิกัดจังหวัดระยอง (Map Ta Phut Industrial Area)
  LAT: 12.7100,
  LON: 101.1478,
  // Open-Meteo API base
  API_BASE: 'https://api.open-meteo.com/v1/forecast',
  // Auto-refresh interval (ms) — 15 minutes
  REFRESH_INTERVAL: 15 * 60 * 1000,
  // Timezone
  TIMEZONE: 'Asia/Bangkok',
};

// ===== THAI DAY NAMES =====
const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'];
const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ===== WEATHER CODE → DESCRIPTION (THAI) =====
const WEATHER_DESCRIPTIONS = {
  0: { text: 'ท้องฟ้าแจ่มใส', icon: '☀️' },
  1: { text: 'ส่วนใหญ่แจ่มใส', icon: '🌤️' },
  2: { text: 'มีเมฆบางส่วน', icon: '⛅' },
  3: { text: 'มีเมฆมาก', icon: '☁️' },
  45: { text: 'หมอก', icon: '🌫️' },
  48: { text: 'หมอกแข็ง', icon: '🌫️' },
  51: { text: 'ฝนละอองเบา', icon: '🌦️' },
  53: { text: 'ฝนละอองปานกลาง', icon: '🌦️' },
  55: { text: 'ฝนละอองหนัก', icon: '🌧️' },
  61: { text: 'ฝนเบา', icon: '🌧️' },
  63: { text: 'ฝนปานกลาง', icon: '🌧️' },
  65: { text: 'ฝนหนัก', icon: '🌧️' },
  71: { text: 'หิมะตกเบา', icon: '🌨️' },
  73: { text: 'หิมะตกปานกลาง', icon: '🌨️' },
  75: { text: 'หิมะตกหนัก', icon: '🌨️' },
  80: { text: 'ฝนตกเป็นช่วงเบา', icon: '🌦️' },
  81: { text: 'ฝนตกเป็นช่วงปานกลาง', icon: '🌧️' },
  82: { text: 'ฝนตกเป็นช่วงหนัก', icon: '⛈️' },
  95: { text: 'พายุฝนฟ้าคะนอง', icon: '⛈️' },
  96: { text: 'พายุฝนฟ้าคะนองร่วมลูกเห็บเบา', icon: '⛈️' },
  99: { text: 'พายุฝนฟ้าคะนองร่วมลูกเห็บหนัก', icon: '⛈️' },
};

// ===== WIND DIRECTION → THAI =====
function getWindDirectionThai(degrees) {
  if (degrees == null) return '--';
  const dirs = ['เหนือ', 'ตอ.เหนือ', 'ตะวันออก', 'ตอ.ใต้', 'ใต้', 'ตก.ใต้', 'ตะวันตก', 'ตก.เหนือ'];
  const idx = Math.round(degrees / 45) % 8;
  return dirs[idx];
}

// ===== HEAT INDEX CALCULATION (Rothfusz Regression — NOAA Standard) =====
function calculateHeatIndex(tempC, humidity) {
  // Heat Index is only meaningful when temp >= 27°C (80°F)
  if (tempC < 27) return tempC;

  // Convert to Fahrenheit for the formula
  const T = (tempC * 9 / 5) + 32;
  const R = humidity;

  // Simple approximation first
  let HI = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + R * 0.094);

  if (HI >= 80) {
    // Full Rothfusz regression
    HI = -42.379
      + 2.04901523 * T
      + 10.14333127 * R
      - 0.22475541 * T * R
      - 0.00683783 * T * T
      - 0.05481717 * R * R
      + 0.00122874 * T * T * R
      + 0.00085282 * T * R * R
      - 0.00000199 * T * T * R * R;

    // Adjustments
    if (R < 13 && T >= 80 && T <= 112) {
      HI -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    }
    if (R > 85 && T >= 80 && T <= 87) {
      HI += ((R - 85) / 10) * ((87 - T) / 5);
    }
  }

  // Convert back to Celsius
  return (HI - 32) * 5 / 9;
}

// ===== HEAT LEVEL CLASSIFICATION (เกณฑ์ ปตท.) =====
function getHeatLevel(heatIndexC) {
  if (heatIndexC < 27) return {
    key: 'normal',
    label: 'ปกติ',
    icon: '✅',
    color: 'var(--level-normal)',
    cssClass: 'level-normal',
  };
  if (heatIndexC < 33) return {
    key: 'caution',
    label: 'เฝ้าระวัง',
    icon: '⚠️',
    color: 'var(--level-caution)',
    cssClass: 'level-caution',
  };
  if (heatIndexC < 42) return {
    key: 'warning',
    label: 'เตือนภัย',
    icon: '🔶',
    color: 'var(--level-warning)',
    cssClass: 'level-warning',
  };
  if (heatIndexC < 52) return {
    key: 'danger',
    label: 'อันตราย',
    icon: '🔴',
    color: 'var(--level-danger)',
    cssClass: 'level-danger',
  };
  return {
    key: 'extreme',
    label: 'อันตรายมาก',
    icon: '☠️',
    color: 'var(--level-extreme)',
    cssClass: 'level-extreme',
  };
}

// ===== RECOMMENDATIONS DATA (เกณฑ์ ปตท. — แยก ผู้ปฏิบัติงาน / หัวหน้างาน) =====
function getRecommendations(level) {
  const data = {
    normal: {
      impacts: [
        'ไม่มีความเสี่ยงจากความร้อน',
        'ร่างกายสามารถระบายความร้อนได้ตามปกติ',
      ],
      worker: [
        'ปฏิบัติงานได้ตามปกติ',
        'ดื่มน้ำสะอาดเป็นประจำระหว่างวัน',
      ],
      supervisor: [
        'ตรวจสอบจุดน้ำดื่มให้เพียงพอ',
        'สังเกตอาการผิดปกติของลูกทีมเป็นระยะ',
      ],
      workRest: {
        label: '⏰ ตารางพัก/ทำงาน',
        value: 'ทำงานต่อเนื่องได้ตามปกติ',
        detail: 'พักตามตารางปกติของโรงแยกก๊าซ',
      },
    },
    caution: {
      impacts: [
        'อาจเกิดอาการอ่อนเพลียจากความร้อนได้',
        'ผู้สวมใส่ PPE ปิดคลุม หรือกลุ่มใช้แรงงานหนักมีความเสี่ยงสูงขึ้น',
      ],
      worker: [
        'ดื่มน้ำสะอาดบ่อยๆ ระหว่างวัน โดยไม่ต้องรอให้กระหายน้ำ',
        'ปฏิบัติงานได้ตามปกติ',
      ],
      supervisor: [
        'หมั่นสังเกตอาการผู้ปฏิบัติงานในกลุ่มที่สวมใส่ PPE ปิดคลุม',
        'เฝ้าระวังกลุ่มที่ใช้แรงงานหนัก',
      ],
      workRest: {
        label: '⏰ ตารางพัก/ทำงาน',
        value: 'ปฏิบัติงานได้ตามปกติ',
        detail: 'ดื่มน้ำสะอาดบ่อยๆ โดยไม่ต้องรอกระหายน้ำ',
      },
    },
    warning: {
      impacts: [
        'เสี่ยงเกิดตะคริวจากความร้อน (Heat Cramps)',
        'อาจเกิดอาการเพลียแดด (Heat Exhaustion)',
        'สมาธิลดลง — เพิ่มความเสี่ยงอุบัติเหตุในพื้นที่โรงแยกก๊าซ',
      ],
      worker: [
        'ดื่มน้ำอย่างน้อย 1 แก้วทุก 15 – 20 นาที',
        'พักในร่มอย่างน้อย 5 นาทีทุก 1 ชั่วโมง',
      ],
      supervisor: [
        'จัดพื้นที่พักระหว่างทำงานให้มีร่มเงาเพียงพอ',
        'จัดให้มีอากาศถ่ายเทสะดวกในจุดพัก',
      ],
      workRest: {
        label: '⏰ ตารางพัก/ทำงาน',
        value: 'พักในร่ม 5 นาที ทุก 1 ชั่วโมง',
        detail: 'ดื่มน้ำอย่างน้อย 1 แก้วทุก 15-20 นาที',
      },
    },
    danger: {
      impacts: [
        '⚠️ เสี่ยงสูงต่อโรคลมแดด (Heat Stroke)',
        'อุณหภูมิร่างกายอาจสูงเกิน 40°C',
        'อาการ: สับสน ชัก หมดสติ ผิวหนังร้อนแดง',
        'อันตรายอย่างยิ่งในพื้นที่ปฏิบัติงาน',
      ],
      worker: [
        'ดื่มน้ำมากกว่า 1 แก้วทุก 15 นาที',
        'พักในร่มอย่างน้อย 10 นาทีทุก 1 ชั่วโมง',
      ],
      supervisor: [
        'จัดให้มีการสลับผู้ปฏิบัติงานเป็นระยะ',
        'เฝ้าระวังผู้ปฏิบัติงานอย่างใกล้ชิด',
      ],
      workRest: {
        label: '⏰ ตารางพัก/ทำงาน',
        value: 'พักในร่ม 10 นาที ทุก 1 ชั่วโมง',
        detail: 'ดื่มน้ำมากกว่า 1 แก้วทุก 15 นาที • สลับผู้ปฏิบัติงานเป็นระยะ',
      },
    },
    extreme: {
      impacts: [
        '☠️ เสี่ยงสูงมากต่อโรคลมแดด (Heat Stroke) — อาจเสียชีวิต',
        'ร่างกายไม่สามารถระบายความร้อนได้',
        'แม้คนแข็งแรงก็มีความเสี่ยงสูงมาก',
        'อันตรายร้ายแรงภายในไม่กี่นาที',
      ],
      worker: [
        'ดื่มน้ำอย่างน้อย 1 แก้วทุก 10 – 15 นาที',
        'พักในร่ม 30 นาทีทุก 1 ชั่วโมง',
      ],
      supervisor: [
        'จัดหาเครื่องแต่งกายที่ระบายอากาศได้ดี',
        'จัดให้จุดปฏิบัติงานกลางแจ้งมีร่มเงา',
        'แจ้งผู้บริหารโรงแยกก๊าซและทีม Safety ทันที',
      ],
      workRest: {
        label: '⏰ ตารางพัก/ทำงาน',
        value: 'พักในร่ม 30 นาที ทุก 1 ชั่วโมง',
        detail: 'ดื่มน้ำอย่างน้อย 1 แก้วทุก 10-15 นาที • จัดร่มเงาจุดปฏิบัติงาน',
      },
    },
  };
  return data[level] || data.normal;
}

// ===== RENDER RECOMMENDATIONS =====
function renderRecommendations(levelKey) {
  const rec = getRecommendations(levelKey);

  // Impact list
  document.getElementById('impactList').innerHTML =
    rec.impacts.map(i => `<li>${i}</li>`).join('');

  // Worker recommendations
  document.getElementById('workerRecList').innerHTML =
    rec.worker.map(w => `<li>${w}</li>`).join('');

  // Supervisor recommendations
  document.getElementById('supervisorRecList').innerHTML =
    rec.supervisor.map(s => `<li>${s}</li>`).join('');

  // Work-rest schedule
  document.getElementById('recWorkRest').innerHTML = `
    <div class="work-rest-schedule">
      <div>
        <div class="work-rest-schedule__value">${rec.workRest.value}</div>
        <div class="work-rest-schedule__label">${rec.workRest.detail}</div>
      </div>
    </div>
  `;
}

// ===== FETCH WEATHER DATA =====
async function fetchWeatherData() {
  const params = new URLSearchParams({
    latitude: CONFIG.LAT,
    longitude: CONFIG.LON,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code,relative_humidity_2m_mean,wind_speed_10m_max,uv_index_max',
    timezone: CONFIG.TIMEZONE,
    forecast_days: 7,
  });

  const url = `${CONFIG.API_BASE}?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// ===== UPDATE CLOCK =====
function updateClock() {
  const now = new Date();
  const options = {
    timeZone: CONFIG.TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const timeStr = now.toLocaleTimeString('th-TH', options);

  const dateOptions = {
    timeZone: CONFIG.TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const dateStr = now.toLocaleDateString('th-TH', dateOptions);

  document.getElementById('currentTime').textContent = timeStr;
  document.getElementById('currentDate').textContent = dateStr;
}

// ===== UPDATE DASHBOARD =====
let weeklyChartInstance = null;

async function updateDashboard() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  try {
    statusDot.className = 'status-dot loading';
    statusText.textContent = 'กำลังอัปเดต...';

    const data = await fetchWeatherData();

    // --- Current Weather ---
    const current = data.current;
    const temp = current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const heatIndex = calculateHeatIndex(temp, humidity);
    const level = getHeatLevel(heatIndex);

    // Update hero stats
    document.getElementById('currentTemp').textContent = temp.toFixed(1);
    document.getElementById('currentHumidity').textContent = Math.round(humidity);
    document.getElementById('currentHeatIndex').textContent = heatIndex.toFixed(1);
    document.getElementById('currentHeatIndex').style.color = level.color;
    document.getElementById('tempFeelLike').textContent = `รู้สึกเหมือน ${current.apparent_temperature.toFixed(1)}°C`;

    // Heat index card — level text is the most prominent
    const heatIndexCard = document.getElementById('heatIndexCard');
    heatIndexCard.setAttribute('data-level', level.key);
    const levelTextEl = document.getElementById('heatLevelText');
    levelTextEl.textContent = level.label;
    levelTextEl.style.color = level.color;

    // Set body background for dynamic color
    document.body.setAttribute('data-level', level.key);

    const badge = document.getElementById('heatBadge');
    badge.className = `heat-index__badge ${level.cssClass}`;
    document.getElementById('heatLevelIcon').textContent = level.icon;


    // Weather info inside heat index card
    const weather = WEATHER_DESCRIPTIONS[current.weather_code] || { text: 'ไม่ทราบ', icon: '❓' };
    document.getElementById('weatherDesc').textContent = `${weather.icon} ${weather.text}`;
    document.getElementById('windSpeed').textContent = `${current.wind_speed_10m} km/h`;
    document.getElementById('windDir').textContent = getWindDirectionThai(current.wind_direction_10m);

    // UV Index from daily
    if (data.daily && data.daily.uv_index_max && data.daily.uv_index_max[0] != null) {
      document.getElementById('uvIndex').textContent = data.daily.uv_index_max[0].toFixed(1);
    }

    // Recommendations
    renderRecommendations(level.key);

    // --- Daily Forecast ---
    renderDailyForecast(data.daily);

    // --- Weekly Chart ---
    renderWeeklyChart(data.daily);

    // --- Hourly Table ---
    renderHourlyTable(data.hourly);

    // --- Dew Point (estimate from temp and humidity) ---
    const dewPoint = temp - ((100 - humidity) / 5);
    document.getElementById('dewPoint').textContent = `จุดน้ำค้าง ${dewPoint.toFixed(1)}°C`;

    // --- Status ---
    statusDot.className = 'status-dot';
    statusText.textContent = 'เชื่อมต่อสำเร็จ';

    // Updated time
    const now = new Date();
    document.getElementById('updatedTime').textContent =
      `อัปเดตล่าสุด: ${now.toLocaleString('th-TH', { timeZone: CONFIG.TIMEZONE })} • อัปเดตอัตโนมัติทุก 15 นาที`;

    // Hide loading overlay
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => { overlay.style.display = 'none'; }, 500);

  } catch (error) {
    console.error('Error fetching weather data:', error);
    statusDot.className = 'status-dot error';
    statusText.textContent = 'เชื่อมต่อไม่สำเร็จ';

    // Still hide loading overlay on error
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => { overlay.style.display = 'none'; }, 500);
  }
}

// ===== RENDER DAILY FORECAST =====
function renderDailyForecast(daily) {
  const container = document.getElementById('forecastDays');
  container.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daily.time.length; i++) {
    const date = new Date(daily.time[i] + 'T00:00:00');
    const dayName = THAI_DAYS_SHORT[date.getDay()];
    const dateStr = `${date.getDate()} ${THAI_MONTHS[date.getMonth()]}`;
    const isToday = date.getTime() === today.getTime();

    const tempMax = daily.temperature_2m_max[i];
    const tempMin = daily.temperature_2m_min[i];
    const humidityMean = daily.relative_humidity_2m_mean ? daily.relative_humidity_2m_mean[i] : null;
    const weatherCode = daily.weather_code[i];
    const weather = WEATHER_DESCRIPTIONS[weatherCode] || { icon: '❓', text: '' };

    // Estimate daily max heat index using max temp and mean humidity
    const hum = humidityMean != null ? humidityMean : 70;
    const hiMax = calculateHeatIndex(tempMax, hum);
    const level = getHeatLevel(hiMax);

    const card = document.createElement('div');
    card.className = `forecast-day${isToday ? ' today' : ''}`;
    card.innerHTML = `
      <p class="forecast-day__name">${isToday ? 'วันนี้' : dayName}</p>
      <p class="forecast-day__date">${dateStr}</p>
      <p class="forecast-day__icon">${weather.icon}</p>
      <p class="forecast-day__temp">${Math.round(tempMax)}°<span class="forecast-day__temp-low"> / ${Math.round(tempMin)}°</span></p>
      ${humidityMean != null ? `<p class="forecast-day__humidity">💧 ${Math.round(humidityMean)}%</p>` : ''}
      <p class="forecast-day__hi ${level.cssClass}">${level.icon} ${hiMax.toFixed(0)}°C</p>
    `;
    container.appendChild(card);
  }
}

// ===== RENDER WEEKLY CHART =====
function renderWeeklyChart(daily) {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas) return; // Chart removed from layout
  const ctx = canvas.getContext('2d');

  const labels = daily.time.map(t => {
    const d = new Date(t + 'T00:00:00');
    return `${THAI_DAYS_SHORT[d.getDay()]} ${d.getDate()}`;
  });

  const tempMaxData = daily.temperature_2m_max;
  const tempMinData = daily.temperature_2m_min;
  const humidityData = daily.relative_humidity_2m_mean || new Array(daily.time.length).fill(null);

  // Calculate daily max heat index
  const heatIndexData = tempMaxData.map((t, i) => {
    const hum = humidityData[i] != null ? humidityData[i] : 70;
    return parseFloat(calculateHeatIndex(t, hum).toFixed(1));
  });

  // Destroy previous chart
  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  weeklyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Heat Index (°C)',
          data: heatIndexData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ef4444',
          pointRadius: 4,
          pointHoverRadius: 6,
          order: 1,
        },
        {
          label: 'อุณหภูมิสูงสุด (°C)',
          data: tempMaxData,
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34, 211, 238, 0.05)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#22d3ee',
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 2,
        },
        {
          label: 'อุณหภูมิต่ำสุด (°C)',
          data: tempMinData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderWidth: 2,
          borderDash: [4, 4],
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 3,
        },
        {
          label: 'ความชื้นเฉลี่ย (%)',
          data: humidityData,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderWidth: 1.5,
          borderDash: [2, 3],
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#a855f7',
          pointRadius: 2,
          pointHoverRadius: 4,
          yAxisID: 'y1',
          order: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 11 },
            boxWidth: 14,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(13, 18, 32, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          titleFont: { family: "'Noto Sans Thai', sans-serif" },
          bodyFont: { family: "'Noto Sans Thai', sans-serif" },
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}${ctx.dataset.yAxisID === 'y1' ? '%' : '°C'}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'อุณหภูมิ / Heat Index (°C)',
            color: '#64748b',
            font: { family: "'Noto Sans Thai', sans-serif", size: 11 },
          },
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'ความชื้น (%)',
            color: '#64748b',
            font: { family: "'Noto Sans Thai', sans-serif", size: 11 },
          },
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { drawOnChartArea: false },
          min: 0,
          max: 100,
        },
      },
    },
  });
}

// ===== RENDER HOURLY TABLE =====
function renderHourlyTable(hourly) {
  const tbody = document.getElementById('hourlyBody');
  tbody.innerHTML = '';

  const now = new Date();
  // Use local date to match API's local-time format (Asia/Bangkok)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentHourStr = `${todayStr}T${String(now.getHours()).padStart(2, '0')}:00`;

  // Show only working hours 08:00 – 17:00
  for (let i = 0; i < hourly.time.length; i++) {
    const timeStr = hourly.time[i]; // Format: "2026-03-27T08:00"

    // Only today's data
    if (!timeStr.startsWith(todayStr)) continue;

    // Extract hour from API time string directly
    const hour = parseInt(timeStr.slice(11, 13), 10);

    // Filter: only 08:00 – 17:00
    if (hour < 8 || hour > 17) continue;

    const temp = hourly.temperature_2m[i];
    const humidity = hourly.relative_humidity_2m[i];
    const hi = calculateHeatIndex(temp, humidity);
    const level = getHeatLevel(hi);

    const isCurrent = timeStr === currentHourStr;

    const tr = document.createElement('tr');
    if (isCurrent) tr.className = 'current-hour';

    tr.innerHTML = `
      <td>${String(hour).padStart(2, '0')}:00${isCurrent ? ' 🔹' : ''}</td>
      <td><span class="hi-cell ${level.cssClass}">${hi.toFixed(1)}°C</span></td>
      <td>${level.icon} ${level.label}</td>
      <td>${temp.toFixed(1)}</td>
      <td>${Math.round(humidity)}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Initial data fetch
  updateDashboard();

  // Auto-refresh
  setInterval(updateDashboard, CONFIG.REFRESH_INTERVAL);
});
