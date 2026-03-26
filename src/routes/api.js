const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const scraperService = require('../services/scraperService');

const router = express.Router();

// Konfigurasi multer untuk upload file
// Gunakan memory storage untuk Vercel (serverless), disk storage untuk lokal
const isVercel = process.env.VERCEL === '1';

const storage = isVercel 
    ? multer.memoryStorage() // Memory storage untuk Vercel
    : multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + '-' + file.originalname);
        }
    });

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept all file types
        cb(null, true);
    }
});

/**
 * @route POST /api/upload
 * @desc Upload file ke cdnzero.unaux.com
 * @access Public
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        console.log('📥 Received upload request');

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded. Please provide a file in the "file" field.'
            });
        }

        console.log(`📄 File received: ${req.file.originalname} (${req.file.size} bytes)`);
        console.log(`📄 Storage type: ${isVercel ? 'memory' : 'disk'}`);

        // Upload ke cdnzero menggunakan scraper
        // Untuk Vercel, pass buffer; untuk lokal, pass path
        const result = isVercel 
            ? await scraperService.uploadFileBuffer(req.file.buffer, req.file.originalname)
            : await scraperService.uploadFile(req.file.path);

        // Hapus file lokal setelah upload (hanya untuk lokal)
        if (!isVercel && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err.message);
            });
        }

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'File uploaded successfully',
                data: result.data
            });
        } else {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to upload file'
            });
        }
    } catch (error) {
        console.error('❌ Upload error:', error.message);

        // Clean up file jika ada error (hanya untuk lokal)
        if (!isVercel && req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err.message);
            });
        }

        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * @route POST /api/upload-multiple
 * @desc Upload multiple files ke cdnzero.unaux.com
 * @access Public
 */
router.post('/upload-multiple', upload.array('files', 10), async (req, res) => {
    try {
        console.log('📥 Received multiple upload request');

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded. Please provide files in the "files" field.'
            });
        }

        console.log(`📄 ${req.files.length} files received`);

        const results = [];

        for (const file of req.files) {
            console.log(`📄 Processing: ${file.originalname}`);

            // Upload ke cdnzero menggunakan scraper
            // Untuk Vercel, pass buffer; untuk lokal, pass path
            const result = isVercel 
                ? await scraperService.uploadFileBuffer(file.buffer, file.originalname)
                : await scraperService.uploadFile(file.path);

            // Hapus file lokal (hanya untuk lokal)
            if (!isVercel && file.path) {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error deleting temp file:', err.message);
                });
            }

            results.push({
                originalName: file.originalname,
                ...result
            });

            // Delay antar upload
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return res.status(200).json({
            success: true,
            message: `${results.length} files processed`,
            data: results
        });
    } catch (error) {
        console.error('❌ Multiple upload error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * @route GET /api/file-detail
 * @desc Get detail file dari URL
 * @access Public
 */
router.get('/file-detail', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }

        console.log(`🔍 Getting file detail for: ${url}`);

        const result = await scraperService.getFileDetail(url);

        if (result.success) {
            return res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to get file detail'
            });
        }
    } catch (error) {
        console.error('❌ File detail error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * @route POST /api/file-detail
 * @desc Get detail file dari URL (POST method)
 * @access Public
 */
router.post('/file-detail', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required in request body'
            });
        }

        console.log(`🔍 Getting file detail for: ${url}`);

        const result = await scraperService.getFileDetail(url);

        if (result.success) {
            return res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to get file detail'
            });
        }
    } catch (error) {
        console.error('❌ File detail error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * @route GET /api/health
 * @desc Check connection dan session status
 * @access Public
 */
router.get('/health', async (req, res) => {
    try {
        const healthStatus = await scraperService.healthCheck();

        if (healthStatus.status === 'healthy') {
            return res.status(200).json({
                success: true,
                ...healthStatus
            });
        } else {
            return res.status(503).json({
                success: false,
                ...healthStatus
            });
        }
    } catch (error) {
        return res.status(503).json({
            success: false,
            status: 'error',
            message: error.message
        });
    }
});

/**
 * @route GET /api/cookies
 * @desc Get current session cookies
 * @access Public
 */
router.get('/cookies', async (req, res) => {
    try {
        const cookies = await scraperService.getCookies();
        const cookieString = await scraperService.getCookieString();

        return res.status(200).json({
            success: true,
            cookies: cookies,
            cookieString: cookieString
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/refresh-session
 * @desc Refresh browser session
 * @access Public
 */
router.post('/refresh-session', async (req, res) => {
    try {
        console.log('🔄 Refreshing session...');
        await scraperService.refreshSession();

        return res.status(200).json({
            success: true,
            message: 'Session refreshed successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
