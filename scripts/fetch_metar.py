#!/usr/bin/env python3
import json, urllib.request, pathlib, datetime, glob, re
import sys
import os

# cleanup_duplicates fonksiyonunu import et
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from cleanup_duplicates import cleanup_duplicate_metars

ICAOS = ["LTFM", "LTFJ", "LTBA", "LTBU"]
URL   = "https://aviationweather.gov/api/data/metar?ids={}&format=json&hours=1&taf=true"
DATA  = pathlib.Path("data")
DATA.mkdir(exist_ok=True)

def parse_metar_time(metar_string, current_utc):
    """METAR/TAF kodundan UTC zaman bilgisini çıkarır"""
    # METAR formatı: ICAO DDHHmmZ şeklinde
    match = re.search(r'\b\d{6}Z\b', metar_string)
    if match:
        time_str = match.group()  # örn: "302320Z"
        day = int(time_str[:2])
        hour = int(time_str[2:4])
        minute = int(time_str[4:6])
        
        # Mevcut ayı kullan, ama günü METAR'dan al
        year = current_utc.year
        month = current_utc.month
        
        # Eğer bugün ayın başında ve METAR günü yüksekse (örn: 31), önceki aydan olabilir
        if current_utc.day <= 2 and day > 28:
            # Önceki aya git
            if month == 1:
                month = 12
                year -= 1
            else:
                month -= 1
        
        # Güvenli tarih oluşturma - geçersiz günleri kontrol et
        try:
            metar_date = datetime.datetime(year, month, day, hour, minute, tzinfo=datetime.timezone.utc)
            return metar_date.strftime("%Y-%m-%d %H:%M:%S")
            
        except ValueError:
            # Geçersiz gün durumunda önceki aya git
            if month == 1:
                month = 12
                year -= 1
            else:
                month -= 1
            
            try:
                # Ay değiştirdikten sonra tekrar dene
                metar_date = datetime.datetime(year, month, day, hour, minute, tzinfo=datetime.timezone.utc)
                return metar_date.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                # Hala geçersizse, mevcut zamanı kullan
                return current_utc.strftime("%Y-%m-%d %H:%M:%S")
    
    # Eğer parse edilemezse boş döndür
    return ""

# Zaman damgası
utc_now = datetime.datetime.now(datetime.timezone.utc)
stamp   = utc_now.strftime("%Y%m%d-%H%M")
iso_now = utc_now.isoformat().replace('+00:00', 'Z')

# 1) METAR ve TAF'ları çek
all_data = {}
for icao in ICAOS:
    try:
        with urllib.request.urlopen(URL.format(icao), timeout=12) as r:
            res = json.load(r)
        
        metar_raw = "Veri bulunamadı"
        metar_obs_time = ""
        taf_raw = "Veri bulunamadı"
        taf_obs_time = ""

        if res:
            # En güncel veriyi al (mostRecent=1)
            latest_item = None
            for item in res:
                if item.get("mostRecent") == 1:
                    latest_item = item
                    break
            
            if latest_item:
                # METAR verisi
                metar_raw = latest_item.get("rawOb", "rawOb alanı yok")
                metar_obs_time = parse_metar_time(metar_raw, utc_now)
                if not metar_obs_time:
                    metar_obs_time = latest_item.get("reportTime", "")
                
                # TAF verisi (eğer varsa)
                if "rawTaf" in latest_item and latest_item["rawTaf"]:
                    taf_raw = latest_item["rawTaf"]
                    taf_obs_time = parse_metar_time(taf_raw, utc_now)
                    if not taf_obs_time:
                        taf_obs_time = latest_item.get("reportTime", "")
                
                print(f"✓ {icao}: METAR={metar_obs_time}, TAF={'Var' if taf_raw != 'Veri bulunamadı' else 'Yok'}")

    except Exception as e:
        metar_raw, metar_obs_time = f"Hata: {e}", ""
        taf_raw, taf_obs_time = f"Hata: {e}", ""
        print(f"✗ {icao}: Hata - {e}")

    all_data[icao] = {
        "icao":       icao,
        "metar":      metar_raw,
        "metar_obs_time": metar_obs_time,
        "taf":        taf_raw,
        "taf_obs_time": taf_obs_time,
        "fetched_at": iso_now
    }

# 2) Mevcut latest veriyi kontrol et - duplicate engelleme
should_create_new_file = True
latest_file = DATA / "metar_latest.json"

if latest_file.exists():
    try:
        latest_data = json.loads(latest_file.read_text())
        # İlk ICAO'nun metar_obs_time'ını karşılaştır
        first_icao = next(iter(all_data))
        latest_metar_obs_time = latest_data.get(first_icao, {}).get("metar_obs_time", "")
        current_metar_obs_time = all_data[first_icao]["metar_obs_time"]
        
        # TAF zamanını da kontrol et (eğer varsa)
        latest_taf_obs_time = latest_data.get(first_icao, {}).get("taf_obs_time", "")
        current_taf_obs_time = all_data[first_icao]["taf_obs_time"]

        if latest_metar_obs_time == current_metar_obs_time and latest_taf_obs_time == current_taf_obs_time:
            should_create_new_file = False
            print(f"ℹ Aynı METAR ({current_metar_obs_time}) ve TAF ({current_taf_obs_time}) gözlem zamanı mevcut, yeni dosya oluşturulmadı.")
    except Exception as e:
        print("⚠ Latest dosya kontrolünde hata:", e)

# 3) Yeni dosya oluştur (sadece farklı veri varsa)
if should_create_new_file:
    outfile = DATA / f"metar-{stamp}.json"
    outfile.write_text(json.dumps(all_data, indent=2, ensure_ascii=False))
    print("✓", outfile.name, "yazıldı")
else:
    print("⏭ Duplicate veri, dosya oluşturulmadı")

# 4) latest kopyası (her zaman güncelle)
(DATA / "metar_latest.json").write_text(json.dumps(all_data, indent=2, ensure_ascii=False))

# 5) index dosyasını güncelle (sadece yeni dosya oluşturulduysa)
if should_create_new_file:
    index_path = DATA / "metar_index.json"
    files = sorted(glob.glob("data/metar-*.json"), reverse=True)
    index = []

    for f in files:
        payload = json.loads(pathlib.Path(f).read_text())
        # İlk ICAO'nun metar_obs_time'ını alıyoruz:
        first_icao = next(iter(payload))
        # Yeni format için uyumluluk
        if "metar_obs_time" in payload[first_icao]:
            obs_raw = payload[first_icao]["metar_obs_time"]
        else:
            obs_raw = payload[first_icao].get("obs_time", "")
        
        if obs_raw:
            # ISO'ya çevir:
            dt = datetime.datetime.strptime(obs_raw, "%Y-%m-%d %H:%M:%S")
            iso_obs = dt.isoformat() + "Z"
        else:
            iso_obs = utc_now.isoformat().replace('+00:00', 'Z')
            
        index.append({
            "file": pathlib.Path(f).name,
            "ts":   iso_obs
        })

    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False))
    print("✓ metar_index.json güncellendi")

print("✓ metar_latest.json güncellendi (METAR ve TAF içeriyor)")

# 6) Duplicate'leri temizle (her 5 dosyada bir)
files_count = len(glob.glob("data/metar-*.json"))
if files_count >= 5 and files_count % 5 == 1:  # 6, 11, 16, 21... dosyada cleanup yap
    print(f"\n🧹 {files_count} dosya mevcut, duplicate temizliği başlatılıyor...")
    cleanup_duplicate_metars()
