# API helper for finding opportunities #

## explore-ops ##

- See if there's anything on the TP to flip
- Run it and the output will be the top most profitable crafts it could find.
- Only looks 1 deep in the craft tree ATM

## Daily Crafts ##

- Follow the link to GW2Efficiency to see what the cost of crafting is
- Input that into getCost()
- Run script to see what each will sell for and what the total profit will be

## Supply Boxes ##
### Fetch Prices  ###

```
https://api.guildwars2.com/v2/commerce/prices?ids=19721,24277,44941,19723,19726,19727,19724,19722,19725,19718,19739,19741,19743,19748,19745,19719,19728,19730,19731,19729,19732,19697,19699,19703,19698,19702,19700,19701

[
  {
    "id": 19701,
    "whitelisted": true,
    "buys": {
      "quantity": 356798,
      "unit_price": 159
    },
    "sells": {
      "quantity": 1911995,
      "unit_price": 160
    }
  },
  ...
]
```

### Translate Id to Name ###

```
https://api.guildwars2.com/v2/items?ids=19721,24277,44941,19723,19726,19727,19724,19722,19725,19718,19739,19741,19743,19748,19745,19719,19728,19730,19731,19729,19732,19697,19699,19703,19698,19702,19700,19701

[
  {
    "name": "Orichalcum Ore",
    "description": "Refine into Ingots.",
    "type": "CraftingMaterial",
    "level": 0,
    "rarity": "Basic",
    "vendor_value": 8,
    "game_types": [
      "Activity",
      "Wvw",
      "Dungeon",
      "Pve"
    ],
    "flags": [],
    "restrictions": [],
    "id": 19701,
    "chat_link": "[&AgH1TAAA]",
    "icon": "https://render.guildwars2.com/file/A6E2C82153BA684E2D05D3FCA09F3E02431366ED/220461.png"
  },
  ...
]
```

### Pull Box Costs ###

```
https://gw2efficiency.com/crafting/zephyrite-supply-boxes
Array.from(document.querySelectorAll('.eff-Table > tbody > tr > td > div > div:nth-child(2)'))
  .map(t => t.textContent)
  .filter(t => t != 'per box')
  .map(t => [t.substr(0,t.indexOf(' ')-1), t.substr(t.indexOf(' ')+1)])
  .reduce((acc, ts) => {acc[ts[1]] = parseInt(ts[0]); return acc;}, {})

{
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
  "Glob of Ectoplasm": 2,
  "Thin Leather Section": 9,
  "Ancient Wood Log": 8,
  "Copper Ore": 18,
  "Gossamer Scrap": 16,
  "Hardened Leather Section": 2,
  "Green Wood Log": 64,
  "Watchwork Sprocket": 7,
  "Orichalcum Ore": 13,
  "Wool Scrap": 14
}
```