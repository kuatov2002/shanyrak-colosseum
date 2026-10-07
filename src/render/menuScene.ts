// Decorative campus behind the menus: the player's last crowned tower (or a starter campus),
// gently swaying, windows lit, the shanyrak glowing on top.

import { BALANCE } from "../config/balance";
import { Tower } from "../gameplay/tower";
import type { Debris, FloatText } from "../gameplay/types";
import type { Equipped } from "../meta/collection";
import type { RoomId } from "../meta/rooms";
import type { FacultyId } from "../social/faculties";
import type { WorldView } from "./renderer";

const STARTER: RoomId[] = ["dorm", "chaikhana", "library", "canteen", "dorm", "gym", "garden"];

export class MenuScene implements WorldView {
  t = 0;
  tower = new Tower();
  hanging = null;
  crane = { x: 0, tilt: 0 };
  falling = null;
  debris: Debris[] = [];
  floats: FloatText[] = [];
  event = null;
  wind = 0;
  windDir = 1;
  shabytLevel = 0;
  danger = false;
  flash = 0;
  shake = 0;
  phase = "menu";
  crownT = 99;
  crowned = true;
  students = 40;
  isTutorial = false;
  eff = { teaBreak: 0 };
  cfg: { faculty: FacultyId | null; cosmetics: Equipped; weather?: "clear" };

  constructor(rooms: RoomId[] | null, faculty: FacultyId | null, cosmetics: Equipped) {
    this.cfg = { faculty, cosmetics };
    this.rebuild(rooms);
  }

  get height(): number {
    return this.tower.floors - 1;
  }

  rebuild(rooms: RoomId[] | null): void {
    this.tower = new Tower();
    const list = rooms && rooms.length >= 3 ? rooms.slice(0, 8) : STARTER;
    this.tower.add("foundation", 0, BALANCE.world.foundationW, "perfect", 0, 0);
    list.forEach((type, i) => {
      const w = Math.round(BALANCE.world.baseRoomW * (type === "foundation" ? 1 : 1) * (0.95 + ((i * 7) % 5) * 0.03));
      const x = Math.sin(i * 1.7) * 6;
      const b = this.tower.add(type, x, w, "perfect", 4, 0);
      b.shown = 2 + (i % 4);
      b.squash = 0;
    });
    this.students = list.length * 5;
  }

  update(dt: number): void {
    this.t += dt;
    this.tower.update(dt, 3, 0);
  }
}
