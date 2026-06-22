const { runMapProviderMatrix } = require('./logistics-data-loading-map-qa-common.cjs');

runMapProviderMatrix().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
