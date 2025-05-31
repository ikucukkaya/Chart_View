#!/usr/bin/env python3
"""
Duplicate METAR dosyalarını temizleyen script
Aynı gözlem zamanına sahip dosyalardan en yenisini tutar, eskilerini siler.
"""
import json, pathlib, glob, datetime

DATA = pathlib.Path("data")

def cleanup_duplicate_metars():
    """Duplicate METAR dosyalarını temizler"""
    files = sorted(glob.glob("data/metar-*.json"))
    obs_times = {}  # obs_time -> [file_path, ...]
    
    print("🔍 METAR dosyaları taranıyor...")
    print(f"   Toplam {len(files)} dosya bulundu")
    
    # Tüm dosyaları tarayıp obs_time'larını grupla
    for f in files:
        try:
            payload = json.loads(pathlib.Path(f).read_text())
            first_icao = next(iter(payload))
            obs_time = payload[first_icao]["obs_time"]
            
            if obs_time not in obs_times:
                obs_times[obs_time] = []
            obs_times[obs_time].append(f)
            
        except Exception as e:
            print(f"⚠ {f} dosyası okunamadı: {e}")
    
    print(f"   {len(obs_times)} farklı gözlem zamanı bulundu")
    
    # Duplicate'leri bul ve temizle
    total_removed = 0
    duplicate_groups = [obs_time for obs_time, file_list in obs_times.items() if len(file_list) > 1]
    
    if not duplicate_groups:
        print("   🎉 Duplicate dosya bulunamadı!")
    else:
        print(f"   ⚠ {len(duplicate_groups)} gözlem zamanında duplicate dosyalar bulundu")
    
    for obs_time, file_list in obs_times.items():
        if len(file_list) > 1:
            # En yeni dosyayı tut (dosya adındaki timestamp'e göre)
            # metar-YYYYMMDD-HHMM.json formatından timestamp'i çıkar
            def get_file_timestamp(file_path):
                name = pathlib.Path(file_path).name
                # metar-20250530-2350.json -> 20250530-2350
                if name.startswith("metar-") and name.endswith(".json"):
                    timestamp_part = name[6:-5]  # "metar-" ve ".json" kısımlarını çıkar
                    try:
                        # 20250530-2350 -> 2025-05-30 23:50
                        date_part, time_part = timestamp_part.split("-")
                        year = date_part[:4]
                        month = date_part[4:6]
                        day = date_part[6:8]
                        hour = time_part[:2]
                        minute = time_part[2:4]
                        return datetime.datetime(int(year), int(month), int(day), int(hour), int(minute))
                    except:
                        pass
                return datetime.datetime.min
            
            newest_file = max(file_list, key=get_file_timestamp)
            
            print(f"\n📅 Gözlem zamanı: {obs_time}")
            print(f"   📝 {len(file_list)} duplicate dosya bulundu")
            print(f"   ✅ Tutulan dosya: {pathlib.Path(newest_file).name}")
            
            # Diğerlerini sil
            for old_file in file_list:
                if old_file != newest_file:
                    pathlib.Path(old_file).unlink()
                    print(f"   🗑️ Silindi: {pathlib.Path(old_file).name}")
                    total_removed += 1
    
    print(f"\n✅ Temizlik tamamlandı! {total_removed} duplicate dosya silindi.")
    
    # Index'i yeniden oluştur
    rebuild_index()

def rebuild_index():
    """METAR index'ini yeniden oluşturur"""
    print("\n🔄 Index yeniden oluşturuluyor...")
    
    index_path = DATA / "metar_index.json"
    files = sorted(glob.glob("data/metar-*.json"), reverse=True)
    index = []

    for f in files:
        try:
            payload = json.loads(pathlib.Path(f).read_text())
            first_icao = next(iter(payload))
            obs_raw = payload[first_icao]["obs_time"]
            dt = datetime.datetime.strptime(obs_raw, "%Y-%m-%d %H:%M:%S")
            iso_obs = dt.isoformat() + "Z"
            index.append({
                "file": pathlib.Path(f).name,
                "ts": iso_obs
            })
        except Exception as e:
            print(f"⚠ {f} index'e eklenemedi: {e}")

    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False))
    print(f"✅ Index güncellendi ({len(index)} dosya)")

if __name__ == "__main__":
    cleanup_duplicate_metars()
