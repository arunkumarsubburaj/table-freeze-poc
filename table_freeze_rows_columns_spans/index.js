/**
 * Public API Export
 * Main entry point for the Table Freeze Controller module
 * 
 * @module index
 */

export { default } from './table-freeze-controller.js';
export { default as TableFreezeController } from './table-freeze-controller.js';

// Re-export utilities for advanced usage
export * from './utils/dom-helpers.js';
export * from './utils/measurements.js';
export * from './utils/freeze-appliers.js';
export * from './utils/observers.js';
