const express = require('express');
const steganographyRoutes = require('./steganography.route');

const setupRoutes = (app) => {
    app.use('/api/steganography', steganographyRoutes);
};

module.exports = setupRoutes;