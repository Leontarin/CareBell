const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// Default news region can be provided via env
const DEFAULT_REGION = process.env.NEWS_REGION || 'germany';

// Fetch today's news using the unofficial Tagesschau API
// NOTE: This is a best-effort implementation. Field mappings may need
// adjustment once the actual API responses are known.
router.get('/todays-news', async (req, res) => {
    const region = req.query.region || DEFAULT_REGION;
    try {
        const today = new Date().toISOString().split('T')[0];
        const url = `https://tagesschau-api.deno.dev/${region}/news`; // TODO: confirm endpoint
        const { data } = await axios.get(url, { params: { date: today } });

        const articles = Array.isArray(data)
            ? data
            : data.articles || [];

        const mapped = articles.map(a => ({
            title:        a.title || a.headline,
            description:  a.description || a.teaser,
            source:       a.source      || 'tagesschau',
            url:          a.url,
            image:        a.image,
            published_at: a.published_at || a.date
        }));

        res.json(mapped);
    } catch (error) {
        console.error('Error fetching news:', error.message);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

module.exports = router;
