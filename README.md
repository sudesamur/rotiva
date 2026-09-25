# ROTIVA

**ROTIVA, kullanıcıların doğal dilde belirttiği gezi tercihlerini analiz ederek kişiselleştirilmiş şehir rotaları oluşturan, yapay zekâ destekli bir mobil gezi planlama uygulamasıdır.

> **Senin günün, senin rotan.**

Kullanıcı; ne kadar zamanı olduğunu, bütçesini, ilgi alanlarını, yürüme tercihini ve görmek istediği özel aktiviteleri doğal dilde ifade eder. Sistem bu isteği yapılandırılmış verilere dönüştürür ve gerçek mekân verileri üzerinden deterministik rota optimizasyonu gerçekleştirir.

---

## Projenin Amacı

Klasik gezi uygulamaları genellikle popüler mekânları listelemek veya sabit gezi rotaları sunmak üzerine kuruludur.

ROTIVA'nın amacı ise kullanıcıya:

- ilgi alanlarına,
- bütçesine,
- mevcut zamanına,
- yürüme tercihine,
- ziyaret etmek istediği aktivitelere,
- mekânların konum ve zaman bilgilerine

uygun, kişiselleştirilmiş bir günlük rota oluşturmaktır.

Projede yapay zekâ doğrudan rota üretmez. LLM yalnızca kullanıcının doğal dildeki isteğini anlamak için kullanılır. Rota oluşturma işlemi deterministik ve test edilebilir algoritmalar tarafından gerçekleştirilir.

---

## Temel Özellikler

- Doğal dil ile gezi isteği oluşturma
- Gemini tabanlı LLM entegrasyonu
- Rule-based parser fallback mekanizması
- Kullanıcı tercihlerinin yapılandırılmış verilere dönüştürülmesi
- Bölge bazlı mekân ve aktivite veri setleri
- İlgi alanı eşleştirme
- Bütçe kontrolü
- Süre kısıtı
- Yürüme tercihi
- Aktivite bazlı planlama
- Kişiselleştirilmiş rota optimizasyonu
- Mekân çeşitliliği kontrolü
- Haversine tabanlı mesafe hesabı
- Rota skorlaması
- Öneri nedenlerinin kullanıcıya açıklanması
- Bilinmeyen maliyet ve açılış saatleri için güvenli veri yönetimi
- Flutter tabanlı mobil uygulama
- Gerçek rota duraklarının harita üzerinde gösterimi
- Android launcher icon ve özel ROTIVA görsel kimliği

---

## Sistem Mimarisi

