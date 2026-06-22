const { runDataLoadingStability } = require('./logistics-data-loading-map-qa-common.cjs');

runDataLoadingStability().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
