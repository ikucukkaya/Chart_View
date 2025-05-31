// Test dosyası - METAR çözümleyici test et
function decodeMetar(metarString) {
  try {
    const parts = metarString.split(' ');
    let decoded = [];
    
    // ICAO kodu
    if (parts[0] && parts[0].match(/^[A-Z]{4}$/)) {
      decoded.push(`Havaalanı: ${parts[0]}`);
    }
    
    // Zaman
    const timeMatch = metarString.match(/(\d{6})Z/);
    if (timeMatch) {
      const timeStr = timeMatch[1];
      const day = timeStr.substring(0, 2);
      const hour = timeStr.substring(2, 4);
      const minute = timeStr.substring(4, 6);
      decoded.push(`Gözlem zamanı: ${day}. gün ${hour}:${minute} UTC`);
    }
    
    // Rüzgar
    const windMatch = metarString.match(/(\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS)/);
    if (windMatch) {
      const direction = windMatch[1];
      const speed = windMatch[2];
      const gust = windMatch[3] ? ` (${windMatch[3].substring(1)} rüzgar artışı)` : '';
      const unit = windMatch[4] === 'KT' ? 'knot' : 'm/s';
      decoded.push(`Rüzgar: ${direction}° yönünden ${speed} ${unit}${gust}`);
    } else if (metarString.includes('00000KT')) {
      decoded.push('Rüzgar: Sakin');
    }
    
    // Pist rüzgar bilgileri (RMK RWY formatı)
    const runwayWindMatches = metarString.match(/RWY(\w+)\s+(\d{3})(\d{2,3})(G\d{2,3})?KT/g);
    if (runwayWindMatches) {
      const runwayWinds = [];
      runwayWindMatches.forEach(match => {
        const parts = match.match(/RWY(\w+)\s+(\d{3})(\d{2,3})(G\d{2,3})?KT/);
        if (parts) {
          const runway = parts[1];
          const direction = parts[2];
          const speed = parts[3];
          const gust = parts[4] ? ` (${parts[4].substring(1)} artış)` : '';
          runwayWinds.push(`${runway}: ${direction}°/${speed}kt${gust}`);
        }
      });
      if (runwayWinds.length > 0) {
        decoded.push(`Pist rüzgarları: ${runwayWinds.join(', ')}`);
      }
    }
    
    // Görüş mesafesi ve CAVOK
    if (metarString.includes('CAVOK')) {
      decoded.push('Hava durumu: CAVOK (Açık ve mükemmel görünürlük, 10km+ görüş)');
    } else {
      const visMatch = metarString.match(/(\d{4})\s/);
      if (visMatch) {
        const vis = parseInt(visMatch[1]);
        if (vis >= 9999) {
          decoded.push('Görüş: 10km üzeri');
        } else {
          decoded.push(`Görüş: ${vis}m`);
        }
      }
    }
    
    // Sıcaklık ve çiy noktası
    const tempMatch = metarString.match(/(M?\d{2})\/(M?\d{2})/);
    if (tempMatch) {
      let temp = tempMatch[1].replace('M', '-');
      let dewpoint = tempMatch[2].replace('M', '-');
      decoded.push(`Sıcaklık: ${temp}°C, Çiy noktası: ${dewpoint}°C`);
    }
    
    // Basınç
    const pressureMatch = metarString.match(/Q(\d{4})/);
    if (pressureMatch) {
      decoded.push(`Basınç: ${pressureMatch[1]} hPa`);
    }
    
    return decoded.length > 1 ? decoded.join(' • ') : 'METAR çözümlemesi tamamlanamadı';
  } catch (error) {
    return 'METAR çözümleme hatası';
  }
}

const testMetar = 'LTFM 312150Z 02007KT CAVOK 16/14 Q1018 NOSIG RMK RWY17L 01005KT RWY34L 36006KT RWY16R 36005KT RWY36 01007KT RWY18 01005KT';
console.log('Test METAR:', testMetar);
console.log('');
console.log('Çözümlenmiş:', decodeMetar(testMetar));
