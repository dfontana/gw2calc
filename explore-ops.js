const {makeBatches, cache, toHumanCoin, sleep} = require('./utils')
const {api, printCalls} = require('./api');
const MIN_PROFIT = 100;


function getFlipValue(totalCost, totalValue) {
  const listingFee = Math.max(totalValue * 0.05, 1);
  const exchangeFee = Math.max(totalValue * 0.1, 1);
  const revenue = Math.floor(totalValue - listingFee - exchangeFee);
  if (revenue >= Math.ceil(totalCost * 1.05)) {
    return { rev: revenue, profit: revenue - totalCost };
  }
  return { rev: 0, profit: 0 };
}


async function getAllTradeableCraftableIds() {
  let allIds = cache.readStore("ids");
  if (!allIds) {
    allIds = await api.getAllIds();
    cache.writeStore(allIds, "ids");
  }

  const groups = makeBatches(allIds, 500);

  let acc = cache.readStore("allRecs");
  if (!acc) {
    acc = {};
    for (const [key, batch] of Object.entries(groups)) {
      let recs = cache.readStore(`batch_${batch[0]}`);
      if (!recs) {
        recs = await Promise.all(batch.map((i) => api.getRecipe(i)));
        cache.writeStore(recs, `batch_${batch[0]}`);
        for (let i = 0; i < recs.length; i++) {
          if (recs[i].length !== 0) {
            acc[batch[i]] = recs[i];
          } else {
            console.log("Removing", batch[i]);
            allIds = allIds.filter((id) => id !== batch[i]);
          }
        }
        cache.writeStore(allIds, "ids");
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
    cache.writeStore(acc, "allRecs");
  }

  console.log(`${Object.keys(acc).length} ids loaded.`);
  return acc;
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
  recipes = await Promise.all(Object.values(makeBatches(recipes, 200)).map(api.expandRecipes));
  recipes = recipes.reduce((acc, batch) => [...acc, ...batch], []);

  const allItemsToGet = recipes.reduce((acc, { makesItemId, items }) => {
    acc[makesItemId] = 1;
    items.forEach((item) => (acc[item.itemId] = 1));
    return acc;
  }, {});

  const listings = await api.getListings(Object.keys(allItemsToGet));

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