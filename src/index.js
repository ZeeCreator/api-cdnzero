require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable untuk development
    crossOriginEmbedderPolicy: false
}));

// Request logging
app.use(morgan('dev'));

// Parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    }
});

app.use('/api/', limiter);

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'CDNZero Scraper API is running',
        version: '2.0.0',
        endpoints: {
            upload: 'POST /api/upload',
            uploadMultiple: 'POST /api/upload-multiple',
            fileDetail: 'GET /api/file-detail?url=<file_url>',
            health: 'GET /api/health',
            cookies: 'GET /api/cookies',
            refreshSession: 'POST /api/refresh-session'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Start server function
function startServer() {
    return new Promise((resolve, reject) => {
        try {
            console.log('🚀 Starting CDNZero Scraper API...');
            console.log('📋 Environment:', process.env.NODE_ENV || 'development');

            const server = app.listen(PORT, () => {
                console.log(`✅ Server is running on http://localhost:${PORT}`);
                console.log('📋 Available endpoints:');
                console.log('   POST /api/upload          - Upload single file');
                console.log('   POST /api/upload-multiple - Upload multiple files');
                console.log('   GET  /api/file-detail     - Get file detail');
                console.log('   GET  /api/health          - Check health status');
                console.log('   GET  /api/cookies         - Get session cookies');
                console.log('   POST /api/refresh-session - Refresh browser session');
                resolve(server);
            });
        } catch (error) {
            console.error('❌ Failed to start server:', error.message);
            reject(error);
        }
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

// Export app untuk Vercel serverless
module.exports = app;

// Start server hanya jika dijalankan langsung (bukan di Vercel)
if (process.env.VERCEL !== '1' && require.main === module) {
    startServer().catch(console.error);
}
