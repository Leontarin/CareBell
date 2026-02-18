//backend/tests/jest.setup.js

process.env.NODE_ENV = 'test';

jest.mock('../../shared/constants/foodMeta.utils.js', () => ({
  derivePictogramsFromAllergens: jest.fn(() => []),
  mergePictograms: jest.fn(() => [])
}));

jest.mock('../../shared/constants/foodMeta.js', () => ({}));

jest.mock('../lib/session', () => ({
  readSession: jest.fn(async () => ({
    userId: 'test-user',
    fullName: 'Test User'
  }))
}));

//Make admin-only routes pass in tests (default allow)
jest.mock('../middleware/isAdmin', () => {
  return async (req, _res, next) => {
    req.user = { _id: 'test-user', fullName: 'Test User' };
    req.admin = { userId: 'test-user' };
    next();
  };
});