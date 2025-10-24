const express = require("express");
const router = express.Router();
const {
  VERSION,
  PICTOGRAMS,
  ALLERGENS,
  ADDITIVES,
} = require("../../shared/constants/meta");

router.get("/init", (_req, res) => {
  res.json({
    version: VERSION,
    pictograms: PICTOGRAMS,
    allergens: ALLERGENS,
    additives: ADDITIVES,
  });
});

module.exports = router;
