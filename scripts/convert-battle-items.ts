/// Convert the battle items from items.js to a JSON file

import { writeFileSync } from "fs";
import { BattleItems } from "./items";

// Write the JSON
const json = JSON.stringify(BattleItems, null, 2);
writeFileSync("../battleItems.json", json);
