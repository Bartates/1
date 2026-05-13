#!/bin/bash
# Android deploy: build(APK) -> cihaz kontrol -> adb install
# Kullanım: ./scripts/deploy-android.sh [dev|prod]

set -e

MODE=${1:-dev}

APP_ID="com.sobayonetim.app"

echo "🚀 Android deploy başlıyor — mode: $MODE"

echo "🔧 Build pipeline çalıştırılıyor..."
bash ./scripts/build-android.sh "$MODE"

echo "🔎 APK varlığı kontrol ediliyor..."

if [ "$MODE" = "prod" ]; then
  APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
else
  APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
fi

if [ ! -f "$APK_PATH" ]; then
  echo "❌ APK bulunamadı: $APK_PATH"
  exit 1
fi

echo "✅ APK hazır: $APK_PATH"

echo "📱 ADB ile cihaz kontrol ediliyor..."

# adb olmadığı durumda açıkça hata veriyoruz
if ! command -v adb >/dev/null 2>&1; then
  echo "❌ adb bulunamadı. PATH'i kontrol edin ve Android Platform Tools kurulu olsun."
  exit 1
fi

# Timeoutlu cihaz bekleme (10sn)
ADB_TIMEOUT=10
while true; do
  # state: device | unauthorized | offline
  state=$(adb get-state 2>/dev/null || echo "unknown")
  if [ "$state" = "device" ]; then
    break
  fi

  # unauthorized/offline -> yine de devam etmeyelim
  if [ "$state" != "unknown" ] && [ "$state" != "device" ]; then
    echo "❌ ADB state: $state (cihaz hazır değil). USB debugging ve izinleri kontrol edin."
    exit 1
  fi

  ADB_TIMEOUT=$((ADB_TIMEOUT-1))
  if [ "$ADB_TIMEOUT" -le 0 ]; then
    echo "❌ ADB ile bağlı cihaz bulunamadı (adb get-state: $state)."
    adb devices || true
    exit 1
  fi

  echo "⏳ Cihaz bekleniyor..."
  sleep 1
done

echo "✅ Cihaz bağlı: $(adb get-serialno 2>/dev/null || echo "(serial bilinmiyor)")"

echo "⬆️ APK cihaz'a yükleniyor (adb install -r)..."

# -r: replace mevcut uygulamayı güncelle
adb install -r "$APK_PATH"

echo "✅ Kurulum tamamlandı. Uygulama başlatılıyor..."

# Bazı telefonlarda start direkt çalışmayabilir; hatayı yutuyoruz.
adb shell am start -n "$APP_ID/.MainActivity" >/dev/null 2>&1 || true

echo "🎉 Deploy bitti."

