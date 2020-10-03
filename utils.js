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

module.exports = {
  makeBatches,
};
