const MAX_LEVELS = 4;                    // 4 dropdown
const SELECTOR_CONTAINER = document.getElementById("selectors");
const VIEWER = document.getElementById("viewer");

let paths = [];                          // ["LTBA/1_APP/...pdf", ...]
let selections = Array(MAX_LEVELS).fill(null);
let selects = [];

// PDF iframe yüklendiğinde çalışacak fonksiyon
VIEWER.addEventListener('load', function() {
  adjustIframeSize();
});

// Ekran boyutu değiştiğinde PDF boyutunu ayarla
window.addEventListener('resize', adjustIframeSize);

// PDF boyutunu ayarlayan fonksiyon
function adjustIframeSize() {
  if (VIEWER.src) {
    // Mobil cihazlarda özel ayarlar
    if (window.innerWidth <= 850) {
      // PDF boyutlarını tam ekran genişliğine ayarla
      VIEWER.style.width = '100vw';
      VIEWER.style.height = `${window.innerHeight - 180}px`;
      VIEWER.style.minHeight = '500px';
      
      // PDF içeriğini iframe'e sığdırmak için URL parametrelerini güncelle
      if (VIEWER.src && !VIEWER.src.includes('zoom=page-width')) {
        const currentSrc = VIEWER.src;
        const separator = currentSrc.includes('#') ? '&' : '#';
        VIEWER.src = currentSrc.replace('#view=FitH&toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit', 
                                        '#view=FitH&toolbar=0&navpanes=0&scrollbar=0&zoom=page-width');
      }
      
      // PDF'i tam boyuta ayarlayacak mesajı gönder
      setTimeout(() => {
        try {
          VIEWER.contentWindow.postMessage({ type: 'fit-to-page' }, '*');
          VIEWER.contentWindow.postMessage({ type: 'fit-to-width' }, '*');
        } catch(e) {
          // Cross-origin hatalarını görmezden gel
        }
      }, 100);
    } else {
      // Desktop için normal boyutlar
      VIEWER.style.width = '800px';
      VIEWER.style.height = '1131px';
    }
  }
}

// ---------- Başlat ----------
fetch("pdf_paths.json")
  .then(r => r.json())
  .then(data => {
    paths = data;
    createSelectBoxes();
    populateOptions(0);                  // ilk menü dolu gelsin
  });

// ---------- UI Kur ----------
function createSelectBoxes(){
  for(let lvl=0; lvl<MAX_LEVELS; lvl++){
    const sel = document.createElement("select");
    sel.setAttribute("level", lvl);
    sel.innerHTML = `<option selected disabled>${getLabel(lvl)}</option>`;
    sel.addEventListener("change", handleChange);
    SELECTOR_CONTAINER.appendChild(sel);
    selects.push(sel);
  }
}

// ---------- Etkileşim ----------
function handleChange(e){
  const level = +e.target.getAttribute("level");
  selections[level] = e.target.value;

  // Sonraki seviyeleri resetle
  for(let i=level+1; i<MAX_LEVELS; i++){
    selections[i] = null;
    selects[i].innerHTML = `<option selected disabled>${getLabel(i)}</option>`;
  }

  const maybePath = selections.filter(Boolean).join("/");
  if(paths.includes(maybePath)){
    VIEWER.src = `Charts/${maybePath}#view=FitH&toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit`;
    return;
  }

  if(level+1 < MAX_LEVELS) populateOptions(level+1);
}

// ---------- Opsiyon Üret ----------
function populateOptions(level){
  const opts = Array.from(new Set(
    paths
      .filter(p => {
        const parts = p.split("/");
        if(parts.length <= level) return false;
        return selections.slice(0, level)
                         .every((sel,i)=>parts[i]===sel);
      })
      .map(p => p.split("/")[level])
  )).sort();

  selects[level].innerHTML =
    `<option selected disabled>${getLabel(level)}</option>` +
    opts.map(o=>`<option value="${o}">${o}</option>`).join("");
}

// ---------- Etiket ----------
function getLabel(lvl){
  return ["Meydan","Prosedür","Alt Seviye","Chart"][lvl] + " Seçiniz";
}

