const { api, printCalls } = require('./api');

const NAME_TO_ID = {
  'Bolt of Damask': 46741,
  'Deldrimor Steel Ingot': 46738,
  'Elonian Leather Square': 46739,
  'Spiritwood Plank': 46736,
  'Grow Lamp': 66993,
  'Heat Stone': 67015,
};

async function getCost() {
  return Promise.resolve({
    // https://gw2efficiency.com/crafting/calculator/a~1!b~0!c~0!d~1-46741;1-46738;1-46739;1-46736;1-80714;1-80775;1-80723;1-80791;1-74042;1-66913;1-66993;1-67015;1-66917;1-66923
    // TODO need to fetch this in real time
    cost: 222260,
  });
}

async function main() {
  const prices = await api.getPrices(Object.values(NAME_TO_ID));
  const costToCraft = await getCost();
  const totalSellValue = Object.values(prices).reduce((acc, d) => acc + d.buyPrice, 0);

  console.table(
    Object.entries(NAME_TO_ID).map((d) => ({
      item: d[0],
      sellValue: prices[d[1]].buyPrice,
    }))
  );
  console.log(
    `Additional Costs: ${costToCraft.cost}. Profit: ${totalSellValue - costToCraft.cost}`
  );
  printCalls();
}

main();
