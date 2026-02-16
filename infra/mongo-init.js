// This script is executed by MongoDB on first startup if the data directory is empty.
// It uses the environment variables from docker-compose to create the app user.

const appUser  = process.env.MONGO_APP_USER;
const appPass  = process.env.MONGO_APP_PASS;
const dbName   = process.env.MONGO_DB || 'CareBell';

if (!appUser || !appPass) {
  print('⚠ WARNING: MONGO_APP_USER or MONGO_APP_PASS not set. No user created.');
} else {
  const appDb = db.getSiblingDB(dbName);
  appDb.createUser({
    user: appUser,
    pwd: appPass,
    roles: [
      { role: 'readWrite', db: dbName }
    ]
  });
  print(`✅ Created database '${dbName}' and user '${appUser}' with readWrite role.`);
}