// METAR kod çözücü fonksiyonu
function decodeMetar(metarString) {
  if (!metarString || metarString === "Veri bulunamadı") return "Çözümlenemedi";
  
  try {
    const parts = metarString.split(' ');
    let decoded = [];
    
    // Zaman
    const timeMatch = metarString.match(/(\d{6})Z/);
    if (timeMatch) {
      const timeStr = timeMatch[1];
      const day = timeStr.substring(0, 2);
      const hour = timeStr.substring(2, 4);
      const minute = timeStr.substring(4, 6);
      decoded.push(`<div class="decoded-line"><span class="label-bold">Gözlem Zamanı:</span> ${day}. gün ${hour}:${minute} UTC</div>`);
    }
    
    // Rüzgar
    const windMatch = metarString.match(/(\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS)/);
    if (windMatch) {
      const direction = windMatch[1];
      const speed = windMatch[2];
      const gust = windMatch[3] ? ` (${windMatch[3].substring(1)} rüzgar artışı)` : '';
      const unit = windMatch[4] === 'KT' ? 'knot' : 'm/s';
      decoded.push(`<div class="decoded-line"><span class="label-bold">Rüzgar:</span> ${direction}° yönünden ${speed} ${unit}${gust}</div>`);
    } else if (metarString.includes('00000KT')) {
      decoded.push(`<div class="decoded-line"><span class="label-bold">Rüzgar:</span> Sakin</div>`);
    }
    
    // Pist rüzgar bilgileri (RMK RWY formatı)
    const runwayWindMatches = metarString.match(/RWY(\w+)\s+(\d{3})(\d{2,3})(G\d{2,3})?KT/g);
    if (runwayWindMatches) {
      runwayWindMatches.forEach(match => {
        const parts = match.match(/RWY(\w+)\s+(\d{3})(\d{2,3})(G\d{2,3})?KT/);
        if (parts) {
          const runway = parts[1];
          const direction = parts[2];
          const speed = parts[3];
          const gust = parts[4] ? ` (${parts[4].substring(1)} artış)` : '';
          decoded.push(`<div class="decoded-line"><span class="runway-bold">${runway}:</span> ${direction}°/${speed}kt${gust}</div>`);
        }
      });
    }
    
    // Görüş mesafesi ve CAVOK
    if (metarString.includes('CAVOK')) {
      decoded.push(`<div class="decoded-line"><span class="label-bold">Hava Durumu:</span> CAVOK (Açık, 10km+ görüş)</div>`);
    } else {
      const visMatch = metarString.match(/(\d{4})\s/);
      if (visMatch) {
        const vis = parseInt(visMatch[1]);
        if (vis >= 9999) {
          decoded.push(`<div class="decoded-line"><span class="label-bold">Görüş:</span> 10km üzeri</div>`);
        } else {
          decoded.push(`<div class="decoded-line"><span class="label-bold">Görüş:</span> ${vis}m</div>`);
        }
      }
    }
    
    // Hava durumu
    const weatherCodes = {
      'RA': 'yağmur', 'SN': 'kar', 'FG': 'sis', 'BR': 'hafif sis',
      'DZ': 'çiseleme', 'SH': 'sağanak', 'TS': 'gök gürültüsü',
      'FZ': 'dondurucu', 'BL': 'savrulan', 'MI': 'sığ'
    };
    
    for (const [code, desc] of Object.entries(weatherCodes)) {
      if (metarString.includes(code)) {
        decoded.push(`<div class="decoded-line"><span class="label-bold">Hava Durumu:</span> ${desc}</div>`);
        break;
      }
    }
    
    // Bulutlar
    const cloudMatch = metarString.match(/(SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})?/g);
    if (cloudMatch) {
      const cloudTypes = {
        'SKC': 'Açık', 'CLR': 'Açık', 'FEW': 'Az bulutlu',
        'SCT': 'Parçalı bulutlu', 'BKN': 'Çok bulutlu', 'OVC': 'Kapalı'
      };
      
      cloudMatch.forEach(cloud => {
        const type = cloud.substring(0, 3);
        const height = cloud.substring(3);
        if (height) {
          const heightFt = parseInt(height) * 100;
          decoded.push(`<div class="decoded-line"><span class="label-bold">Bulut:</span> ${cloudTypes[type]} ${heightFt}ft</div>`);
        } else {
          decoded.push(`<div class="decoded-line"><span class="label-bold">Bulut:</span> ${cloudTypes[type]}</div>`);
        }
      });
    }
    
    // Sıcaklık ve çiy noktası
    const tempMatch = metarString.match(/(M?\d{2})\/(M?\d{2})/);
    if (tempMatch) {
      let temp = tempMatch[1].replace('M', '-');
      let dewpoint = tempMatch[2].replace('M', '-');
      decoded.push(`<div class="decoded-line"><span class="label-bold">Sıcaklık:</span> ${temp}°C</div>`);
      decoded.push(`<div class="decoded-line"><span class="label-bold">Çiy Noktası:</span> ${dewpoint}°C</div>`);
    }
    
    // Basınç
    const pressureMatch = metarString.match(/Q(\d{4})|A(\d{4})/);
    if (pressureMatch) {
      if (pressureMatch[1]) {
        decoded.push(`<div class="decoded-line"><span class="label-bold">Basınç:</span> ${pressureMatch[1]} hPa</div>`);
      } else if (pressureMatch[2]) {
        const inHg = (parseInt(pressureMatch[2]) / 100).toFixed(2);
        decoded.push(`<div class="decoded-line"><span class="label-bold">Basınç:</span> ${inHg} inHg</div>`);
      }
    }
    
    return decoded.length > 0 ? decoded.join('') : '<div class="decoded-line">METAR çözümlemesi tamamlanamadı</div>';
  } catch (error) {
    return '<div class="decoded-line">METAR çözümleme hatası</div>';
  }
}

