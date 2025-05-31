#!/usr/bin/env python3
import json, urllib.request, datetime

URL = "https://aviationweather.gov/api/data/metar?ids=LTFM&format=json&hours=1&taf=true"
utc_now = datetime.datetime.now(datetime.timezone.utc)
iso_now = utc_now.isoformat().replace('+00:00', 'Z')

print("Test başlıyor...")

try:
    with urllib.request.urlopen(URL, timeout=12) as r:
        res = json.load(r)
    
    print(f"API'den {len(res)} kayıt alındı")
    
    # En güncel veriyi bul
    latest = None
    for item in res:
        if item.get("mostRecent") == 1:
            latest = item
            break
    
    if latest:
        metar = latest.get("rawOb", "N/A")
        taf = latest.get("rawTaf", "N/A")
        
        data = {
            "LTFM": {
                "icao": "LTFM",
                "metar": metar,
                "metar_obs_time": latest.get("reportTime", ""),
                "taf": taf,
                "taf_obs_time": latest.get("reportTime", ""),
                "fetched_at": iso_now
            }
        }
        
        # Dosyaya yaz
        import pathlib
        pathlib.Path("data").mkdir(exist_ok=True)
        with open("data/test_metar.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print("✓ test_metar.json dosyası oluşturuldu")
        print(f"METAR: {metar[:50]}...")
        print(f"TAF:   {taf[:50]}...")
    else:
        print("En güncel veri bulunamadı")

except Exception as e:
    print(f"Hata: {e}")
