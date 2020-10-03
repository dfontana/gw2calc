const fs = require('fs');

/**
 * Break the given list into groups of GroupSize lists, returning {groupId => [subList], ...}
 */
function makeBatches(list, groupSize) {
  return list.reduce((acc, item, idx) => {
    const rowNum = Math.floor(idx / groupSize) + 1;
    acc[rowNum] = acc[rowNum] || [];
    acc[rowNum].push(item);
    return acc;
  }, {});
}

function readStore(fileName) {
  try {
    return JSON.parse(fs.readFileSync(`./cache/${fileName}.json`, 'utf8'));
  } catch (err) {
    console.error(err);
    return false;
  }
}

function writeStore(data, name) {
  try {
    if (!fs.existsSync('./cache')) {
      fs.mkdirSync('./cache');
    }
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
  const s = `${silver}`.padStart(2, '0');
  const c = `${copper}`.padStart(2, '0');
  const g = `${gold}`.padStart(2, '0');
  return `${g}g ${s}s ${c}c`;
}

module.exports = {
  makeBatches,
  sleep,
  toHumanCoin,
  cache: {
    read: readStore,
    write: writeStore,
  },
};
