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
