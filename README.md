# Sesli Kayıt - Müşteri Takip Sistemi

Ses kaydı ile müşteri bilgilerini Google Sheets'e otomatik yazan web uygulaması.

## Akış
1. 🎤 Ses kaydet (veya yazarak gir)
2. 🔤 Whisper API ile yazıya çevir
3. 🤖 Claude ile bilgileri ayrıştır (Ad, Telefon, Şehir, vb.)
4. ✅ Önizle, düzelt
5. 📊 Google Sheets'e kaydet

## Kurulum

### 1. Projeyi aç ve bağımlılıkları kur
```bash
cd sesli-kayit
npm install
```

### 2. API Key'leri ayarla
`.env.example` dosyasını `.env.local` olarak kopyala:
```bash
cp .env.example .env.local
```

`.env.local` dosyasını aç ve key'leri yapıştır:
- **OPENAI_API_KEY**: platform.openai.com → API Keys
- **ANTHROPIC_API_KEY**: console.anthropic.com → API Keys
- **GOOGLE_SERVICE_ACCOUNT_EMAIL**: İndirdiğin JSON'daki `client_email`
- **GOOGLE_PRIVATE_KEY**: İndirdiğin JSON'daki `private_key`
- **GOOGLE_SHEET_ID**: Zaten dolu (ablanın sheet'i)

### 3. Google Sheets'i paylaş
Ablanın Sheet'ini aç → Paylaş → `GOOGLE_SERVICE_ACCOUNT_EMAIL`'deki adresi **Düzenleyici** olarak ekle.

### 4. Çalıştır
```bash
npm run dev
```
Tarayıcıda http://localhost:3000 aç.

## Vercel'e Deploy

```bash
npm install -g vercel
vercel
```
Vercel dashboard'dan Environment Variables'a API key'leri ekle.

## Maliyet
- Whisper: ~$0.006/dakika
- Claude Haiku: ~$0.001/istek
- Google Sheets API: Ücretsiz
- **Günde 10 kayıt ≈ aylık ~$1-2**