// TAF kod çözücü fonksiyonu
function decodeTaf(tafString) {
  if (!tafString || tafString === "Veri bulunamadı") {
    return '<div class="decoded-line">TAF verisi bulunamadı</div>';
  }
  
  try {
    let decoded = [];
    
    // Yayın zamanı
    const issueMatch = tafString.match(/(\d{6})Z/);
    if (issueMatch) {
      const timeStr = issueMatch[1];
      const day = timeStr.substring(0, 2);
      const hour = timeStr.substring(2, 4);
      const minute = timeStr.substring(4, 6);
      decoded.push(`<div class="decoded-line"><span class="label-bold">Yayın Zamanı:</span> ${day}. gün ${hour}:${minute} UTC</div>`);
    }
    
    // Geçerlilik süresi
    const validMatch = tafString.match(/(\d{4})\/(\d{4})/);
    if (validMatch) {
      const fromDay = validMatch[1].substring(0, 2);
      const fromHour = validMatch[1].substring(2, 4);
      const toDay = validMatch[2].substring(0, 2);
      const toHour = validMatch[2].substring(2, 4);
      decoded.push(`<div class="decoded-line"><span class="label-bold">Geçerlilik:</span> ${fromDay}.gün ${fromHour}:00 - ${toDay}.gün ${toHour}:00 UTC</div>`);
    }
    
    // TAF'ı zaman periyotlarına böl
    const sections = tafString.split(/(?=BECMG|TEMPO|PROB\d{2}|FM\d{4})/);
    
    sections.forEach((section, index) => {
      if (index === 0) {
        // Ana tahmin bölümü
        decoded.push(`<div class="decoded-line"><span class="label-bold">📍 Ana Tahmin:</span></div>`);
        decodeMainForecast(section, decoded);
      } else {
        // Değişim bölümleri
        decodeChangeGroup(section.trim(), decoded);
      }
    });
    
    return decoded.length > 0 ? decoded.join('') : '<div class="decoded-line">TAF çözümlemesi tamamlanamadı</div>';
  } catch (error) {
    return '<div class="decoded-line">TAF çözümleme hatası</div>';
  }
}

// Ana tahmin bölümünü çözümle
function decodeMainForecast(section, decoded) {
  // Ana rüzgar tahmini
  const windMatch = section.match(/(\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS)/);
  if (windMatch) {
    const direction = windMatch[1];
    const speed = windMatch[2];
    const gust = windMatch[3] ? ` (${windMatch[3].substring(1)} rüzgar artışı)` : '';
    const unit = windMatch[4] === 'KT' ? 'knot' : 'm/s';
    decoded.push(`<div class="decoded-line"><span class="label-bold">Rüzgar:</span> ${direction}° yönünden ${speed} ${unit}${gust}</div>`);
  }
  
  // Ana görüş mesafesi
  if (section.includes('CAVOK')) {
    decoded.push(`<div class="decoded-line"><span class="label-bold">Görüş:</span> CAVOK (10km+ ve mükemmel şartlar)</div>`);
  } else if (section.includes('9999')) {
    decoded.push(`<div class="decoded-line"><span class="label-bold">Görüş:</span> 10km üzeri</div>`);
  } else {
    const visMatch = section.match(/\s(\d{4})\s/);
    if (visMatch) {
      const visibility = parseInt(visMatch[1]);
      if (visibility < 1000) {
        decoded.push(`<div class="decoded-line"><span class="label-bold">Görüş:</span> ${visibility}m</div>`);
      } else {
        decoded.push(`<div class="decoded-line"><span class="label-bold">Görüş:</span> ${(visibility/1000).toFixed(1)}km</div>`);
      }
    }
  }
  
  // Ana bulut durumu
  if (!section.includes('CAVOK')) {
    const cloudTypes = {
      'SKC': 'Açık', 'CLR': 'Açık', 'FEW': 'Az bulutlu',
      'SCT': 'Parçalı bulutlu', 'BKN': 'Çok bulutlu', 'OVC': 'Kapalı'
    };
    
    const cloudMatches = section.match(/(SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})?(CB|TCU)?/g);
    if (cloudMatches) {
      cloudMatches.forEach(match => {
        const typeMatch = match.match(/^(SKC|CLR|FEW|SCT|BKN|OVC)/);
        const heightMatch = match.match(/(\d{3})/);
        const cloudType = match.includes('CB') ? ' (Cumulonimbus)' : match.includes('TCU') ? ' (Towering Cu)' : '';
        
        if (typeMatch) {
          const type = cloudTypes[typeMatch[1]];
          if (heightMatch) {
            const heightFt = parseInt(heightMatch[1]) * 100;
            decoded.push(`<div class="decoded-line"><span class="label-bold">Bulut:</span> ${type} ${heightFt}ft${cloudType}</div>`);
          } else {
            decoded.push(`<div class="decoded-line"><span class="label-bold">Bulut:</span> ${type}${cloudType}</div>`);
          }
        }
      });
    }
  }
  
  // Ana hava durumu
  decodeWeather(section, decoded, 'Hava Durumu');
}

