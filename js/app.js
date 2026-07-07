/**
 * Вся логика времени строго в часовом поясе Europe/Moscow (MSK, UTC+3).
 * Локальный часовой пояс устройства НЕ используется для расчётов поездок.
 */

const MSK_TIMEZONE = 'Europe/Moscow';

/** Конфигурация поездок — даты/время заданы в MSK */
const TRIPS = [
  {
    id: 'pasha-diana',
    title: 'Поездка Паша и Диана',
    departure: createMSKDate(2026, 7, 7, 22, 5, 0),
    arrival: createMSKDate(2026, 7, 8, 8, 3, 0),
    departureLabel: '07.07.2026 · 22:05',
    arrivalLabel: '08.07.2026 · 08:03',
  },
  {
    id: 'vlad',
    title: 'Поездка Влад',
    departure: createMSKDate(2026, 7, 8, 2, 4, 0),
    arrival: createMSKDate(2026, 7, 8, 10, 16, 0),
    departureLabel: '08.07.2026 · 02:04',
    arrivalLabel: '08.07.2026 · 10:16',
  },
];

/**
 * Расписание остановок: дата MSK, город, прибытие, стоянка (мин), отправление.
 * null = нет данных (начальная/конечная станция).
 */
const SCHEDULES = {
  'pasha-diana': [
    { month: 7, day: 7, city: 'Белгород',                   arrival: null,           stop: null, departure: { h: 22, m: 5  } },
    { month: 7, day: 7, city: 'Прохоровка',                 arrival: { h: 22, m: 55 }, stop: 2,  departure: { h: 22, m: 57 } },
    { month: 7, day: 7, city: 'Ржава',                      arrival: { h: 23, m: 16 }, stop: 2,  departure: { h: 23, m: 18 } },
    { month: 7, day: 7, city: 'Солнцево',                   arrival: { h: 23, m: 39 }, stop: 2,  departure: { h: 23, m: 41 } },
    { month: 7, day: 8, city: 'Курск',                      arrival: { h: 0,  m: 25 }, stop: 17, departure: { h: 0,  m: 42 } },
    { month: 7, day: 8, city: 'Орёл',                       arrival: { h: 2,  m: 23 }, stop: 4,  departure: { h: 2,  m: 27 } },
    { month: 7, day: 8, city: 'Тула (Московский вокзал)',   arrival: { h: 4,  m: 33 }, stop: 4,  departure: { h: 4,  m: 37 } },
    { month: 7, day: 8, city: 'Москва (Восточный вокзал)',  arrival: { h: 8,  m: 3  }, stop: null, departure: null },
  ],
  vlad: [
    { month: 7, day: 8, city: 'Санкт-Петербург (Ладожский вокзал)', arrival: { h: 1, m: 52 }, stop: 12, departure: { h: 2, m: 4  } },
    { month: 7, day: 8, city: 'Чудово-московское',                  arrival: { h: 4, m: 6  }, stop: 1,  departure: { h: 4, m: 7  } },
    { month: 7, day: 8, city: 'Малая Вишера',                       arrival: { h: 4, m: 32 }, stop: 1,  departure: { h: 4, m: 33 } },
    { month: 7, day: 8, city: 'Бологое-Московское',                 arrival: { h: 6, m: 5  }, stop: 18, departure: { h: 6, m: 23 } },
    { month: 7, day: 8, city: 'Тверь',                              arrival: { h: 7, m: 54 }, stop: 1,  departure: { h: 7, m: 55 } },
    { month: 7, day: 8, city: 'Завидово*',                          arrival: { h: 8, m: 28 }, stop: 18, departure: { h: 8, m: 46 } },
    { month: 7, day: 8, city: 'Москва (Ленинградский вокзал)',     arrival: { h: 10, m: 16 }, stop: null, departure: null },
  ],
};

/**
 * Создаёт объект Date из компонентов московского времени.
 * Использует ISO-строку с явным смещением +03:00 (MSK).
 */
