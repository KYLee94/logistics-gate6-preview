const { runMarketMapPinpoint } = require('./logistics-data-loading-map-qa-common.cjs');

runMarketMapPinpoint().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
