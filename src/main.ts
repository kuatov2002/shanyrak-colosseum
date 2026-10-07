// Standalone entry: mount the game on the page. Inside an iDos host the same mountGame() is called
// from the module's EngineScene (see idos/shanyrak/module.ts).
import { mountGame } from "./game";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");
mountGame(root);
