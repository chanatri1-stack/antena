// ============================================================================
// УПРАВЛЕНИЕ НАВИГАЦИЕЙ, БОКОВЫМ МЕНЮ И УСТАНОВКОЙ PWA
// ============================================================================
const navItems = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');
const sectionTitle = document.getElementById('currentSectionTitle');
const sidebar = document.getElementById('sidebar');

navItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    navItems.forEach((b) => b.classList.remove('active'));
    tabPanels.forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.add('active');
    sectionTitle.textContent = btn.innerText.trim();
    sidebar.classList.remove('open');
  });
});

document.getElementById('openSidebarBtn').addEventListener('click', () => sidebar.classList.add('open'));
document.getElementById('closeSidebarBtn').addEventListener('click', () => sidebar.classList.remove('open'));

// Регистрация Service Worker для офлайн-режима PWA на GitHub Pages
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Перехват события установки PWA
let deferredPrompt;
const installBtn = document.getElementById('installPwaBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});

// ============================================================================
// МОДУЛЬ 1: РАСЧЕТ ДВУХДИАПАЗОННОЙ АНТЕННЫ УДА-ЯГИ (145 / 435 МГц + 137 МГц)
// ============================================================================
function calcYagi() {
  const f1 = parseFloat(document.getElementById('yagi_f1').value) || 145.0;
  const f2 = parseFloat(document.getElementById('yagi_f2').value) || 435.0;
  const n1 = parseInt(document.getElementById('yagi_n1').value, 10) || 5;
  const n2 = parseInt(document.getElementById('yagi_n2').value, 10) || 10;
  const d = parseFloat(document.getElementById('yagi_d').value) || 4.0;
  const boomD = parseFloat(document.getElementById('yagi_boom_d').value) || 32.0;
  const boomMat = document.getElementById('yagi_boom_mat').value;
  const gap1 = parseFloat(document.getElementById('yagi_gap1').value) || 10.0;

  const lam1 = 299792.458 / f1; // мм
  const lam2 = 299792.458 / f2; // мм

  // Коэффициент коррекции металлической траверсы
  let kb = 0;
  if (boomMat === 'metal_iso') kb = 0.35;
  if (boomMat === 'metal_thru') kb = 0.75;
  const boomCorr = kb * boomD;

  // Поправка на диаметр медного прутка относительно эталона 4.0 мм
  const dCorr1 = (d - 4.0) * (lam1 / 2067.5) * 1.8;
  const dCorr2 = (d - 4.0) * (lam2 / 689.2) * 0.9;

  // Базовые коэффициенты DK7ZB (масштабируемые под любую частоту и число элементов)
  const vhfElements = [];
  const baseVhfPos = [50, 410, 630, 1130, 1720, 2340, 2980, 3640, 4310, 4990];
  const baseVhfLen = [1018, 976, 934, 918, 896, 884, 875, 868, 862, 856];
  const scale1 = lam1 / (299792.458 / 145.0);

  for (let i = 0; i < n1; i++) {
    const pos = Math.round((baseVhfPos[i] || (baseVhfPos[4] + (i - 4) * 620)) * scale1);
    let len = (baseVhfLen[i] || (896 - (i - 4) * 7)) * scale1 - (i >= 2 ? dCorr1 : dCorr1 * 0.5) + boomCorr;
    len = Math.round(len * 10) / 10;
    const type = i === 0 ? 'R1 (Рефлектор)' : i === 1 ? 'DE1 (Вибратор)' : `D${i - 1} (Директор)`;
    const prevPos = i === 0 ? 0 : vhfElements[i - 1].pos;
    vhfElements.push({
      code: i === 0 ? 'R1' : i === 1 ? 'DE1' : `D${i - 1}`,
      type,
      pos,
      step: i === 0 ? '—' : pos - prevPos,
      len,
      note: i === 1 ? `2 плеча по ${((len - gap1) / 2).toFixed(1)} мм + зазор ${gap1} мм` : `Цельный пруток (по ${(len / 2).toFixed(1)} мм в стороны)`
    });
  }

  const uhfElements = [];
  const baseUhfPos = [90, 210, 285, 440, 635, 855, 1085, 1315, 1545, 1765];
  const baseUhfLen = [340, 322, 304, 300, 295, 291, 288, 285, 282, 278];
  const scale2 = lam2 / (299792.458 / 435.0);
  const gap2 = 8;

  for (let i = 0; i < n2; i++) {
    const pos = Math.round((baseUhfPos[i] || (1765 + (i - 9) * 225)) * scale2);
    let len = (baseUhfLen[i] || (278 - (i - 9) * 2.5)) * scale2 - (i >= 2 ? dCorr2 : dCorr2 * 0.5) + boomCorr;
    len = Math.round(len * 10) / 10;
    const prevPos = i === 0 ? 0 : uhfElements[i - 1].pos;
    uhfElements.push({
      code: i === 0 ? 'R2' : i === 1 ? 'DE2' : `D${i - 1}`,
      type: i === 0 ? 'R2 (Рефлектор)' : i === 1 ? 'DE2 (Вибратор)' : `D${i - 1} (Директор)`,
      pos,
      step: i === 0 ? '—' : pos - prevPos,
      len,
      note: i === 1 ? `2 плеча по ${((len - gap2) / 2).toFixed(1)} мм + зазор ${gap2} мм` : 'Цельный пруток вертикально (90°)'
    });
  }

  const maxPos = Math.max(vhfElements[vhfElements.length - 1].pos, uhfElements[uhfElements.length - 1].pos);
  const totalBoom = Math.ceil((maxPos + 55) / 10) * 10;
  const cgPos = Math.round(totalBoom * 0.488);

  // Расчет усиления (Gain) и ширины ДН
  const boomLambda1 = (vhfElements[vhfElements.length - 1].pos - vhfElements[0].pos) / lam1;
  const boomLambda2 = (uhfElements[uhfElements.length - 1].pos - uhfElements[0].pos) / lam2;
  const gain1_dBi = (7.8 + 3.6 * boomLambda1).toFixed(2);
  const gain2_dBi = (7.8 + 2.45 * boomLambda2).toFixed(2);
  const bw1 = Math.round(58 / Math.sqrt(Math.max(0.4, boomLambda1)));
  const bw2 = Math.round(58 / Math.sqrt(Math.max(0.6, boomLambda2)));

  // Длина насадок на 137.5 МГц
  const lam137 = 299792.458 / 137.5;
  const sleeve137 = Math.max(0, Math.round(0.24 * (lam137 - lam1)));

  document.getElementById('yagi_kpis').innerHTML = `
    <div class="kpi-box ok"><div class="kpi-label">Общая длина траверсы</div><div class="kpi-val">${totalBoom} мм</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Центр тяжести (крепление ОПУ)</div><div class="kpi-val">${cgPos} мм</div></div>
    <div class="kpi-box"><div class="kpi-label">Усиление УКВ (${f1} МГц)</div><div class="kpi-val">${gain1_dBi} дБи (±${Math.round(bw1/2)}°)</div></div>
    <div class="kpi-box"><div class="kpi-label">Усиление ДМВ (${f2} МГц)</div><div class="kpi-val">${gain2_dBi} дБи (±${Math.round(bw2/2)}°)</div></div>
    <div class="kpi-box warn"><div class="kpi-label">Насадки на DE1 для 137.5 МГц</div><div class="kpi-val">2 шт. по ${sleeve137} мм</div></div>
  `;

  // Заполнение таблиц
  const renderTable = (arr) => `
    <table>
      <thead><tr><th>Элемент</th><th>Координата X (мм)</th><th>Шаг (мм)</th><th>Длина (мм)</th><th>Монтаж</th></tr></thead>
      <tbody>${arr.map(e => `<tr><td><b>${e.code}</b></td><td><b>${e.pos}</b></td><td>${e.step}</td><td><b>${e.len}</b></td><td>${e.note}</td></tr>`).join('')}</tbody>
    </table>`;
  document.getElementById('yagi_table_vhf').innerHTML = renderTable(vhfElements);
  document.getElementById('yagi_table_uhf').innerHTML = renderTable(uhfElements);

  // Отрисовка динамического SVG-чертежа антенны
  const svgW = 1100, svgH = 440;
  const scaleX = 920 / totalBoom;
  let vhfLines = '', uhfLines = '';

  vhfElements.forEach((e) => {
    const x = 90 + e.pos * scaleX;
    const half = (e.len / 1050) * 85;
    const color = e.code === 'DE1' ? '#d93025' : '#b45309';
    vhfLines += `<line x1="${x}" y1="${135 - half}" x2="${x}" y2="${135 + half}" stroke="${color}" stroke-width="3.5"/>
                 <text x="${x}" y="${128 - half}" font-size="10" font-weight="bold" text-anchor="middle" fill="${color}">${e.code} (${e.len})</text>
                 <text x="${x}" y="${152 + half}" font-size="9" text-anchor="middle" fill="#0b5394">X=${e.pos}</text>`;
  });

  uhfElements.forEach((e) => {
    const x = 90 + e.pos * scaleX;
    const half = (e.len / 350) * 45;
    const color = e.code === 'DE2' ? '#d93025' : '#15803d';
    uhfLines += `<line x1="${x}" y1="${335 - half}" x2="${x}" y2="${335 + half}" stroke="${color}" stroke-width="3"/>
                 <text x="${x}" y="${328 - half}" font-size="9" font-weight="bold" text-anchor="middle" fill="${color}">${e.code} (${e.len})</text>
                 <text x="${x}" y="${352 + half}" font-size="9" text-anchor="middle" fill="#15803d">X=${e.pos}</text>`;
  });

  const cgX = 90 + cgPos * scaleX;
  document.getElementById('yagi_svg_box').innerHTML = `
    <svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${svgW}" height="${svgH}" fill="#ffffff"/>
      <text x="550" y="24" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">МАСШТАБНЫЙ ЧЕРТЕЖ: ТРАВЕРСА ${totalBoom} ММ (ВЕРХ: ${f1} МГц ГОРИЗОНТ. | НИЗ: ${f2} МГц ВЕРТИК. 90°)</text>
      <!-- Траверса 145 МГц -->
      <rect x="90" y="129" width="920" height="12" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1.5"/>
      ${vhfLines}
      <circle cx="${cgX}" cy="135" r="6" fill="#dc2626"/>
      <text x="${cgX}" y="118" font-size="10" font-weight="bold" text-anchor="middle" fill="#dc2626">ЦТ (${cgPos} мм)</text>
      <!-- Траверса 435 МГц -->
      <rect x="90" y="329" width="920" height="12" fill="#dcfce7" stroke="#14532d" stroke-width="1.5"/>
      ${uhfLines}
      <text x="1030" y="139" font-size="11" font-weight="bold" fill="#d93025">───► ВПЕРЕД</text>
      <text x="1030" y="339" font-size="11" font-weight="bold" fill="#d93025">───► ВПЕРЕД</text>
    </svg>
  `;
}

// ============================================================================
// МОДУЛЬ 2: РАСЧЕТ ЧЕРВЯЧНОГО МЕХАНИЗМА И ЗУБЧАТОГО КОЛЕСА (ШЕСТЕРНИ)
// ============================================================================
function calcWorm() {
  const m = parseFloat(document.getElementById('worm_m').value) || 2.0;
  const z1 = parseInt(document.getElementById('worm_z1').value, 10) || 1;
  const z2 = parseInt(document.getElementById('worm_z2').value, 10) || 50;
  const q = parseFloat(document.getElementById('worm_q').value) || 10.0;
  const mu = parseFloat(document.getElementById('worm_mu').value) || 0.08;
  const rpm = parseFloat(document.getElementById('worm_rpm').value) || 60;

  const ratio = z2 / z1;
  const d1 = m * q;               // Делительный диаметр червяка
  const da1 = d1 + 2 * m;         // Диаметр вершин витков червяка
  const df1 = d1 - 2.4 * m;       // Диаметр впадин червяка
  const d2 = m * z2;              // Делительный диаметр колеса (шестерни)
  const da2 = d2 + 2 * m;         // Внешний диаметр шестерни
  const df2 = d2 - 2.4 * m;       // Диаметр впадин шестерни
  const aw = 0.5 * m * (q + z2);  // Межосевое расстояние

  // Угол подъема витка и угол трения
  const gammaRad = Math.atan(z1 / q);
  const gammaDeg = (gammaRad * 180) / Math.PI;
  const rhoRad = Math.atan(mu / Math.cos((20 * Math.PI) / 180));
  const rhoDeg = (rhoRad * 180) / Math.PI;

  const isSelfLocking = gammaDeg < rhoDeg;
  const eff = (Math.tan(gammaRad) / Math.tan(gammaRad + rhoRad)) * 100;
  const outRpm = rpm / ratio;
  const outDegSec = outRpm * 6;

  // Автоматическая передача рассчитанного КПД и редукции в Модуль 3
  document.getElementById('mot_ratio').value = ratio.toFixed(1);
  document.getElementById('mot_eff').value = eff.toFixed(0);

  document.getElementById('worm_kpis').innerHTML = `
    <div class="kpi-box ok"><div class="kpi-label">Передаточное отношение (i)</div><div class="kpi-val">1 : ${ratio.toFixed(1)}</div></div>
    <div class="kpi-box ${isSelfLocking ? 'ok' : 'danger'}">
      <div class="kpi-label">Самоторможение от ветра</div>
      <div class="kpi-val">${isSelfLocking ? '✅ ДА (γ < ρ)' : '❌ НЕТ (риск проворота)'}</div>
    </div>
    <div class="kpi-box"><div class="kpi-label">Межосевое расстояние (a_w)</div><div class="kpi-val">${aw.toFixed(2)} мм</div></div>
    <div class="kpi-box"><div class="kpi-label">Диаметр шестерни (d₂ / da₂)</div><div class="kpi-val">${d2.toFixed(1)} / ${da2.toFixed(1)} мм</div></div>
    <div class="kpi-box"><div class="kpi-label">Диаметр червяка (d₁ / da₁)</div><div class="kpi-val">${d1.toFixed(1)} / ${da1.toFixed(1)} мм</div></div>
    <div class="kpi-box warn"><div class="kpi-label">Угол витка γ / Трение ρ</div><div class="kpi-val">${gammaDeg.toFixed(2)}° / ${rhoDeg.toFixed(2)}°</div></div>
    <div class="kpi-box"><div class="kpi-label">КПД червячной пары (η)</div><div class="kpi-val">${eff.toFixed(1)} %</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Скорость вращения антенны</div><div class="kpi-val">${outDegSec.toFixed(1)} град/с (${outRpm.toFixed(2)} об/мин)</div></div>
  `;

  // Отрисовка чертежа червячной пары с зубьями
  let teethPaths = '';
  const numTeethDraw = Math.min(z2, 60);
  const rOut = 115, rPitch = 105, rRoot = 94;
  const cx = 520, cy = 220;
  for (let i = 0; i < numTeethDraw; i++) {
    const a1 = (i * 2 * Math.PI) / numTeethDraw;
    const a2 = ((i + 0.45) * 2 * Math.PI) / numTeethDraw;
    const x1 = cx + rOut * Math.cos(a1), y1 = cy + rOut * Math.sin(a1);
    const x2 = cx + rOut * Math.cos(a2), y2 = cy + rOut * Math.sin(a2);
    teethPaths += `<line x1="${cx + rRoot * Math.cos(a1)}" y1="${cy + rRoot * Math.sin(a1)}" x2="${x1}" y2="${y1}" stroke="#b45309" stroke-width="3"/>`;
  }

  document.getElementById('worm_svg_box').innerHTML = `
    <svg viewBox="0 0 1050 380" xmlns="http://www.w3.org/2000/svg">
      <rect width="1050" height="380" fill="#ffffff"/>
      <text x="525" y="25" font-family="Arial" font-size="15" font-weight="bold" text-anchor="middle" fill="#000">ЧЕРТЕЖ ЧЕРВЯЧНОЙ ПАРЫ: ЧЕРВЯК (z₁=${z1}, d₁=${d1.toFixed(1)} мм) + КОЛЕСО (z₂=${z2}, d₂=${d2.toFixed(1)} мм)</text>

      <!-- Червяк сверху -->
      <rect x="370" y="65" width="300" height="44" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
      <path d="M 410 65 L 425 109 M 435 65 L 450 109 M 460 65 L 475 109 M 485 65 L 500 109 M 510 65 L 525 109 M 535 65 L 550 109 M 560 65 L 575 109 M 585 65 L 600 109 M 610 65 L 625 109" stroke="#1e3a8a" stroke-width="3"/>
      <line x1="330" y1="87" x2="710" y2="87" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6,4"/>
      <text x="200" y="92" font-size="12" font-weight="bold" fill="#1e3a8a">Ось червяка: d₁ = ${d1.toFixed(1)} мм (da₁ = ${da1.toFixed(1)} мм)</text>

      <!-- Червячное колесо снизу -->
      <circle cx="${cx}" cy="${cy}" r="${rOut}" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
      ${teethPaths}
      <circle cx="${cx}" cy="${cy}" r="${rPitch}" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5,4"/>
      <circle cx="${cx}" cy="${cy}" r="24" fill="#94a3b8" stroke="#0f172a" stroke-width="2"/>
      <text x="${cx}" y="${cy + 4}" font-size="11" font-weight="bold" text-anchor="middle" fill="#000">Вал ОПУ</text>

      <!-- Размер межосевого расстояния aw -->
      <line x1="520" y1="87" x2="800" y2="87" stroke="#0b5394" stroke-width="1.5"/>
      <line x1="520" y1="220" x2="800" y2="220" stroke="#0b5394" stroke-width="1.5"/>
      <line x1="780" y1="87" x2="780" y2="220" stroke="#0b5394" stroke-width="2.5"/>
      <text x="795" y="150" font-size="13" font-weight="bold" fill="#0b5394">Межосевое a_w = ${aw.toFixed(2)} мм</text>
      <text x="795" y="172" font-size="12" fill="#15803d">Шаг зуба P = ${(Math.PI * m).toFixed(2)} мм (Модуль m=${m})</text>
      <text x="795" y="194" font-size="12" font-weight="bold" fill="${isSelfLocking ? '#15803d' : '#dc2626'}">${isSelfLocking ? 'Самоторможение: ВКЛЮЧЕНО' : 'ВНИМАНИЕ: Нет самоторможения!'}</text>
    </svg>
  `;
}

// ============================================================================
// МОДУЛЬ 3: РАСЧЕТ МОЩНОСТИ МОТОРОВ АЗИМУТА/ЭЛЕВАЦИИ И ВЕТРОВОЙ НАГРУЗКИ
// ============================================================================
function calcMotors() {
  const L = parseFloat(document.getElementById('mot_L').value) || 1.8;
  const mass = parseFloat(document.getElementById('mot_mass').value) || 1.4;
  const offsetMm = parseFloat(document.getElementById('mot_offset').value) || 40;
  const V = parseFloat(document.getElementById('mot_wind').value) || 20;
  const degS = parseFloat(document.getElementById('mot_deg_s').value) || 6.0;
  const ratio = parseFloat(document.getElementById('mot_ratio').value) || 50;
  const effPct = parseFloat(document.getElementById('mot_eff').value) || 42;
  const volt = parseFloat(document.getElementById('mot_volt').value) || 12;

  // Площадь парусности (траверса 32 мм + 15 элементов)
  const areaBoom = L * 0.032;
  const areaElems = (5 * 0.95 + 10 * 0.30) * 0.004;
  const totalArea = areaBoom + areaElems; // м^2

  // Сила давления ветра: F = 0.5 * rho * V^2 * Cd * A
  const windForce = 0.5 * 1.225 * V * V * 1.2 * totalArea; // Ньютоны
  // Крутящий момент от неравномерности ветра (коэффициент асимметрии 0.28)
  const torqueWind = windForce * (L / 4) * 0.28;

  // Гравитационный момент дисбаланса на валу элевации
  const torqueGrav = mass * 9.81 * (offsetMm / 1000);

  // Момент инерции антенны при старте: J = 1/12 * m * L^2
  const J = (1 / 12) * mass * L * L;
  const omegaRad = (degS * Math.PI) / 180;
  const alphaAccel = omegaRad / 0.5; // Разгон за 0.5 сек
  const torqueDyn = J * alphaAccel;

  // Суммарный момент на выходном валу с коэффициентом запаса 1.5
  const totalTorqueAz = (torqueWind + torqueDyn + 0.8) * 1.5;
  const totalTorqueEl = (torqueWind * 0.7 + torqueGrav + torqueDyn + 0.8) * 1.5;
  const maxShaftTorque = Math.max(totalTorqueAz, totalTorqueEl);

  // Требуемый момент на валу самого моторчика до червячного редуктора
  const eff = effPct / 100;
  const motorTorqueNm = maxShaftTorque / (ratio * eff);

  // Электрическая мощность и потребляемый ток
  const mechPowerW = maxShaftTorque * omegaRad;
  const elecPowerW = mechPowerW / (eff * 0.65); // 0.65 - КПД коллекторного мотора
  const currentA = Math.max(0.8, elecPowerW / volt);

  document.getElementById('motor_kpis').innerHTML = `
    <div class="kpi-box"><div class="kpi-label">Площадь парусности / Сила ветра</div><div class="kpi-val">${totalArea.toFixed(3)} м² / ${windForce.toFixed(1)} Н</div></div>
    <div class="kpi-box warn"><div class="kpi-label">Момент на валу Азимута (с запасом)</div><div class="kpi-val">${totalTorqueAz.toFixed(2)} Н·м</div></div>
    <div class="kpi-box warn"><div class="kpi-label">Момент на валу Элевации (с запасом)</div><div class="kpi-val">${totalTorqueEl.toFixed(2)} Н·м</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Момент мотора ДО редуктора</div><div class="kpi-val">${(motorTorqueNm * 1000).toFixed(0)} мН·м (${motorTorqueNm.toFixed(3)} Н·м)</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Требуемая мощность мотора</div><div class="kpi-val">${elecPowerW.toFixed(1)} Вт</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Рабочий ток при ${volt} В</div><div class="kpi-val">${currentA.toFixed(2)} А (БП ≥ ${(currentA * 2).toFixed(0)} А)</div></div>
  `;

  document.getElementById('motor_svg_box').innerHTML = `
    <svg viewBox="0 0 1050 320" xmlns="http://www.w3.org/2000/svg">
      <rect width="1050" height="320" fill="#ffffff"/>
      <text x="525" y="25" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">ЭПЮРА СИЛ И КРУТЯЩИХ МОМЕНТОВ НА ОПУ ПРИ СКОРОСТИ ВЕТРА ${V} М/С</text>
      <!-- Траверса под наклоном -->
      <g transform="translate(520, 145) rotate(-15)">
        <rect x="-320" y="-8" width="640" height="16" fill="#bfdbfe" stroke="#1e3a8a" stroke-width="2"/>
        <circle cx="0" cy="0" r="8" fill="#0f172a"/>
        <circle cx="${offsetMm * 1.5}" cy="0" r="6" fill="#dc2626"/>
        <line x1="${offsetMm * 1.5}" y1="0" x2="${offsetMm * 1.5}" y2="75" stroke="#dc2626" stroke-width="3"/>
        <text x="${offsetMm * 1.5 + 10}" y="65" font-size="12" font-weight="bold" fill="#dc2626">G = ${(mass * 9.81).toFixed(1)} Н (M_грав = ${torqueGrav.toFixed(2)} Н·м)</text>
      </g>
      <!-- Стрелки ветра -->
      <g stroke="#0284c7" stroke-width="2.5">
        <line x1="110" y1="80" x2="210" y2="80"/><line x1="110" y1="120" x2="210" y2="120"/><line x1="110" y1="160" x2="210" y2="160"/>
      </g>
      <text x="105" y="65" font-size="13" font-weight="bold" fill="#0284c7">Ветер V = ${V} м/с (F = ${windForce.toFixed(1)} Н)</text>
      <!-- Опора ОПУ -->
      <rect x="485" y="155" width="70" height="110" rx="6" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>
      <text x="520" y="205" font-size="12" font-weight="bold" text-anchor="middle" fill="#0f172a">ОПУ 1:${ratio}</text>
      <text x="520" y="225" font-size="11" font-weight="bold" text-anchor="middle" fill="#15803d">M_аз = ${totalTorqueAz.toFixed(2)} Н·м</text>
      <text x="520" y="242" font-size="11" font-weight="bold" text-anchor="middle" fill="#b45309">M_эл = ${totalTorqueEl.toFixed(2)} Н·м</text>
    </svg>
  `;
}

// ============================================================================
// МОДУЛЬ 4: ВЧ-ДИПЛЕКСЕР (145/435 МГц), КАТУШКИ И БЮДЖЕТ ЛУНЫ (EME)
// ============================================================================
function calcRF() {
  const fLpf = parseFloat(document.getElementById('rf_f_lpf').value) || 165;
  const fHpf = parseFloat(document.getElementById('rf_f_hpf').value) || 380;
  const coilD = parseFloat(document.getElementById('rf_coil_d').value) || 6.0;
  const wireD = parseFloat(document.getElementById('rf_wire_d').value) || 1.0;
  const lnaNf = parseFloat(document.getElementById('rf_lna_nf').value) || 0.6;
  const txPwr = parseFloat(document.getElementById('rf_tx_pwr').value) || 1000;
  const txGain = parseFloat(document.getElementById('rf_tx_gain').value) || 19.5;
  const groundGain = parseFloat(document.getElementById('rf_ground_gain').value) || 5.0;

  const Z0 = 50;
  // T-образный ФНЧ (L1, C1, L2)
  const L1_nH = (Z0 / (Math.PI * fLpf * 1e6)) * 1e9;
  const C1_pF = (2 / (2 * Math.PI * fLpf * 1e6 * Z0)) * 1e12;

  // T-образный ФВЧ (C2, L3, C3)
  const C2_pF = (1 / (2 * Math.PI * fHpf * 1e6 * Z0)) * 1e12;
  const L3_nH = (Z0 / (4 * Math.PI * fHpf * 1e6)) * 1e9;

  // Число витков по формуле Уилера
  const rMean = (coilD + wireD) / 2;
  const turnsL1 = Math.sqrt((L1_nH / 1000) * (228.6 * rMean + 254 * 7) / (rMean * rMean));
  const turnsL3 = Math.sqrt((L3_nH / 1000) * (228.6 * rMean + 254 * 4) / (rMean * rMean));

  // Энергетический расчет радиолинии Земля-Луна-Земля (EME) на 144 МГц в моде Q65 (полоса 2500 Гц)
  const txPwrDbm = 10 * Math.log10(txPwr * 1000);
  const pathLossEme = 251.8; // дБ на 144.120 МГц
  const rxGain = 10.75 + groundGain; // Усиление нашей Яги + Ground Gain
  const rxSignalDbm = txPwrDbm + txGain - pathLossEme + rxGain;
  const noiseFloorDbm = -174 + 10 * Math.log10(2500) + lnaNf + 1.5; // с учетом шума космоса
  const snr2500 = rxSignalDbm - noiseFloorDbm;
  const canDecodeQ65 = snr2500 >= -29.5;

  document.getElementById('rf_kpis').innerHTML = `
    <div class="kpi-box ok"><div class="kpi-label">Катушки ФНЧ L1, L2 (145 МГц)</div><div class="kpi-val">${L1_nH.toFixed(1)} нГн (${turnsL1.toFixed(1)} вит. на Ø${coilD} мм)</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Конденсатор ФНЧ C1</div><div class="kpi-val">${C1_pF.toFixed(1)} пФ (NP0)</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Катушка ФВЧ L3 (435 МГц)</div><div class="kpi-val">${L3_nH.toFixed(1)} нГн (${turnsL3.toFixed(1)} вит. на Ø${coilD} мм)</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Конденсаторы ФВЧ C2, C3</div><div class="kpi-val">${C2_pF.toFixed(1)} пФ (NP0)</div></div>
    <div class="kpi-box ${canDecodeQ65 ? 'ok' : 'warn'}"><div class="kpi-label">Уровень EME сигнала от Луны (SNR)</div><div class="kpi-val">${snr2500.toFixed(1)} дБ (Порог Q65: -29 дБ)</div></div>
    <div class="kpi-box ${canDecodeQ65 ? 'ok' : 'danger'}"><div class="kpi-label">Вердикт приема Луны (WSJT-X Q65)</div><div class="kpi-val">${canDecodeQ65 ? '✅ ДЕКОДИРУЕТСЯ' : '❌ Слишком слабый'}</div></div>
  `;

  document.getElementById('rf_svg_box').innerHTML = `
    <svg viewBox="0 0 1050 320" xmlns="http://www.w3.org/2000/svg">
      <rect width="1050" height="320" fill="#ffffff"/>
      <text x="525" y="25" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">РАССЧИТАННАЯ СХЕМА ДИПЛЕКСЕРА (50 ОМ) И МШУ (LNA SPF5189Z)</text>
      <!-- Ветвь VHF -->
      <line x1="80" y1="100" x2="180" y2="100" stroke="#000" stroke-width="2.5"/>
      <path d="M 180 100 A 15 15 0 0 1 210 100 A 15 15 0 0 1 240 100 A 15 15 0 0 1 270 100" fill="none" stroke="#0b5394" stroke-width="3"/>
      <text x="225" y="78" font-size="12" font-weight="bold" text-anchor="middle" fill="#0b5394">L1 = ${L1_nH.toFixed(1)} нГн (${turnsL1.toFixed(1)} вит.)</text>
      <line x1="270" y1="100" x2="400" y2="100" stroke="#000" stroke-width="2.5"/>
      <line x1="335" y1="100" x2="335" y2="145" stroke="#dc2626" stroke-width="3"/>
      <text x="345" y="140" font-size="12" font-weight="bold" fill="#dc2626">C1 = ${C1_pF.toFixed(1)} пФ (на GND)</text>
      <path d="M 400 100 A 15 15 0 0 1 430 100 A 15 15 0 0 1 460 100 A 15 15 0 0 1 490 100" fill="none" stroke="#0b5394" stroke-width="3"/>
      <text x="445" y="78" font-size="12" font-weight="bold" text-anchor="middle" fill="#0b5394">L2 = ${L1_nH.toFixed(1)} нГн</text>
      <line x1="490" y1="100" x2="600" y2="100" stroke="#000" stroke-width="2.5"/>

      <!-- Ветвь UHF -->
      <line x1="80" y1="230" x2="210" y2="230" stroke="#000" stroke-width="2.5"/>
      <rect x="210" y="215" width="10" height="30" fill="#dc2626"/>
      <text x="215" y="205" font-size="12" font-weight="bold" text-anchor="middle" fill="#dc2626">C2 = ${C2_pF.toFixed(1)} пФ</text>
      <line x1="220" y1="230" x2="440" y2="230" stroke="#000" stroke-width="2.5"/>
      <line x1="335" y1="230" x2="335" y2="285" stroke="#15803d" stroke-width="3"/>
      <text x="345" y="275" font-size="12" font-weight="bold" fill="#15803d">L3 = ${L3_nH.toFixed(1)} нГн (${turnsL3.toFixed(1)} вит. на GND)</text>
      <rect x="440" y="215" width="10" height="30" fill="#dc2626"/>
      <text x="445" y="205" font-size="12" font-weight="bold" text-anchor="middle" fill="#dc2626">C3 = ${C2_pF.toFixed(1)} пФ</text>
      <line x1="450" y1="230" x2="600" y2="230" stroke="#000" stroke-width="2.5"/>

      <!-- Сумматор и LNA -->
      <line x1="600" y1="100" x2="600" y2="230" stroke="#000" stroke-width="2.5"/>
      <line x1="600" y1="165" x2="700" y2="165" stroke="#000" stroke-width="2.5"/>
      <polygon points="700,120 700,210 810,165" fill="#fef08a" stroke="#000" stroke-width="2.5"/>
      <text x="742" y="169" font-size="13" font-weight="bold" text-anchor="middle" fill="#000">LNA (${lnaNf} дБ)</text>
      <line x1="810" y1="165" x2="950" y2="165" stroke="#000" stroke-width="2.5"/>
      <text x="890" y="150" font-size="12" font-weight="bold" fill="#15803d">К SDR-приемнику (50 Ом)</text>
    </svg>
  `;
}

// ============================================================================
// МОДУЛЬ 5: ДАТЧИКИ УГЛА AS5600 И ТЕПЛОВОЙ РАСЧЕТ H-МОСТА
// ============================================================================
function calcController() {
  const type = document.getElementById('ctrl_sensor_type').value;
  const rawAz = parseInt(document.getElementById('ctrl_raw_az').value, 10) || 0;
  const rawEl = parseInt(document.getElementById('ctrl_raw_el').value, 10) || 0;
  const rdson = parseFloat(document.getElementById('ctrl_rdson').value) || 17.5;
  const motorI = parseFloat(document.getElementById('ctrl_motor_i').value) || 3.5;
  const pwm = parseInt(document.getElementById('ctrl_pwm').value, 10) || 180;

  const maxRaw = type === 'as5600' ? 4096 : 1024;
  const stepDeg = 360 / maxRaw;
  const azDeg = ((rawAz % maxRaw) / maxRaw) * 360;
  const elDeg = Math.min(90, ((rawEl % maxRaw) / maxRaw) * 360);

  const duty = pwm / 255;
  const powerLossW = motorI * motorI * (rdson / 1000) * duty;
  const tempRiseC = 25 + powerLossW * 62; // TO-220 без радиатора Rth = 62 C/W

  document.getElementById('ctrl_kpis').innerHTML = `
    <div class="kpi-box ok"><div class="kpi-label">Разрешение датчика угла</div><div class="kpi-val">${stepDeg.toFixed(3)}° на 1 отсчет</div></div>
    <div class="kpi-box"><div class="kpi-label">Текущий Азимут антенны</div><div class="kpi-val">${azDeg.toFixed(1)}°</div></div>
    <div class="kpi-box"><div class="kpi-label">Текущая Элевация антенны</div><div class="kpi-val">${elDeg.toFixed(1)}°</div></div>
    <div class="kpi-box ok"><div class="kpi-label">Команда EasyComm II в UART</div><div class="kpi-val">AZ${azDeg.toFixed(1)} EL${elDeg.toFixed(1)}</div></div>
    <div class="kpi-box ${powerLossW < 1 ? 'ok' : 'warn'}"><div class="kpi-label">Нагрев ключа IRFZ44N</div><div class="kpi-val">${powerLossW.toFixed(2)} Вт (~${tempRiseC.toFixed(0)} °C)</div></div>
  `;

  const azRad = ((azDeg - 90) * Math.PI) / 180;
  const elRad = (-elDeg * Math.PI) / 180;

  document.getElementById('ctrl_svg_box').innerHTML = `
    <svg viewBox="0 0 1050 280" xmlns="http://www.w3.org/2000/svg">
      <rect width="1050" height="280" fill="#ffffff"/>
      <!-- Компас Азимута -->
      <circle cx="260" cy="145" r="105" fill="#f8fafc" stroke="#1e293b" stroke-width="2.5"/>
      <text x="260" y="30" font-size="13" font-weight="bold" text-anchor="middle" fill="#0b5394">АЗИМУТ: ${azDeg.toFixed(1)}° (Север = 0°)</text>
      <line x1="260" y1="145" x2="${260 + 90 * Math.cos(azRad)}" y2="${145 + 90 * Math.sin(azRad)}" stroke="#dc2626" stroke-width="4"/>
      <circle cx="260" cy="145" r="6" fill="#0f172a"/>

      <!-- Угломер Элевации -->
      <path d="M 650 220 L 850 220 A 200 200 0 0 0 650 20 Z" fill="#f0fdf4" stroke="#15803d" stroke-width="2.5"/>
      <text x="750" y="30" font-size="13" font-weight="bold" text-anchor="middle" fill="#15803d">ЭЛЕВАЦИЯ: ${elDeg.toFixed(1)}° (Горизонт = 0°)</text>
      <line x1="650" y1="220" x2="${650 + 180 * Math.cos(elRad)}" y2="${220 + 180 * Math.sin(elRad)}" stroke="#dc2626" stroke-width="4"/>
      <circle cx="650" cy="220" r="6" fill="#0f172a"/>
    </svg>
  `;
}

// Инициализация и привязка всех полей ввода к мгновенному пересчету
function recalcAll() {
  calcYagi();
  calcWorm();
  calcMotors();
  calcRF();
  calcController();
}

function resetDefaults() {
  document.getElementById('yagi_f1').value = 145.0;
  document.getElementById('yagi_f2').value = 435.0;
  document.getElementById('yagi_n1').value = 5;
  document.getElementById('yagi_n2').value = 10;
  document.getElementById('yagi_d').value = 4.0;
  document.getElementById('yagi_boom_d').value = 32;
  document.getElementById('yagi_boom_mat').value = 'pvc';
  document.getElementById('worm_m').value = 2.0;
  document.getElementById('worm_z1').value = '1';
  document.getElementById('worm_z2').value = 50;
  document.getElementById('worm_q').value = 10;
  recalcAll();
}

document.querySelectorAll('input, select').forEach((el) => {
  el.addEventListener('input', recalcAll);
  el.addEventListener('change', recalcAll);
});

window.addEventListener('DOMContentLoaded', recalcAll);