function createMSKDate(year, month, day, hour, minute, second = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+03:00`;
  return new Date(iso);
}

/**
 * Форматирует текущий момент как московское время (для отображения часов).
 */
function formatMSKClock(date = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MSK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Разбивает миллисекунды на d/h/m/s (неотрицательные).
 */
function splitDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

/**
 * Определяет состояние поездки относительно текущего момента.
 */
function getTripPhase(now, departure, arrival) {
  if (now < departure) return 'before';
  if (now >= departure && now < arrival) return 'transit';
  return 'after';
}

/**
 * Процент прогресса пути (0–100) между выездом и прибытием.
 */
function getProgressPercent(now, departure, arrival) {
  if (now <= departure) return 0;
  if (now >= arrival) return 100;
  const total = arrival - departure;
  const elapsed = now - departure;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/** Преобразует время станции в Date (MSK, 2026) */
function stationTime(station, type) {
  const t = type === 'arrival' ? station.arrival : station.departure;
  if (!t) return null;
  return createMSKDate(2026, station.month, station.day, t.h, t.m, 0);
}

/** Форматирует HH:MM или «—» */
function fmtTime(obj) {
  if (!obj) return '—';
  return `${String(obj.h).padStart(2, '0')}:${String(obj.m).padStart(2, '0')}`;
}

/** Форматирует стоянку */
function fmtStop(minutes) {
  if (minutes == null) return '—';
  const n = minutes % 10;
  const n100 = minutes % 100;
  let word = 'минут';
  if (n100 < 11 || n100 > 14) {
    if (n === 1) word = 'мин';
    else if (n >= 2 && n <= 4) word = 'мин';
  }
  return `${minutes} ${word}`;
}

/** Дата для подписи: «7 июля» */
function fmtDateLabel(station) {
  const months = [
    '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  return `${station.day} ${months[station.month]}`;
}

/**
 * Определяет статус каждой станции относительно now (MSK).
 */
function getScheduleStates(schedule, now) {
  const states = schedule.map(() => 'future');
  const last = schedule[schedule.length - 1];
  const lastArr = stationTime(last, 'arrival');

  if (lastArr && now >= lastArr) {
    return schedule.map((_, i) => (i === schedule.length - 1 ? 'done' : 'past'));
  }

  for (let i = 0; i < schedule.length; i++) {
    const st = schedule[i];
    const arr = stationTime(st, 'arrival');
    const dep = stationTime(st, 'departure');

    if (i === 0 && dep && !arr && now < dep) {
      states[i] = 'current';
      return states;
    }

    if (arr && dep && now >= arr && now < dep) {
      for (let j = 0; j < i; j++) states[j] = 'past';
      states[i] = 'current';
      return states;
    }
  }

  for (let i = 1; i < schedule.length; i++) {
    const prevDep = stationTime(schedule[i - 1], 'departure');
    const nextArr = stationTime(schedule[i], 'arrival');
    if (prevDep && nextArr && now >= prevDep && now < nextArr) {
      for (let j = 0; j < i; j++) states[j] = 'past';
      states[i] = 'current';
      return states;
    }
  }

  return states;
}

/** SVG-иконка поезда */
function trainSVG() {
  return `
    <svg class="train-svg" viewBox="0 0 64 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="12" width="44" height="14" rx="3" fill="#1e293b" stroke="#38bdf8" stroke-width="1.2"/>
      <rect x="48" y="10" width="12" height="16" rx="2" fill="#334155" stroke="#22d3ee" stroke-width="1"/>
      <rect class="train-svg__window" x="10" y="15" width="7" height="5" rx="1" fill="#fef08a"/>
      <rect class="train-svg__window" x="20" y="15" width="7" height="5" rx="1" fill="#fef08a"/>
      <rect class="train-svg__window" x="30" y="15" width="7" height="5" rx="1" fill="#fef08a"/>
      <rect class="train-svg__window" x="50" y="13" width="6" height="4" rx="1" fill="#fde047"/>
      <circle cx="14" cy="27" r="3.5" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <circle cx="28" cy="27" r="3.5" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <circle cx="42" cy="27" r="3.5" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="2" y="18" width="4" height="4" rx="1" fill="#475569"/>
    </svg>
  `;
}

/** HTML расписания для карточки */
function renderSchedule(schedule) {
  const rows = schedule.map((st, i) => `
    <li class="schedule-row" data-stop-index="${i}">
      <div class="schedule-row__dot" aria-hidden="true"></div>
      <div class="schedule-row__body">
        <div class="schedule-row__head">
          <span class="schedule-row__date">${fmtDateLabel(st)}</span>
          <span class="schedule-row__city">${st.city}</span>
        </div>
        <div class="schedule-row__times">
          <span class="schedule-row__time" title="Прибытие">
            <small>Приб.</small> ${fmtTime(st.arrival)}
          </span>
          <span class="schedule-row__time schedule-row__time--stop" title="Стоянка">
            <small>Стоянка</small> ${fmtStop(st.stop)}
          </span>
          <span class="schedule-row__time" title="Отправление">
            <small>Отпр.</small> ${fmtTime(st.departure)}
          </span>
        </div>
      </div>
    </li>
  `).join('');

  return `
    <details class="schedule" open>
      <summary class="schedule__toggle">
        <span class="schedule__toggle-title">Расписание маршрута</span>
        <span class="schedule__toggle-hint" data-role="schedule-status"></span>
      </summary>
      <ol class="schedule__list" data-role="schedule-list">
        ${rows}
      </ol>
    </details>
  `;
}

/** Рендер одной карточки поездки */
function renderTripCard(trip) {
  const schedule = SCHEDULES[trip.id] || [];

  return `
    <article class="trip-card" data-trip-id="${trip.id}">
      <h2 class="trip-card__title">${trip.title}</h2>
      <p class="trip-card__meta">
        <strong>Выезд:</strong> ${trip.departureLabel} MSK<br>
        <strong>Прибытие:</strong> ${trip.arrivalLabel} MSK
      </p>

      <div class="timer-block">
        <p class="timer-block__label">До выезда</p>
        <div class="timer-departure" data-role="departure-timer"></div>
      </div>

      <div class="timer-block">
        <p class="timer-block__label">Путь осталось</p>
        <div class="timer-transit" data-role="transit-timer"></div>
      </div>

      <div class="progress">
        <div class="progress__header">
          <span>Маршрут</span>
          <span class="progress__percent" data-role="progress-percent">0%</span>
        </div>
        <div class="progress__track">
          <div class="progress__line">
            <div class="progress__fill" data-role="progress-fill"></div>
          </div>
          <div class="progress__train-wrap">
            <div class="progress__train" data-role="progress-train">
              <div class="train-smoke" aria-hidden="true">
                <span></span><span></span><span></span>
              </div>
              ${trainSVG()}
            </div>
          </div>
          <div class="progress__stations">
            <span>Отправление</span>
            <span>Прибытие</span>
          </div>
        </div>
      </div>

      ${renderSchedule(schedule)}
    </article>
  `;
}

/** Рендер блока обратного отсчёта (4 единицы) */
function renderCountdown(idPrefix, { days, hours, minutes, seconds }, glow = false) {
  const units = [
    { key: 'days', label: 'дн', value: days },
    { key: 'hours', label: 'ч', value: hours },
    { key: 'minutes', label: 'мин', value: minutes },
    { key: 'seconds', label: 'сек', value: seconds },
  ];

  return `
    <div class="timer-grid" role="timer">
      ${units.map(({ key, label, value }) => `
        <div class="timer-unit">
          <div
            class="timer-unit__value${glow ? ' is-glow' : ''}"
            id="${idPrefix}-${key}"
            data-unit="${key}"
          >${String(value).padStart(2, '0')}</div>
          <div class="timer-unit__label">${label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/** Обновляет DOM таймера с flip-анимацией при смене значения */
function updateCountdown(container, idPrefix, duration, glow = false) {
  const units = ['days', 'hours', 'minutes', 'seconds'];
  const values = [duration.days, duration.hours, duration.minutes, duration.seconds];

  if (!container.querySelector('.timer-grid')) {
    container.innerHTML = renderCountdown(idPrefix, duration, glow);
    return;
  }

  units.forEach((unit, i) => {
    const el = container.querySelector(`[data-unit="${unit}"]`);
    if (!el) return;
    const next = String(values[i]).padStart(2, '0');
    if (el.textContent !== next) {
      el.textContent = next;
      el.classList.remove('is-flip');
      void el.offsetWidth;
      el.classList.add('is-flip');
    }
    el.classList.toggle('is-glow', glow);
  });
}

/** Обновляет подсветку станций расписания */
function updateSchedule(card, trip, now) {
  const schedule = SCHEDULES[trip.id];
  if (!schedule) return;

  const states = getScheduleStates(schedule, now);
  const rows = card.querySelectorAll('[data-stop-index]');
  const statusEl = card.querySelector('[data-role="schedule-status"]');
  const phase = getTripPhase(now, trip.departure, trip.arrival);

  let statusText = '';

  rows.forEach((row, i) => {
    row.classList.remove('is-past', 'is-current', 'is-future', 'is-done');
    const state = states[i];
    if (state === 'past') row.classList.add('is-past');
    else if (state === 'current') {
      row.classList.add('is-current');
      statusText = `→ ${schedule[i].city}`;
    } else if (state === 'done') row.classList.add('is-done');
    else row.classList.add('is-future');
  });

  if (statusEl) {
    if (!statusText) {
      if (phase === 'before') statusText = 'Ожидание отправления';
      else if (phase === 'after') statusText = 'Маршрут завершён';
    }
    statusEl.textContent = statusText;
  }

  const currentRow = card.querySelector('.schedule-row.is-current');
  if (currentRow && card.querySelector('.schedule[open]')) {
    currentRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/** Обновляет одну карточку поездки */
function updateTripCard(card, trip, now) {
  const { departure, arrival } = trip;
  const phase = getTripPhase(now, departure, arrival);

  const depContainer = card.querySelector('[data-role="departure-timer"]');
  const transitContainer = card.querySelector('[data-role="transit-timer"]');
  const fill = card.querySelector('[data-role="progress-fill"]');
  const train = card.querySelector('[data-role="progress-train"]');
  const percentEl = card.querySelector('[data-role="progress-percent"]');
  const prefix = trip.id;

  if (phase === 'before') {
    updateCountdown(depContainer, `${prefix}-dep`, splitDuration(departure - now));
  } else if (phase === 'transit') {
    depContainer.innerHTML = '<span class="status-badge status-badge--transit">Поезд уже в пути</span>';
  } else {
    depContainer.innerHTML = '<span class="status-badge status-badge--departed">Поезд уехал</span>';
  }

  if (phase === 'before') {
    transitContainer.innerHTML = '<span class="status-badge status-badge--waiting">Ожидание отправления</span>';
  } else if (phase === 'transit') {
    updateCountdown(transitContainer, `${prefix}-transit`, splitDuration(arrival - now), true);
  } else {
    transitContainer.innerHTML = '<span class="status-badge status-badge--arrived">Прибыли! 🎉</span>';
  }

  const percent = getProgressPercent(now, departure, arrival);
  fill.style.width = `${percent}%`;
  train.style.left = `${percent}%`;
  percentEl.textContent = `${Math.round(percent)}%`;

  updateSchedule(card, trip, now);
}

/** Инициализация приложения */
function init() {
  const cardsRoot = document.getElementById('trip-cards');
  const clockEl = document.getElementById('msk-clock');

  cardsRoot.innerHTML = TRIPS.map(renderTripCard).join('');
  const cardElements = [...cardsRoot.querySelectorAll('.trip-card')];

  function tick() {
    const now = new Date();

    clockEl.textContent = formatMSKClock(now);
    clockEl.setAttribute('datetime', now.toISOString());

    cardElements.forEach((card, i) => {
      updateTripCard(card, TRIPS[i], now);
    });
  }

  tick();
  setInterval(tick, 1000);
}

init();
