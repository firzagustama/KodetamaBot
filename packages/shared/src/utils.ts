// =============================================================================
// LEGACY EXPORTS - Maintain backward compatibility
// All functions are now in specialized modules but exported here for compatibility
// =============================================================================

// Export from modular utilities
export * from "./utils/index.js";

// Budget calculation utilities (moved to domain service, but keeping here for compatibility)
export { roundToThousands, calculatePercentage } from "./utils/currency.js";