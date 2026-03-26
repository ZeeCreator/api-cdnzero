const axios = require('axios');
const https = require('https');
const aesjs = require('aes-js');
const cheerio = require('cheerio');
const FormData = require('form-data');
const fs = require('fs');
const { CookieJar, Cookie } = require('tough-cookie');

class ScraperService {
    constructor() {
        this.targetUrl = process.env.TARGET_URL || 'https://cdnzero.unaux.com';
        this.sessionCookies = null;
        this.cookieJar = new CookieJar();

        // Custom HTTPS agent untuk handle SSL renegotiation
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false, // Handle SSL issues
            maxRedirects: 5,
            keepAlive: true
        });

        // Setup axios instance dengan cookie jar
        this.client = axios.create({
            baseURL: this.targetUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: parseInt(process.env.AXIOS_TIMEOUT) || 30000,
            maxRedirects: 0, // Don't follow redirect automatically
            validateStatus: (status) => status < 500,
            httpsAgent: httpsAgent,
            httpAgent: new https.Agent({ keepAlive: true })
        });

        // Interceptor untuk inject cookies
        this.client.interceptors.request.use(async (config) => {
            const cookies = await this.cookieJar.getCookieString(config.url || this.targetUrl);
            if (cookies) {
                config.headers.Cookie = cookies;
            }
            return config;
        });

        // Interceptor untuk save cookies dari response
        this.client.interceptors.response.use(async (response) => {
            const setCookie = response.headers['set-cookie'];
            if (setCookie) {
                await this.cookieJar.setCookie(setCookie, response.config.url || this.targetUrl);
            }
            return response;
        });
    }

    async initializeSession() {
        try {
            console.log('🔄 Initializing session...');
            console.log('📍 Target URL:', this.targetUrl);

            // Get initial page to fetch AES script and cookie params
            const response = await this.client.get(this.targetUrl, {
                maxRedirects: 0
            });

            console.log('📄 Initial response status:', response.status);
            
            // Parse HTML untuk mendapatkan script protection
            const $ = cheerio.load(response.data);
            const script = $('script').filter((i, el) => {
                const content = $(el).html() || '';
                return content.includes('toNumbers') && content.includes('slowAES');
            }).html();

            if (script) {
                console.log('🔐 Found AES protection script');
                
                // Jalankan script di VM untuk mendapatkan cookie yang benar
                const testCookie = await this.runScriptInVM(script);
                
                if (testCookie) {
                    // Set cookie ke jar
                    await this.cookieJar.setCookie(`__test=${testCookie}; Path=/; Domain=cdnzero.unaux.com`, this.targetUrl);
                    this.sessionCookies = await this.cookieJar.getCookieString(this.targetUrl);
                    
                    console.log('✅ Generated test cookie:', testCookie.substring(0, 20) + '...');
                } else {
                    this.sessionCookies = await this.cookieJar.getCookieString(this.targetUrl);
                }
            } else {
                // Fallback: simpan cookies dari response
                this.sessionCookies = await this.cookieJar.getCookieString(this.targetUrl);
            }

            console.log('✅ Session initialized');

            return {
                success: true,
                cookies: this.sessionCookies
            };
        } catch (error) {
            console.error('❌ Error initializing session:', error.message);
            console.error('❌ Error details:', error.code, error.response?.status);
            throw error;
        }
    }

    /**
     * Jalankan script AES di VM Node.js untuk mendapatkan cookie yang benar
     */
    async runScriptInVM(script) {
        try {
            // Helper: hex string → Uint8Array
            const hexToBytes = (hex) => {
                const bytes = [];
                hex.replace(/(..)/g, (chunk) => bytes.push(parseInt(chunk, 16)));
                return new Uint8Array(bytes);
            };

            // Helper: Uint8Array → hex string
            const bytesToHex = (bytes) => {
                return Array.from(bytes)
                    .map(b => (b < 16 ? '0' : '') + b.toString(16))
                    .join('');
            };

            // Extract values dari script
            const matches = [...script.matchAll(/toNumbers\("([^"]+)"\)/g)];
            if (matches.length < 3) {
                return null;
            }

            const keyHex = matches[0][1]; // a = AES key
            const ivHex = matches[1][1];  // b = IV
            const cipherHex = matches[2][1]; // c = ciphertext

            console.log('🔑 AES params:', { 
                key: keyHex, 
                iv: ivHex, 
                cipher: cipherHex 
            });

            // Convert hex ke bytes
            const key = hexToBytes(keyHex);
            const iv = hexToBytes(ivHex);
            const ciphertext = hexToBytes(cipherHex);

            // Decrypt menggunakan AES CBC (slowAES mode 2 = CBC)
            const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
            const decrypted = aesCbc.decrypt(ciphertext);

            const testCookie = bytesToHex(decrypted);
            
            console.log('🔓 Decrypted cookie:', testCookie);
            
            return testCookie;
        } catch (error) {
            console.error('❌ Error running script in VM:', error.message);
            return null;
        }
    }

    async uploadFile(filePath) {
        try {
            console.log('📤 Uploading file:', filePath);

            // Pastikan session aktif
            if (!this.sessionCookies) {
                await this.initializeSession();
            }

            // Baca file
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = filePath.split(/[\\/]/).pop();

            // Buat form data untuk upload
            const formData = new FormData();
            formData.append('file', fileBuffer, {
                filename: fileName,
                contentType: this.getMimeType(fileName)
            });

            // Upload ke endpoint yang benar
            // Berdasarkan HTML, endpoint upload adalah api/upload.php
            const uploadUrl = `${this.targetUrl}/api/upload.php`;
            
            console.log('📤 Uploading to:', uploadUrl);
            console.log('🍪 Using cookie:', this.sessionCookies);

            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Cookie': this.sessionCookies,
                    'Referer': this.targetUrl,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                    keepAlive: true
                }),
                timeout: parseInt(process.env.AXIOS_TIMEOUT) || 30000,
                maxRedirects: 5
            });

            console.log('📄 Upload response status:', response.status);
            console.log('📄 Response headers:', JSON.stringify(response.headers, null, 2));
            console.log('📄 Response data length:', response.data?.length || 0);

            // Coba parse sebagai JSON dulu
            let fileUrl = null;
            try {
                const jsonData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                if (jsonData.success && jsonData.data) {
                    fileUrl = jsonData.data.direct_url || jsonData.data.url || jsonData.data.fileUrl;
                    console.log('✅ Found URL in JSON response:', fileUrl);
                }
            } catch (e) {
                console.log('📄 Response is not JSON, parsing as HTML...');
            }

            // Jika tidak ada URL dari JSON, parse HTML
            if (!fileUrl && response.data) {
                const $ = cheerio.load(response.data);
                fileUrl = this.extractFileUrl($, response.data);
            }
            
            // Debug: log response jika URL tidak ditemukan
            if (!fileUrl) {
                console.log('📄 Full Response:', typeof response.data === 'string' ? response.data.substring(0, 1000) : response.data);
            }

            return {
                success: true,
                data: {
                    fileName: fileName,
                    fileSize: fileBuffer.length,
                    url: fileUrl,
                    uploadedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('❌ Error uploading file:', error.message);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error response:', error.response?.status);

            // Reset session jika error
            this.sessionCookies = null;

            return {
                success: false,
                error: error.message
            };
        }
    }

    async getFileDetail(fileUrl) {
        try {
            console.log('📋 Getting file detail:', fileUrl);

            // Request ke URL file
            const response = await this.client.get(fileUrl);

            // Parse HTML
            const $ = cheerio.load(response.data);

            // Ekstrak informasi file
            const fileDetail = {
                url: fileUrl,
                fileName: this.extractText($, 'h1, .file-name, [class*="filename"]'),
                fileSize: this.extractText($, '.file-size, [class*="size"]'),
                uploadDate: this.extractText($, '.upload-date, .date, [class*="date"]'),
                downloadCount: this.extractText($, '.downloads, [class*="download"]'),
                downloadUrl: this.extractHref($, 'a[href*="/download"], button.download, .download-btn'),
                directLink: this.extractValue($, 'input[value*="http"], .direct-link'),
                fetchedAt: new Date().toISOString()
            };

            return {
                success: true,
                data: fileDetail
            };
        } catch (error) {
            console.error('❌ Error getting file detail:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    extractFileUrl($, html) {
        try {
            console.log('🔍 Extracting file URL from response...');
            
            // Cari link file dengan berbagai pola
            let fileUrl = null;

            // 1. Cari di href link
            $('a[href]').each((i, el) => {
                const href = $(el).attr('href');
                if (href && (href.includes('/file/') || href.includes('/download/') || href.includes('cdnzero') || href.startsWith('http'))) {
                    fileUrl = href.startsWith('http') ? href : this.targetUrl + href;
                    console.log('✅ Found URL in <a>:', fileUrl);
                    return false; // break
                }
            });

            // 2. Cari di input value
            if (!fileUrl) {
                $('input[value]').each((i, el) => {
                    const value = $(el).attr('value');
                    if (value && value.startsWith('http')) {
                        fileUrl = value;
                        console.log('✅ Found URL in <input>:', fileUrl);
                        return false; // break
                    }
                });
            }

            // 3. Cari di data-url attribute
            if (!fileUrl) {
                $('[data-url]').each((i, el) => {
                    const dataUrl = $(el).attr('data-url');
                    if (dataUrl && dataUrl.startsWith('http')) {
                        fileUrl = dataUrl;
                        console.log('✅ Found URL in data-url:', fileUrl);
                        return false; // break
                    }
                });
            }

            // 4. Fallback: construct URL dari filename jika ada
            if (!fileUrl) {
                const fileName = $('input[name="filename"][value]').attr('value');
                if (fileName) {
                    fileUrl = `${this.targetUrl}/file/${fileName}`;
                    console.log('✅ Constructed URL from filename:', fileUrl);
                }
            }

            if (!fileUrl) {
                console.log('❌ No URL found in response');
            }

            return fileUrl;
        } catch (error) {
            console.error('❌ Error extracting file URL:', error.message);
            return null;
        }
    }

    extractText($, selector) {
        const element = $(selector).first();
        return element.length ? element.text().trim() : null;
    }

    extractHref($, selector) {
        const element = $(selector).first();
        return element.length ? (element.attr('href') || element.attr('data-url')) : null;
    }

    extractValue($, selector) {
        const element = $(selector).first();
        return element.length ? (element.attr('value') || element.attr('href')) : null;
    }

    getMimeType(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'zip': 'application/zip',
            'rar': 'application/vnd.rar',
            'mp3': 'audio/mpeg',
            'mp4': 'video/mp4',
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'json': 'application/json'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    async healthCheck() {
        try {
            // Custom HTTPS agent untuk handle SSL renegotiation
            const httpsAgent = new https.Agent({
                rejectUnauthorized: false,
                keepAlive: true
            });

            // Coba request ke target URL tanpa interceptor
            const response = await axios.get(this.targetUrl, {
                timeout: parseInt(process.env.AXIOS_TIMEOUT) || 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                httpsAgent: httpsAgent,
                maxRedirects: 5
            });

            return {
                status: 'healthy',
                message: 'Connection successful',
                hasCookies: !!this.sessionCookies,
                statusCode: response.status
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message
            };
        }
    }

    async getCookies() {
        const cookies = await this.cookieJar.getCookies(this.targetUrl);
        return cookies.map(c => ({
            name: c.key,
            value: c.value,
            domain: c.domain,
            path: c.path
        }));
    }

    async getCookieString() {
        return await this.cookieJar.getCookieString(this.targetUrl);
    }

    async refreshSession() {
        this.sessionCookies = null;
        this.cookieJar = new CookieJar();
        return await this.initializeSession();
    }
}

module.exports = new ScraperService();
