#!/usr/bin/env node
//backend/scripts/backfill-language-settings.js
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("../models/user");
const { normalizeUserLanguage, derivePreferredLanguage, getCountryConfig } = require("../lib/language");

// Load environment configuration (mirrors backend/api/index.js behaviour)
if (!process.env.DOCKER_ENV) {
  const baseEnv = path.join(__dirname, "..", ".env");
  if (fs.existsSync(baseEnv)) {
    dotenv.config({ path: baseEnv });
  }

  const localEnv = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(localEnv)) {
    dotenv.config({ path: localEnv, override: true });
  }
}

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set. Please configure your MongoDB connection string.");
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5_000,
  });

  const users = await User.find();
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const before = {
        country: user.country,
        language: user.language,
        languages: Array.isArray(user.languages) ? [...user.languages] : undefined,
      };

      // Ensure we always have a reasonable preferred language before normalising.
      let preferred = derivePreferredLanguage(user);
      if (!preferred) {
        const config = getCountryConfig(before.country);
        if (config) {
          preferred = config.default || config.languages[0];
        }
      }
      if (!preferred) {
        user.language = undefined;
      }

      const { changed } = normalizeUserLanguage(user);
      if (changed) {
        await user.save();
        updated += 1;
        console.log(
          `✅ Updated ${user.id || user._id.toString()} -> ${user.language} [${user.languages.join(", ")}]`
        );
      } else {
        skipped += 1;
      }
    } catch (err) {
      errors += 1;
      console.error(`❌ Failed to update ${user.id || user._id.toString()}:`, err.message);
    }
  }

  await mongoose.disconnect();

  console.log("Migration complete:");
  console.log(`  Updated: ${updated}`);
  console.log(`  Already OK: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

migrate()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
