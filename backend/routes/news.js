// src/routes/news.js
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// Default region filter for Tagesschau API ("regions" parameter)
const DEFAULT_REGIONS = '1';

router.get('/todays-news', async (req, res) => {
  const regions = req.query.regions || DEFAULT_REGIONS;
  try {
    // Note the trailing slash here:
    const url = 'https://www.tagesschau.de/api2u/news/';
    const { data } = await axios.get(url, {
      params: { regions }
    });

    // Extract the array from `news`, not `articles`
    const articles = Array.isArray(data)
      ? data
      : data.news || [];

    const mapped = articles.map(a => ({
      title:        a.title,                                   // e.g. "Merkel kritisiert …"
      description:  a.teaserText || a.teaser || null,          // teaser / short summary
      source:       a.source || 'tagesschau',                  // sometimes NDR/WDR/etc.
      url:          a.detailsweb,      // note: prepend host
      image:        a.teaserImage
                      && a.teaserImage.imageVariants
                      && a.teaserImage.imageVariants['16x9-384'],
      published_at: a.date                                    // ISO timestamp
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching news:', error.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

module.exports = router;