// Değişim gruplarını çözümle
function decodeChangeGroup(section, decoded) {
  let groupTitle = '';
  let timeInfo = '';
  
  if (section.startsWith('BECMG')) {
    groupTitle = '📈 Kademeli Değişim';
    const timeMatch = section.match(/BECMG\s+(\d{4})\/(\d{4})/);
    if (timeMatch) {
      const fromDay = timeMatch[1].substring(0, 2);
      const fromHour = timeMatch[1].substring(2, 4);
      const toDay = timeMatch[2].substring(0, 2);
      const toHour = timeMatch[2].substring(2, 4);
      timeInfo = ` (${fromDay}.gün ${fromHour}:00 - ${toDay}.gün ${toHour}:00)`;
    }
  } else if (section.startsWith('TEMPO')) {
    groupTitle = '⚠️ Geçici Değişim';
    const timeMatch = section.match(/TEMPO\s+(\d{4})\/(\d{4})/);
    if (timeMatch) {
      const fromDay = timeMatch[1].substring(0, 2);
      const fromHour = timeMatch[1].substring(2, 4);
      const toDay = timeMatch[2].substring(0, 2);
      const toHour = timeMatch[2].substring(2, 4);
      timeInfo = ` (${fromDay}.gün ${fromHour}:00 - ${toDay}.gün ${toHour}:00)`;
    }
  } else if (section.match(/PROB\d{2}/)) {
    const probMatch = section.match(/PROB(\d{2})/);
    const prob = probMatch ? probMatch[1] : '30';
    groupTitle = `🎯 %${prob} Olasılıklı`;
    const timeMatch = section.match(/PROB\d{2}\s+(\d{4})\/(\d{4})/);
    if (timeMatch) {
      const fromDay = timeMatch[1].substring(0, 2);
      const fromHour = timeMatch[1].substring(2, 4);
      const toDay = timeMatch[2].substring(0, 2);
      const toHour = timeMatch[2].substring(2, 4);
      timeInfo = ` (${fromDay}.gün ${fromHour}:00 - ${toDay}.gün ${toHour}:00)`;
    }
  }
  
  decoded.push(`<div class="decoded-line"><span class="label-bold">${groupTitle}:</span>${timeInfo}</div>`);
  
  // Bu bölümdeki rüzgar değişimi
  const windMatch = section.match(/(\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS)/);
  if (windMatch) {
    const direction = windMatch[1];
    const speed = windMatch[2];
    const gust = windMatch[3] ? ` (${windMatch[3].substring(1)} rüzgar artışı)` : '';
    const unit = windMatch[4] === 'KT' ? 'knot' : 'm/s';
    decoded.push(`<div class="decoded-line">  • <span class="label-bold">Rüzgar:</span> ${direction}° yönünden ${speed} ${unit}${gust}</div>`);
  }
  
  // Görüş değişimi
  const visMatch = section.match(/\s(\d{4})\s/);
  if (visMatch && visMatch[1] !== '9999') {
    const visibility = parseInt(visMatch[1]);
    if (visibility < 1000) {
      decoded.push(`<div class="decoded-line">  • <span class="label-bold">Görüş:</span> ${visibility}m</div>`);
    } else {
      decoded.push(`<div class="decoded-line">  • <span class="label-bold">Görüş:</span> ${(visibility/1000).toFixed(1)}km</div>`);
    }
  }
  
  // Bulut değişimi
  const cloudTypes = {
    'SKC': 'Açık', 'CLR': 'Açık', 'FEW': 'Az bulutlu',
    'SCT': 'Parçalı bulutlu', 'BKN': 'Çok bulutlu', 'OVC': 'Kapalı'
  };
  
  const cloudMatches = section.match(/(SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})?(CB|TCU)?/g);
  if (cloudMatches) {
    cloudMatches.forEach(match => {
      const typeMatch = match.match(/^(SKC|CLR|FEW|SCT|BKN|OVC)/);
      const heightMatch = match.match(/(\d{3})/);
      const cloudType = match.includes('CB') ? ' (Cumulonimbus)' : match.includes('TCU') ? ' (Towering Cu)' : '';
      
      if (typeMatch) {
        const type = cloudTypes[typeMatch[1]];
        if (heightMatch) {
          const heightFt = parseInt(heightMatch[1]) * 100;
          decoded.push(`<div class="decoded-line">  • <span class="label-bold">Bulut:</span> ${type} ${heightFt}ft${cloudType}</div>`);
        } else {
          decoded.push(`<div class="decoded-line">  • <span class="label-bold">Bulut:</span> ${type}${cloudType}</div>`);
        }
      }
    });
  }
  
  // Hava durumu değişimi
  decodeWeather(section, decoded, 'Hava Durumu', '  • ');
}

