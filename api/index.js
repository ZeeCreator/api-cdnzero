// Vercel Serverless Function Entry Point
const app = require('../src/index');

module.exports = async (req, res) => {
    // Handle request dengan express app
    return app(req, res);
};
