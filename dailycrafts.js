const http = require("https");
const fs = require("fs");

const GW2API = "https://api.guildwars2.com/v2";
const NAME_TO_ID = {
  "Bolt of Damask": 46741,
  "Deldrimor Steel Ingot": 46738,
  "Elonian Leather Square": 46739,
  "Spiritwood Plank": 46736,
  "Grow Lamp": 66993,
  "Heat Stone": 67015,
};
const MIN_PROFIT = 100;
let NETWORK_CALLS = {};

const httpGet = (url) =>
  new Promise((res, rej) => {
    // TODO put this behind a debug flag
    // console.log("Calling: ", url);
    http.get(url, (result) => {
      let rawData = "";
      result.on("data", (chunk) => {
        rawData += chunk;
      });
      result.on("end", () => {
        try {
          const pathEnd =
            url.indexOf("?") > 0 ? url.indexOf("?") : url.lastIndexOf("/");
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

async function getCost() {
  return Promise.resolve({
    // https://gw2efficiency.com/crafting/calculator/a~1!b~0!c~0!d~1-46741;1-46738;1-46739;1-46736;1-80714;1-80775;1-80723;1-80791;1-74042;1-66913;1-66993;1-67015;1-66917;1-66923
    // TODO need to fetch this in real time
    cost: 222260,
  });
}

async function getPrices(ids) {
  const results = await Promise.all(
    Object.values(makeBatches(ids, 200)).map(async (ids) => {
      const url = `${GW2API}/commerce/prices?ids=${ids}`;
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

async function main() {
  const prices = await getPrices(Object.values(NAME_TO_ID));
  const costToCraft = await getCost();
  const totalSellValue = Object.values(prices).reduce(
    (acc, d) => acc + d.buyPrice,
    0
  );

  console.table(
    Object.entries(NAME_TO_ID).map((d) => ({
      item: d[0],
      sellValue: prices[d[1]].buyPrice,
    }))
  );
  console.log(
    `Additional Costs: ${costToCraft.cost}. Profit: ${
      totalSellValue - costToCraft.cost
    }`
  );
}

main();