// Hava durumu çözümlemesi
function decodeWeather(section, decoded, label, prefix = '') {
  const weatherCodes = {
    'TSRA': 'gök gürültülü yağmur', 'SHRA': 'sağanak yağmur', 'RA': 'yağmur', 
    'SN': 'kar', 'FG': 'sis', 'BCFG': 'yamalar halinde sis', 'BR': 'hafif sis',
    'DZ': 'çiseleme', 'SH': 'sağanak', 'TS': 'gök gürültüsü',
    'FZ': 'dondurucu', 'BL': 'savrulan', 'MI': 'sığ'
  };
  
  let weatherFound = false;
  for (const [code, desc] of Object.entries(weatherCodes)) {
    if (section.includes(code)) {
      const intensity = section.includes('-' + code) ? 'hafif ' : section.includes('+' + code) ? 'şiddetli ' : '';
      if (!weatherFound) {
        decoded.push(`<div class="decoded-line">${prefix}<span class="label-bold">${label}:</span> ${intensity}${desc}</div>`);
        weatherFound = true;
        break;
      }
    }
  }
}

// İngilizce METAR kod çözücü fonksiyonu
function decodeMetarEN(metarString) {
  if (!metarString || metarString === "Veri bulunamadı") return "No data available";
  
  try {
    const parts = metarString.split(' ');
    let decoded = [];
    
    // Time
    const timeMatch = metarString.match(/(\d{6})Z/);
    if (timeMatch) {
      const timeStr = timeMatch[1];
      const day = timeStr.substring(0, 2);
      const hour = timeStr.substring(2, 4);
      const minute = timeStr.substring(4, 6);
      decoded.push(`<div class="decoded-line"><span class="label-bold">Observation Time:</span> Day ${day} ${hour}:${minute} UTC</div>`);
    }
    
    // Wind
    const windMatch = metarString.match(/(\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS)/);
    if (windMatch) {
      const direction = windMatch[1];
      const speed = windMatch[2];
      const gust = windMatch[3] ? ` (gusts ${windMatch[3].substring(1)})` : '';
      const unit = windMatch[4] === 'KT' ? 'knots' : 'm/s';
      decoded.push(`<div class="decoded-line"><span class="label-bold">Wind:</span> ${direction}° at ${speed} ${unit}${gust}</div>`);
    } else if (metarString.includes('00000KT')) {
      decoded.push(`<div class="decoded-line"><span class="label-bold">Wind:</span> Calm</div>`);
    }
    
    // Runway wind information (RMK RWY format)
    const runwayWindMatches = metarString.match(/RWY(\w+)\s+(\d{3})(\d{2,3})(G\d{2,3})?KT/g);
    if (runwayWindMatches) {
      runwayWindMatches.forEach(match => {
        const parts = match.match(/RWY(\w+)\s+(\d{3})(\d{2,3})(G\d{2,3})?KT/);
        if (parts) {
          const runway = parts[1];
          const direction = parts[2];
          const speed = parts[3];
          const gust = parts[4] ? ` (G${parts[4].substring(1)})` : '';
          decoded.push(`<div class="decoded-line"><span class="runway-bold">${runway}:</span> ${direction}°/${speed}kt${gust}</div>`);
        }
      });
    }
    
    // Visibility and CAVOK
    if (metarString.includes('CAVOK')) {
      decoded.push(`<div class="decoded-line"><span class="label-bold">Weather:</span> CAVOK (Clear, visibility 10km+)</div>`);
    } else {
      const visMatch = metarString.match(/(\d{4})\s/);
      if (visMatch) {
        const vis = parseInt(visMatch[1]);
        if (vis >= 9999) {
          decoded.push(`<div class="decoded-line"><span class="label-bold">Visibility:</span> 10km or more</div>`);
        } else {
          decoded.push(`<div class="decoded-line"><span class="label-bold">Visibility:</span> ${vis}m</div>`);
        }
      }
    }
    
    // Weather phenomena
    const weatherCodes = {
      'RA': 'rain', 'SN': 'snow', 'FG': 'fog', 'BR': 'mist',
      'DZ': 'drizzle', 'SH': 'showers', 'TS': 'thunderstorm',
      'FZ': 'freezing', 'BL': 'blowing', 'MI': 'shallow'
    };
    
    for (const [code, desc] of Object.entries(weatherCodes)) {
      if (metarString.includes(code)) {
        decoded.push(`<div class="decoded-line"><span class="label-bold">Weather:</span> ${desc}</div>`);
        break;
      }
    }
    
    // Clouds
    const cloudMatch = metarString.match(/(SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})?/g);
    if (cloudMatch) {
      const cloudTypes = {
        'SKC': 'Clear', 'CLR': 'Clear', 'FEW': 'Few clouds',
        'SCT': 'Scattered', 'BKN': 'Broken', 'OVC': 'Overcast'
      };
      
      cloudMatch.forEach(cloud => {
        const type = cloud.substring(0, 3);
        const height = cloud.substring(3);
        if (height) {
          const heightFt = parseInt(height) * 100;
          decoded.push(`<div class="decoded-line"><span class="label-bold">Clouds:</span> ${cloudTypes[type]} ${heightFt}ft</div>`);
        } else {
          decoded.push(`<div class="decoded-line"><span class="label-bold">Clouds:</span> ${cloudTypes[type]}</div>`);
        }
      });
    }
    
    // Temperature and dewpoint
    const tempMatch = metarString.match(/(M?\d{2})\/(M?\d{2})/);
    if (tempMatch) {
      let temp = tempMatch[1].replace('M', '-');
      let dewpoint = tempMatch[2].replace('M', '-');
      decoded.push(`<div class="decoded-line"><span class="label-bold">Temperature:</span> ${temp}°C</div>`);
      decoded.push(`<div class="decoded-line"><span class="label-bold">Dewpoint:</span> ${dewpoint}°C</div>`);
    }
    
    // Pressure
    const pressureMatch = metarString.match(/Q(\d{4})|A(\d{4})/);
    if (pressureMatch) {
      if (pressureMatch[1]) {
        decoded.push(`<div class="decoded-line"><span class="label-bold">Pressure:</span> ${pressureMatch[1]} hPa</div>`);
      } else if (pressureMatch[2]) {
        const inHg = (parseInt(pressureMatch[2]) / 100).toFixed(2);
        decoded.push(`<div class="decoded-line"><span class="label-bold">Pressure:</span> ${inHg} inHg</div>`);
      }
    }
    
    return decoded.length > 0 ? decoded.join('') : '<div class="decoded-line">METAR decoding incomplete</div>';
  } catch (error) {
    return '<div class="decoded-line">METAR decoding error</div>';
  }
}