```text
Kullanıcı
   │
   ▼
Flutter Mobile Application
   │
   ▼
Natural Language Request
   │
   ▼
/api/planner/interpret
   │
   ├── Gemini LLM
   │
   └── Rule-Based Fallback
   │
   ▼
Structured User Intent
   │
   ▼
Activity Resolver
   │
   ▼
Planner Service
   │
   ▼
Suitability Scoring
   │
   ▼
Route Optimizer
   │
   ▼
/api/planner/plan
   │
   ▼
Personalized Route
   │
   ▼
Flutter Result Screen + Map
LLM'in Sistemdeki Rolü
ROTIVA'da LLM yalnızca kullanıcının doğal dilde yazdığı isteği analiz etmek amacıyla kullanılmaktadır.
Örnek kullanıcı isteği:
Sultanahmet'ta 5 saatim var.
Tarihi yerleri ve müzeleri seviyorum.
Çok yürümek istemiyorum.
Bütçem 1000 TL.
Topkapı'da Harem'i görmek istiyorum.
Bu istek aşağıdaki gibi yapılandırılmış verilere dönüştürülebilir:
{
  "region": "sultanahmet-eminonu",
  "availableMinutes": 300,
  "budgetTRY": 1000,
  "interests": ["history", "museum"],
  "walkingPreference": "low"
}
LLM:
- mekân üretmez,
- koordinat üretmez,
- rota oluşturmaz,
- maliyet veya süre uydurmaz.
Asıl rota planlama mevcut doğrulanmış veri ve deterministik algoritmalar kullanılarak yapılır.
Rota Optimizasyonu
Rota motoru bir sonraki durağı belirlerken farklı kriterleri birlikte değerlendirir.
Başlıca kriterler:
- kullanıcı ilgi alanı uyumu,
- mesafe,
- kalan zaman,
- bütçe,
- kategori çeşitliliği,
- aktivite süresi,
- koordinat doğruluğu.
Mesafeler Haversine yöntemi ile hesaplanır.
Aynı kategorideki mekânların sürekli önerilmesini azaltmak amacıyla çeşitlilik mekanizması kullanılmaktadır.
Veri Güvenliği Yaklaşımı
Projede eksik veya belirsiz verilerin kullanıcıya kesin bilgi gibi sunulmaması temel tasarım prensiplerinden biridir.
Örneğin:
- Bilinmeyen maliyet 0 TL kabul edilmez.
- Bilinmeyen açılış saati "açık" olarak değerlendirilmez.
- Doğrulanmamış koordinatlar otomatik rota için kullanılmaz.
- Eksik ziyaret süresi tahmin edilmez.
- LLM'in yeni mekân veya aktivite üretmesine izin verilmez.
Mobil uygulamada bilinmeyen maliyet:
Bilinmiyor
şeklinde gösterilir.
Kullanılan Teknolojiler
Backend
- Node.js
- JavaScript
- Built-in HTTP server
- REST API
- Gemini API
- OpenAI provider adapter
- Rule-based fallback parser
Mobile
- Flutter
- Dart
- HTTP
- OpenStreetMap
- flutter_map
- Android Emulator
Veri ve Algoritmalar
- JSON tabanlı şehir veri setleri
- Haversine distance
- Suitability scoring
- Route optimization
- Semantic interest mapping
- Activity candidate adapter
- Scenario evaluation
Proje Yapısı
rotiva/
│
├── frontend/
│   └── Web MVP
│
├── mobile/
│   ├── lib/
│   │   ├── main.dart
│   │   └── route_preview.dart
│   ├── assets/
│   │   ├── images/
│   │   ├── fonts/
│   │   └── data/
│   ├── test/
│   └── integration_test/
│
├── outputs/
│   ├── normalized/
│   └── regional datasets
│
├── scripts/
│   └── data normalization scripts
│
├── src/
│   ├── ai/
│   ├── api/
│   ├── data/
│   ├── planner/
│   └── route-engine/
│
└── tests/
API Endpointleri
Health Check
GET /api/health
Bölgeler
GET /api/regions
Bölge Aktiviteleri
GET /api/regions/:region/activities
Doğal Dil Yorumlama
POST /api/planner/interpret
Rota Oluşturma
POST /api/planner/plan
Mobil Uygulama Akışı
Ana Ekran
    ↓
Doğal Dil Girişi
    ↓
Rotamı Planla
    ↓
Tercihler
    ↓
Aktivite Seçimi
    ↓
Rotayı Oluştur
    ↓
Haritalı Rota Sonucu
Kullanıcı, LLM tarafından yorumlanan tercihleri rota oluşturulmadan önce değiştirebilir.
Örnek Demo
Kullanıcı isteği
Sultanahmet'ta 5 saatim var.
Tarihi yerleri ve müzeleri seviyorum.
Çok yürümek istemiyorum.
Bütçem 1000 TL.
Topkapı'da Harem'i görmek istiyorum.
Örnek oluşturulan rota:
1. Türk ve İslam Eserleri Müzesi
2. Topkapı Sarayı — Harem Bölümü
Örnek rota özeti:
- Mesafe: 1.13 km
- Yürüyüş: 15 dk
- Ziyaret: 150 dk
- Kalan süre: 135 dk
- Bilinmeyen maliyetler: Bilinmiyor
Rota çıktıları mevcut veri, kullanıcı tercihleri ve planlama koşullarına göre değişebilir.

Projeyi Çalıştırma
1. Repository'yi klonlayın
git clone https://github.com/sudesamur/rotiva.git
cd rotiva
2. Backend'i başlatın
Gemini API anahtarını ortam değişkeni olarak tanımlayın.
Windows PowerShell örneği:
$env:GEMINI_API_KEY="YOUR_API_KEY"
Ardından:
node src/api/server.js
Backend varsayılan olarak:
http://127.0.0.1:3000
üzerinde çalışır.
Health check:
http://127.0.0.1:3000/api/health
3. Flutter uygulamasını çalıştırın
cd mobile
flutter pub get
flutter run
Android Emulator üzerinde backend erişimi için uygulama:
http://10.0.2.2:3000
adresini kullanır.
Testler
Flutter statik analiz:
cd mobile
flutter analyze
Backend ve rota motoru için proje içerisinde birim ve entegrasyon testleri bulunmaktadır.
Başlıca test alanları:
- planner service
- route optimizer
- suitability scoring
- scenario evaluator
- activity candidate adapter
- LLM provider
- API integration
- intent parsing
- frontend client
- veri normalizasyonu
Mevcut Sınırlamalar
- Mevcut veri seti ağırlıklı olarak İstanbul bölgelerine odaklanmaktadır.
- Haritadaki rota çizgisi durak sırasını temsil eder; turn-by-turn navigasyon değildir.
- Bazı mekânlarda maliyet veya açılış saati bilgisi bilinmeyebilir.
- LLM çıktıları değişkenlik gösterebilir; bu nedenle rule-based fallback bulunmaktadır.
- Gerçek zamanlı trafik veya toplu taşıma entegrasyonu bulunmamaktadır.
- Harita zemininin görüntülenebilmesi için internet bağlantısı gereklidir.
Gelecek Geliştirmeler
- Yeni şehirlerin veri setine eklenmesi
- Toplu taşıma entegrasyonu
- Gerçek yürüme rotası servisleri
- Kullanıcı hesapları
- Favoriler ve rota geçmişi
- Çok günlük gezi planlama
- Daha geniş aktivite veri tabanı
- Gerçek zamanlı açılış saati ve fiyat entegrasyonları
Geliştirici
**Sude Samur**  
Bilgisayar Mühendisliği
---

## Repository

https://github.com/sudesamur/rotiva
