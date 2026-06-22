const { runDataLoadingIdle } = require('./logistics-data-loading-map-qa-common.cjs');

runDataLoadingIdle().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