// İngilizce TAF kod çözücü fonksiyonu
function decodeTafEN(tafString) {
  if (!tafString || tafString === "Veri bulunamadı") {
    return '<div class="decoded-line">TAF data not available</div>';
  }
  
  try {
    let decoded = [];
    
    // Issue time
    const issueMatch = tafString.match(/(\d{6})Z/);
    if (issueMatch) {
      const timeStr = issueMatch[1];
      const day = timeStr.substring(0, 2);
      const hour = timeStr.substring(2, 4);
      const minute = timeStr.substring(4, 6);
      decoded.push(`<div class="decoded-line"><span class="label-bold">Issue Time:</span> Day ${day} ${hour}:${minute} UTC</div>`);
    }
    
    // Valid period
    const validMatch = tafString.match(/(\d{4})\/(\d{4})/);
    if (validMatch) {
      const fromDay = validMatch[1].substring(0, 2);
      const fromHour = validMatch[1].substring(2, 4);
      const toDay = validMatch[2].substring(0, 2);
      const toHour = validMatch[2].substring(2, 4);
      decoded.push(`<div class="decoded-line"><span class="label-bold">Valid:</span> Day ${fromDay} ${fromHour}:00 - Day ${toDay} ${toHour}:00 UTC</div>`);
    }
    
    // Split TAF into time periods
    const sections = tafString.split(/(?=BECMG|TEMPO|PROB\d{2}|FM\d{4})/);
    
    sections.forEach((section, index) => {
      if (index === 0) {
        // Main forecast section
        decoded.push(`<div class="decoded-line"><span class="label-bold">📍 Main Forecast:</span></div>`);
        decodeMainForecastEN(section, decoded);
      } else {
        // Change groups
        decodeChangeGroupEN(section.trim(), decoded);
      }
    });
    
    return decoded.length > 0 ? decoded.join('') : '<div class="decoded-line">TAF decoding incomplete</div>';
  } catch (error) {
    return '<div class="decoded-line">TAF decoding error</div>';
  }
}

