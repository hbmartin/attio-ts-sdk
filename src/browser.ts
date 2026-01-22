// Browser adapter. Re-export core utilities; avoid Node-only APIs.
export { add, getRandomId, greet } from './internal';
export * from './generated';
export * from './attio';
