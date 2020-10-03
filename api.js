const http = require('https');
const { makeBatches } = require('./utils');
const GW2API = 'https://api.guildwars2.com/v2';

let NETWORK_CALLS = {};

/**
 * Make an HTTP GET call, recording it to the static NETWORK_CALLS list
 */
function httpGet(url) {
  return new Promise((res, rej) => {
    // TODO put this behind a debug flag
    // console.log("Calling: ", url);
    http.get(url, (result) => {
      let rawData = '';
      result.on('data', (chunk) => {
        rawData += chunk;
      });
      result.on('end', () => {
        try {
          const pathEnd = url.indexOf('?') > 0 ? url.indexOf('?') : url.lastIndexOf('/');
          const path = url.substring(29, pathEnd);
          NETWORK_CALLS[path] = (NETWORK_CALLS[path] || 0) + 1;
          const parsedData = JSON.parse(rawData);
          res(parsedData);
        } catch (e) {
          console.error(e.message);
        }
      });
    });
  });
}

/**
 * Fetch the prices on the TP for the given item ids
 *
 * @param {array} ids
 */
async function getPrices(ids) {
  const results = await Promise.all(
    Object.values(makeBatches(ids, 200)).map(async (ids) => {
      const url = `${GW2API}/commerce/prices?ids=${ids.join(',')}`;
      return await httpGet(url);
    })
  );
  return results.reduce((acc, res) => {
    res.forEach((d) => {
      acc[d.id] = {
        buyPrice: d.buys.unit_price,
        buyQuantity: d.buys.quantity,
        sellPrice: d.sells.unit_price,
        sellQuantity: d.sells.quantity,
        id: d.id,
      };
    });
    return acc;
  }, {});
}

/**
 * Translate the given ids into their names
 *
 * @param array ids
 */
async function getTranslates(ids) {
  const url = `${GW2API}/items?ids=${ids.join(',')}`;
  let res = await httpGet(url);
  return res.reduce((acc, d) => {
    acc[d.id] = { name: d.name, id: d.id };
    return acc;
  }, {});
}

/**
 * Print calls that occured
 */
function printCalls() {
  console.log(NETWORK_CALLS);
}

module.exports = {
  printCalls,
  api: { getPrices, getTranslates },
};
