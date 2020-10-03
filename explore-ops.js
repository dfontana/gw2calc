const http = require("https");
const fs = require("fs");
const GW2API = "https://api.guildwars2.com/v2";

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
          const pathEnd = url.indexOf("?") > 0 ? url.indexOf("?") : url.lastIndexOf("/");
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


function readStore(fileName) {
  try {
    return JSON.parse(fs.readFileSync(`./cache/${fileName}.json`, "utf8"));
  } catch (err) {
    console.error(err);
    return false;
  }
}

function writeStore(data, name) {
  try {
    fs.writeFileSync(`./cache/${name}.json`, JSON.stringify(data));
  } catch (err) {
    console.error(err);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    console.log(`Sleeping ${ms}ms`);
    setTimeout(resolve, ms);
  });
}

function toHumanCoin(coins) {
  let gold = 0,
    silver = 0,
    copper = coins;
  if (coins >= 100) {
    copper = coins % 100;
    coins = Math.floor(coins / 100);
    silver = coins;
    if (coins >= 100) {
      silver = coins % 100;
      coins = Math.floor(coins / 100);
      gold = coins;
    }
  }
  const s = `${silver}`.padStart(2, "0");
  const c = `${copper}`.padStart(2, "0");
  const g = `${gold}`.padStart(2, "0");
  return `${g}g ${s}s ${c}c`;
}


function makeBatches(list, groupSize) {
  return list.reduce((acc, item, idx) => {
    const rowNum = Math.floor(idx / groupSize) + 1;
    acc[rowNum] = acc[rowNum] || [];
    acc[rowNum].push(item);
    return acc;
  }, {});
}

function getFlipValue(totalCost, totalValue) {
  const listingFee = Math.max(totalValue * 0.05, 1);
  const exchangeFee = Math.max(totalValue * 0.1, 1);
  const revenue = Math.floor(totalValue - listingFee - exchangeFee);
  if (revenue >= Math.ceil(totalCost * 1.05)) {
    return { rev: revenue, profit: revenue - totalCost };
  }
  return { rev: 0, profit: 0 };
}


async function getAllIds() {
  const url = `${GW2API}/commerce/prices`;
  let res = await httpGet(url);
  return res;
}

async function getRecipe(itemId) {
  const url = `${GW2API}/recipes/search?output=${itemId}`;
  let res = await httpGet(url);
  return res;
}

async function getListings(ids) {
  const results = await Promise.all(
    Object.values(makeBatches(ids, 200)).map(async (ids) => {
      const url = `${GW2API}/commerce/listings?ids=${ids}`;
      return await httpGet(url);
    })
  );
  return results.reduce((acc, res) => {
    res.forEach((d) => {
      acc[d.id] = {
        buys: d.buys
          .map((i) => ({ count: i.quantity, price: i.unit_price }))
          .sort((a, b) => b.price - a.price),
        sells: d.sells.map((i) => ({ count: i.quantity, price: i.unit_price })),
        id: d.id,
      };
    });
    return acc;
  }, {});
}

async function getAllTradeableCraftableIds() {
  let allIds = readStore("ids");
  if (!allIds) {
    allIds = await getAllIds();
    writeStore(allIds, "ids");
  }

  const groups = makeBatches(allIds, 500);

  let acc = readStore("allRecs");
  if (!acc) {
    acc = {};
    for (const [key, batch] of Object.entries(groups)) {
      let recs = readStore(`batch_${batch[0]}`);
      if (!recs) {
        recs = await Promise.all(batch.map((i) => getRecipe(i)));
        writeStore(recs, `batch_${batch[0]}`);
        for (let i = 0; i < recs.length; i++) {
          if (recs[i].length !== 0) {
            acc[batch[i]] = recs[i];
          } else {
            console.log("Removing", batch[i]);
            allIds = allIds.filter((id) => id !== batch[i]);
          }
        }
        writeStore(allIds, "ids");
      } else {
        for (let i = 0; i < recs.length; i++) {
          if (recs[i].length !== 0) {
            acc[batch[i]] = recs[i];
          }
        }
      }
      console.log("Ids left:", allIds.length);
      await sleep(90000);
    }
    writeStore(acc, "allRecs");
  }

  console.log(`${Object.keys(acc).length} ids loaded.`);
  return acc;
}


