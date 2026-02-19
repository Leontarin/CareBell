//backend/tests/jest.setup.js
process.env.NODE_ENV = 'test';
process.env.SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET || 'test-secret';

jest.mock('../../shared/constants/foodMeta.utils.js', () => ({
  derivePictogramsFromAllergens: jest.fn(() => []),
  mergePictograms: jest.fn(() => [])
}));
jest.mock('../../shared/constants/foodMeta.js', () => ({}));

// Make admin-only routes pass in tests
jest.mock('../middleware/isAdmin', () => {
  return async (req, _res, next) => {
    req.user = { _id: 'admin-oid', id: 'admin', fullName: 'Admin' };
    req.admin = { userId: 'admin-oid' };
    next();
  };
});

jest.setTimeout(30000);
