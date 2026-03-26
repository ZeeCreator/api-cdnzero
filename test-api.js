/**
 * Contoh script untuk testing CDNZero Scraper API
 * 
 * Jalankan dengan: node test-api.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE_URL = 'http://localhost:3000';
const api = axios.create({ baseURL: API_BASE_URL });

// 1. Test Health Check
async function testHealth() {
    try {
        console.log('\n📋 Testing Health Check...');
        const { data } = await api.get('/api/health');
        console.log('Health Status:', data);
        return data;
    } catch (error) {
        console.log('Health Error:', error.message);
        return { success: false, error: error.message };
    }
}

// 2. Test Get Cookies
async function testCookies() {
    try {
        console.log('\n🍪 Testing Cookies...');
        const { data } = await api.get('/api/cookies');
        console.log('Cookies:', data);
        return data;
    } catch (error) {
        console.log('Cookies Error:', error.message);
        return { success: false, error: error.message };
    }
}

// 3. Test Upload File
async function testUpload(filePath) {
    try {
        console.log('\n📤 Testing Upload...');
        
        if (!filePath || !fs.existsSync(filePath)) {
            console.log('⚠️  File not found:', filePath);
            return null;
        }

        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));

        const { data } = await api.post('/api/upload', formData, {
            headers: formData.getHeaders()
        });

        console.log('Upload Result:', data);
        return data;
    } catch (error) {
        console.log('Upload Error:', error.message);
        return { success: false, error: error.message };
    }
}

// 4. Test Get File Detail
async function testFileDetail(fileUrl) {
    try {
        console.log('\n🔍 Testing File Detail...');
        
        if (!fileUrl) {
            console.log('⚠️  No URL provided');
            return null;
        }

        const { data } = await api.get('/api/file-detail', {
            params: { url: fileUrl }
        });

        console.log('File Detail:', data);
        return data;
    } catch (error) {
        console.log('File Detail Error:', error.message);
        return { success: false, error: error.message };
    }
}

// 5. Test Refresh Session
async function testRefreshSession() {
    try {
        console.log('\n🔄 Testing Refresh Session...');
        const { data } = await api.post('/api/refresh-session');
        console.log('Refresh Session:', data);
        return data;
    } catch (error) {
        console.log('Refresh Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting CDNZero Scraper API Tests...\n');
    console.log('='.repeat(50));

    // Test 1: Health Check
    await testHealth();

    // Test 2: Cookies
    await testCookies();

    // Test 3: Upload (optional - provide file path)
    // const uploadResult = await testUpload('path/to/your/file.txt');
    
    // Test 4: File Detail (optional - provide file URL)
    // if (uploadResult && uploadResult.success && uploadResult.data.url) {
    //     await testFileDetail(uploadResult.data.url);
    // }

    // Test 5: Refresh Session
    await testRefreshSession();

    console.log('\n' + '='.repeat(50));
    console.log('✅ Tests completed!\n');
}

// Jalankan tests
runTests().catch(console.error);