async function expandRecipes(recipes) {
  const url = `${GW2API}/recipes?ids=${recipes.map((r) => r.recipeId)}`;
  const recs = await httpGet(url);
  return recs
    .filter((res) => !res.guild_ingredients)
    .filter((res) => !res.flags.includes("LearnedFromItem"))
    .map((res) => ({
      makesItemId: res.output_item_id,
      viaRecpipe: res.id,
      items: res.ingredients.map((i) => ({ itemId: i.item_id, needed: i.count })),
      count: res.output_item_count,
    }));
}


/**
 * TODO we're leaving a fair bit on the table here by choosing not to explore crafting vs purchasing
 * anything below the first level down in ingredients. We could expand this algorithm further to fetch
 * all recipes, check all prices, and compare - but for now here's a start.
 */
function filterUnusableRecipes(recipes, listings) {
  return recipes
    .filter(({ items }) => !items.some(({ itemId }) => !listings[itemId]?.sells.length))
    .map(({ items, ...rest }) => {
      const newItems = items.map((item) => ({
        ...item,
        costPer: listings[item.itemId].sells[0].price,
      }));
      const totalValue = rest.count * (listings[rest.makesItemId].buys?.[0]?.price || 0);
      const totalCost = newItems.reduce((acc, { costPer, needed }) => costPer * needed + acc, 0);
      return { ...rest, items: newItems, buyNowCost: totalCost, sellNowValue: totalValue };
    });
}

function filterUnfeasibleProfits(recipes, listings) {
  return recipes
    .map((item) => {
      const { makesItemId, buyNowCost, sellNowValue } = item;
      const { rev, profit } = getFlipValue(buyNowCost, sellNowValue);
      let sum = 0;
      for (const { count, price } of listings[makesItemId].buys) {
        if (price <= rev) {
          break;
        }
        sum += count;
      }
      return {
        ...item,
        sellNowUnits: sum,
        minSellNow: rev,
        sellNowProfit: profit,
      };
    })
    .filter(({ sellNowUnits, sellNowProfit }) => {
      if (sellNowProfit <= MIN_PROFIT) {
        return false;
      }
      if (sellNowProfit <= 300) {
        return sellNowUnits > 100;
      }
      if (sellNowProfit <= 1000) {
        return sellNowUnits > 10;
      }
      if (sellNowProfit <= 5000) {
        return sellNowUnits > 5;
      }
      if (sellNowProfit <= 10000) {
        return sellNowUnits > 2;
      }
      return true;
    });
}

async function main() {
  // Item Id => [RecipeId]
  let allRecipes = await getAllTradeableCraftableIds();
  let recipes = Object.values(allRecipes).map((recipeIds) => ({ recipeId: recipeIds[0] }));

  // Expand each recipe into it's pieces
  recipes = await Promise.all(Object.values(makeBatches(recipes, 200)).map(expandRecipes));
  recipes = recipes.reduce((acc, batch) => [...acc, ...batch], []);

  const allItemsToGet = recipes.reduce((acc, { makesItemId, items }) => {
    acc[makesItemId] = 1;
    items.forEach((item) => (acc[item.itemId] = 1));
    return acc;
  }, {});

  const listings = await getListings(Object.keys(allItemsToGet));

  // Remove the ones we can't do anything with
  // And figure out which are profitable
  recipes = filterUnusableRecipes(recipes, listings);
  recipes = filterUnfeasibleProfits(recipes, listings);

  console.log("Network", NETWORK_CALLS);

  console.table(
    recipes
      .sort((a, b) => b.sellNowProfit - a.sellNowProfit)
      .map((record) => ({
        ...record,
        items:
          record.items.length <= 2
            ? JSON.stringify(
                record.items.map((it) => ({ id: it.itemId, ct: it.needed, cp: it.costPer }))
              )
            : "...",
        buyNowCost: toHumanCoin(record.buyNowCost),
        sellNowValue: toHumanCoin(record.sellNowValue),
        sellNowUnits: record.sellNowUnits,
        minSellNow: toHumanCoin(record.minSellNow),
        sellNowProfit: toHumanCoin(record.sellNowProfit),
      }))
  );
}

main();