// İngilizce ana tahmin bölümünü çözümle
function decodeMainForecastEN(section, decoded) {
  // Wind forecast
  const windMatch = section.match(/(\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS)/);
  if (windMatch) {
    const direction = windMatch[1];
    const speed = windMatch[2];
    const gust = windMatch[3] ? ` (gusts ${windMatch[3].substring(1)})` : '';
    const unit = windMatch[4] === 'KT' ? 'knots' : 'm/s';
    decoded.push(`<div class="decoded-line"><span class="label-bold">Wind:</span> ${direction}° at ${speed} ${unit}${gust}</div>`);
  }
  
  // Visibility
  if (section.includes('CAVOK')) {
    decoded.push(`<div class="decoded-line"><span class="label-bold">Visibility:</span> CAVOK (10km+ perfect conditions)</div>`);
  } else if (section.includes('9999')) {
    decoded.push(`<div class="decoded-line"><span class="label-bold">Visibility:</span> 10km or more</div>`);
  } else {
    const visMatch = section.match(/\s(\d{4})\s/);
    if (visMatch) {
      const visibility = parseInt(visMatch[1]);
      if (visibility < 1000) {
        decoded.push(`<div class="decoded-line"><span class="label-bold">Visibility:</span> ${visibility}m</div>`);
      } else {
        decoded.push(`<div class="decoded-line"><span class="label-bold">Visibility:</span> ${(visibility/1000).toFixed(1)}km</div>`);
      }
    }
  }
  
  // Cloud forecast
  if (!section.includes('CAVOK')) {
    const cloudTypes = {
      'SKC': 'Clear', 'CLR': 'Clear', 'FEW': 'Few clouds',
      'SCT': 'Scattered', 'BKN': 'Broken', 'OVC': 'Overcast'
    };
    
    const cloudMatches = section.match(/(SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})?(CB|TCU)?/g);
    if (cloudMatches) {
      cloudMatches.forEach(match => {
        const typeMatch = match.match(/^(SKC|CLR|FEW|SCT|BKN|OVC)/);
        const heightMatch = match.match(/(\d{3})/);
        const cloudType = match.includes('CB') ? ' (Cumulonimbus)' : match.includes('TCU') ? ' (Towering Cu)' : '';
        
        if (typeMatch) {
          const type = cloudTypes[typeMatch[1]];
          if (heightMatch) {
            const heightFt = parseInt(heightMatch[1]) * 100;
            decoded.push(`<div class="decoded-line"><span class="label-bold">Clouds:</span> ${type} ${heightFt}ft${cloudType}</div>`);
          } else {
            decoded.push(`<div class="decoded-line"><span class="label-bold">Clouds:</span> ${type}${cloudType}</div>`);
          }
        }
      });
    }
  }
  
  // Weather forecast
  decodeWeatherEN(section, decoded, 'Weather');
}

