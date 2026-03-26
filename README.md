# CDNZero Scraper API

API Node.js untuk scrape **https://cdnzero.unaux.com/** - **Vercel Compatible** (tanpa Puppeteer)

## Fitur

- ✅ **Serverless Compatible** - Bisa di-host di Vercel
- ✅ **Lightweight** - Tidak menggunakan Puppeteer/browser
- ✅ **Cookie Management** - Session management otomatis dengan tough-cookie
- ✅ **Upload File Single & Multiple**
- ✅ **Get Detail File** setelah upload
- ✅ **Rate Limiting** untuk keamanan
- ✅ **Health Check Endpoint**

## Instalasi

1. Install dependencies:
```bash
npm install
```

2. Konfigurasi environment (opsional):
```bash
# Copy .env.example ke .env
copy .env.example .env

# Edit .env sesuai kebutuhan
```

3. Jalankan server:
```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

Server akan berjalan di `http://localhost:3000`

## Deploy ke Vercel

1. Install Vercel CLI (opsional):
```bash
npm install -g vercel
```

2. Login ke Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Deploy ke production:
```bash
vercel --prod
```

## API Endpoints

### 1. Upload File (Single)

**Endpoint:** `POST /api/upload`

**Content-Type:** `multipart/form-data`

**Body:**
- `file` (required): File yang akan diupload

**Contoh dengan cURL:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@C:\path\to\your\file.zip"
```

**Contoh dengan Fetch (JavaScript):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData
});

const result = await response.json();
console.log(result);
```

**Response:**
```json
{
    "success": true,
    "message": "File uploaded successfully",
    "data": {
        "url": "https://cdnzero.unaux.com/file/xxx",
        "fileName": "example.zip",
        "fileSize": 1024,
        "uploadedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

---

### 2. Upload Multiple Files

**Endpoint:** `POST /api/upload-multiple`

**Content-Type:** `multipart/form-data`

**Body:**
- `files` (required): Array of files (max 10 files)

**Contoh dengan cURL:**
```bash
curl -X POST http://localhost:3000/api/upload-multiple \
  -F "files=@C:\path\to\file1.zip" \
  -F "files=@C:\path\to\file2.zip"
```

**Response:**
```json
{
    "success": true,
    "message": "2 files processed",
    "data": [
        {
            "originalName": "file1.zip",
            "success": true,
            "data": { ... }
        },
        {
            "originalName": "file2.zip",
            "success": true,
            "data": { ... }
        }
    ]
}
```

---

### 3. Get File Detail

**Endpoint:** `GET /api/file-detail?url=<file_url>`

**Query Parameters:**
- `url` (required): URL file yang ingin dicek

**Contoh:**
```bash
curl "http://localhost:3000/api/file-detail?url=https://cdnzero.unaux.com/file/xxx"
```

**POST Method Alternative:**
```bash
curl -X POST http://localhost:3000/api/file-detail \
  -H "Content-Type: application/json" \
  -d '{"url": "https://cdnzero.unaux.com/file/xxx"}'
```

**Response:**
```json
{
    "success": true,
    "data": {
        "url": "https://cdnzero.unaux.com/file/xxx",
        "fileName": "example.zip",
        "fileSize": "10 MB",
        "uploadDate": "2024-01-01",
        "downloadUrl": "...",
        "directLink": "...",
        "fetchedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

---

### 4. Health Check

**Endpoint:** `GET /api/health`

**Contoh:**
```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
    "success": true,
    "status": "healthy",
    "message": "Connection successful",
    "hasCookies": true
}
```

---

### 5. Get Session Cookies

**Endpoint:** `GET /api/cookies`

**Contoh:**
```bash
curl http://localhost:3000/api/cookies
```

**Response:**
```json
{
    "success": true,
    "cookies": [
        {
            "name": "session_id",
            "value": "xxx",
            "domain": "cdnzero.unaux.com"
        }
    ],
    "cookieString": "session_id=xxx; other_cookie=yyy"
}
```

---

### 6. Refresh Session

**Endpoint:** `POST /api/refresh-session`

**Contoh:**
```bash
curl -X POST http://localhost:3000/api/refresh-session
```

**Response:**
```json
{
    "success": true,
    "message": "Session refreshed successfully"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Port server |
| `NODE_ENV` | development | Environment mode |
| `TARGET_URL` | https://cdnzero.unaux.com | URL target scraper |
| `AXIOS_TIMEOUT` | 30000 | Timeout HTTP request (ms) |
| `RATE_LIMIT_WINDOW_MS` | 900000 | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per window |

## Struktur Project

```
TES/
├── src/
│   ├── index.js              # Main server
│   ├── services/
│   │   └── scraperService.js # Scraper logic (axios + cheerio)
│   └── routes/
│       └── api.js            # API routes
├── api/
│   └── index.js              # Vercel serverless entry point
├── uploads/                   # Temporary upload folder
├── .env                       # Environment variables
├── .env.example               # Environment template
├── vercel.json                # Vercel configuration
├── package.json
└── README.md
```

## Perbedaan dengan Versi Sebelumnya

### Versi 1.x (Puppeteer)
- ❌ Menggunakan Puppeteer (headless browser)
- ❌ Berat dan lambat
- ❌ Tidak kompatibel dengan Vercel/serverless
- ❌ Membutuhkan resource besar

### Versi 2.x (Axios + Cheerio)
- ✅ Menggunakan HTTP requests langsung
- ✅ Ringan dan cepat
- ✅ **Kompatibel dengan Vercel/serverless**
- ✅ Resource minimal

## Catatan Penting

1. **Vercel Deployment**: 
   - Pastikan untuk set environment variables di Vercel dashboard
   - File upload temporary akan disimpan di `/tmp` untuk Vercel

2. **Session Management**: 
   - Session cookies dikelola otomatis
   - Gunakan `/api/refresh-session` jika terjadi error

3. **File Cleanup**: 
   - File yang diupload ke server akan otomatis dihapus setelah diproses

4. **Rate Limiting**: 
   - Default 100 requests per 15 menit
   - Sesuaikan di `.env` jika diperlukan

5. **Vercel Function Duration**: 
   - Default maxDuration adalah 60 detik
   - Sesuaikan di `vercel.json` jika perlu

## Troubleshooting

### Error: "Timeout exceeded"
- Tingkatkan `AXIOS_TIMEOUT` di `.env`
- Periksa koneksi internet

### Error: "File upload failed"
- Pastikan website target tidak mengalami downtime
- Coba refresh session dengan `/api/refresh-session`

### Error: "Request entity too large"
- File terlalu besar untuk Vercel serverless function
- Vercel memiliki limit 6MB untuk request body (Hobby plan)

### Deployment Error di Vercel
- Pastikan Node.js version >= 18
- Cek logs di Vercel dashboard untuk detail error

## License

ISC
