const http = require("https");

const GW2API = "https://api.guildwars2.com/v2";
const IDS = [
  19721,
  24277,
  44941,
  19723,
  19726,
  19727,
  19724,
  19722,
  19725,
  19718,
  19739,
  19741,
  19743,
  19748,
  19745,
  19719,
  19728,
  19730,
  19731,
  19729,
  19732,
  19697,
  19699,
  19703,
  19698,
  19702,
  19700,
  19701,
];

/**
 * Source: https://gw2efficiency.com/crafting/zephyrite-supply-boxes
 * 
    Array.from(document.querySelectorAll('.eff-Table > tbody > tr > td > div > div:nth-child(2)'))
      .map(t => t.textContent)
      .filter(t => t != 'per box')
      .map(t => [t.substr(0,t.indexOf(' ')-1), t.substr(t.indexOf(' ')+1)])
      .reduce((acc, ts) => {acc[ts[1]] = parseInt(ts[0]); return acc;}, {})
 */
const BOX_PRICES = {
  "Soft Wood Log": 23,
  "Elder Wood Log": 9,
  "Platinum Ore": 11,
  "Mithril Ore": 17,
  "Linen Scrap": 11,
  "Iron Ore": 11,
  "Thick Leather Section": 15,
  "Rugged Leather Section": 4,
  "Rawhide Leather Section": 23,
  "Coarse Leather Section": 10,
  "Cotton Scrap": 13,
  "Silk Scrap": 32,
  "Hard Wood Log": 23,
  "Seasoned Wood Log": 18,
  "Pile of Crystalline Dust": 1,
  "Gold Ore": 32,
  "Jute Scrap": 17,
  "Silver Ore": 54,
  "Glob of Ectoplasm": 0.6666, // Note you get 3 for 2, so 0.6666 for 1
  "Thin Leather Section": 9,
  "Ancient Wood Log": 8,
  "Copper Ore": 18,
  "Gossamer Scrap": 16,
  "Hardened Leather Section": 2,
  "Green Wood Log": 64,
  "Watchwork Sprocket": 7,
  "Orichalcum Ore": 13,
  "Wool Scrap": 14,
};

const httpGet = (url) =>
  new Promise((res, rej) => {
    console.log("Calling: ", url);
    http.get(url, (result) => {
      let rawData = "";
      result.on("data", (chunk) => {
        rawData += chunk;
      });
      result.on("end", () => {
        try {
          const parsedData = JSON.parse(rawData);
          res(parsedData);
        } catch (e) {
          console.error(e.message);
        }
      });
    });
  });

async function getTranslates() {
  const url = `${GW2API}/items?ids=${IDS.join(",")}`;
  let res = await httpGet(url);
  return res.reduce((acc, d) => {
    acc[d.id] = { name: d.name, id: d.id };
    return acc;
  }, {});
}

async function getPrices() {
  const url = `${GW2API}/commerce/prices?ids=${IDS.join(",")}`;
  let res = await httpGet(url);
  return res.reduce((acc, d) => {
    acc[d.id] = {
      buyPrice: d.buys.unit_price,
      sellPrice: d.sells.unit_price,
      id: d.id,
    };
    return acc;
  }, {});
}

async function getBoxValue() {
  return Promise.resolve({
    // Based on non-super rare results https://wiki.guildwars2.com/wiki/Zephyrite_Supply_Box/Drop_rate
    // TODO need to fetch this in real time
    boxSellNowValue: 372,
    boxSellOrderValue: 403,
  });
}

async function main() {
  const prices = await getPrices();
  const trans = await getTranslates();
  const boxVal = await getBoxValue();

  // Combine all our data for computation
  const joinedData = IDS.map((id) => {
    const name = trans[id].name;
    return {
      id,
      name,
      unitsForBox: BOX_PRICES[name],
      itemBuyNowPrice: prices[id].buyPrice,
      itemPlaceOrderPrice: prices[id].sellPrice,
    };
  }).map((d) => ({
    ...d,
    boxBuyNowCost: Math.ceil(d.itemBuyNowPrice * d.unitsForBox),
    boxPlaceOrderCost: Math.ceil(d.itemPlaceOrderPrice * d.unitsForBox),
  }))
  .sort((a, b) => a.boxBuyNowCost - b.boxBuyNowCost)
  .map(d => ({
    ...d,
    ...boxVal,
    canFlipBuying: boxVal.boxSellNowValue >= d.boxBuyNowCost,
  }))

  // Print
  console.table(joinedData);
}

main();