// İngilizce değişim gruplarını çözümle
function decodeChangeGroupEN(section, decoded) {
  let groupTitle = '';
  let timeInfo = '';
  
  if (section.startsWith('BECMG')) {
    groupTitle = '📈 Becoming';
    const timeMatch = section.match(/BECMG\s+(\d{4})\/(\d{4})/);
    if (timeMatch) {
      const fromDay = timeMatch[1].substring(0, 2);
      const fromHour = timeMatch[1].substring(2, 4);
      const toDay = timeMatch[2].substring(0, 2);
      const toHour = timeMatch[2].substring(2, 4);
      timeInfo = ` (Day ${fromDay} ${fromHour}:00 - Day ${toDay} ${toHour}:00)`;
    }
  } else if (section.startsWith('TEMPO')) {
    groupTitle = '⚠️ Temporary';
    const timeMatch = section.match(/TEMPO\s+(\d{4})\/(\d{4})/);
    if (timeMatch) {
      const fromDay = timeMatch[1].substring(0, 2);
      const fromHour = timeMatch[1].substring(2, 4);
      const toDay = timeMatch[2].substring(0, 2);
      const toHour = timeMatch[2].substring(2, 4);
      timeInfo = ` (Day ${fromDay} ${fromHour}:00 - Day ${toDay} ${toHour}:00)`;
    }
  } else if (section.match(/PROB\d{2}/)) {
    const probMatch = section.match(/PROB(\d{2})/);
    const prob = probMatch ? probMatch[1] : '30';
    groupTitle = `🎯 ${prob}% Probability`;
    const timeMatch = section.match(/PROB\d{2}\s+(\d{4})\/(\d{4})/);
    if (timeMatch) {
      const fromDay = timeMatch[1].substring(0, 2);
      const fromHour = timeMatch[1].substring(2, 4);
      const toDay = timeMatch[2].substring(0, 2);
      const toHour = timeMatch[2].substring(2, 4);
      timeInfo = ` (Day ${fromDay} ${fromHour}:00 - Day ${toDay} ${toHour}:00)`;
    }
  }
  
  decoded.push(`<div class="decoded-line"><span class="label-bold">${groupTitle}:</span>${timeInfo}</div>`);
  
  // Wind changes
  const windMatch = section.match(/(\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS)/);
  if (windMatch) {
    const direction = windMatch[1];
    const speed = windMatch[2];
    const gust = windMatch[3] ? ` (gusts ${windMatch[3].substring(1)})` : '';
    const unit = windMatch[4] === 'KT' ? 'knots' : 'm/s';
    decoded.push(`<div class="decoded-line">  • <span class="label-bold">Wind:</span> ${direction}° at ${speed} ${unit}${gust}</div>`);
  }
  
  // Visibility changes
  const visMatch = section.match(/\s(\d{4})\s/);
  if (visMatch && visMatch[1] !== '9999') {
    const visibility = parseInt(visMatch[1]);
    if (visibility < 1000) {
      decoded.push(`<div class="decoded-line">  • <span class="label-bold">Visibility:</span> ${visibility}m</div>`);
    } else {
      decoded.push(`<div class="decoded-line">  • <span class="label-bold">Visibility:</span> ${(visibility/1000).toFixed(1)}km</div>`);
    }
  }
  
  // Cloud changes
  const cloudTypes = {
    'SKC': 'Clear', 'CLR': 'Clear', 'FEW': 'Few clouds',
    'SCT': 'Scattered', 'BKN': 'Broken', 'OVC': 'Overcast'
  };
  
  const cloudMatches = section.match(/(SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})?(CB|TCU)?/g);
  if (cloudMatches) {
    cloudMatches.forEach(match => {
      const typeMatch = match.match(/^(SKC|CLR|FEW|SCT|BKN|OVC)/);
      const heightMatch = match.match(/(\d{3})/);
      const cloudType = match.includes('CB') ? ' (Cumulonimbus)' : match.includes('TCU') ? ' (Towering Cu)' : '';
      
      if (typeMatch) {
        const type = cloudTypes[typeMatch[1]];
        if (heightMatch) {
          const heightFt = parseInt(heightMatch[1]) * 100;
          decoded.push(`<div class="decoded-line">  • <span class="label-bold">Clouds:</span> ${type} ${heightFt}ft${cloudType}</div>`);
        } else {
          decoded.push(`<div class="decoded-line">  • <span class="label-bold">Clouds:</span> ${type}${cloudType}</div>`);
        }
      }
    });
  }
  
  // Weather changes
  decodeWeatherEN(section, decoded, 'Weather', '  • ');
}

// İngilizce hava durumu çözümlemesi
function decodeWeatherEN(section, decoded, label, prefix = '') {
  const weatherCodes = {
    'TSRA': 'thunderstorm with rain', 'SHRA': 'showers', 'RA': 'rain', 
    'SN': 'snow', 'FG': 'fog', 'BCFG': 'patches of fog', 'BR': 'mist',
    'DZ': 'drizzle', 'SH': 'showers', 'TS': 'thunderstorm',
    'FZ': 'freezing', 'BL': 'blowing', 'MI': 'shallow'
  };
  
  let weatherFound = false;
  for (const [code, desc] of Object.entries(weatherCodes)) {
    if (section.includes(code)) {
      const intensity = section.includes('-' + code) ? 'light ' : section.includes('+' + code) ? 'heavy ' : '';
      if (!weatherFound) {
        decoded.push(`<div class="decoded-line">${prefix}<span class="label-bold">${label}:</span> ${intensity}${desc}</div>`);
        weatherFound = true;
        break;
      }
    }
  }
}
