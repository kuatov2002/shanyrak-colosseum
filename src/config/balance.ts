// Every gameplay number in one place. Units: world units (a room is 60 tall), seconds.

export const BALANCE = {
  world: {
    blockH: 60,
    baseRoomW: 190,
    foundationW: 250,
    /** Height above the tower top where the crane hangs the next room. */
    hangAbove: 250,
    gravity: 2600,
  },

  crane: {
    omegaBase: 1.45,
    omegaPerFloor: 0.034,
    omegaMax: 3.3,
    ampBase: 105,
    ampPerFloor: 2.4,
    ampMax: 160,
    /** First floors are gentler. */
    gentleFloors: 6,
    gentleOmegaK: 0.82,
    gentleAmpK: 0.85,
    endlessGrowthK: 1.35,
    slowSwingPerLevel: 0.05,
    teaBreakK: 0.35,
  },

  quality: {
    perfectTol: 9,
    perfectTolGentle: 16,
    good: 0.12,
    normal: 0.25,
    bad: 0.4,
    balconyK: 1.45,
  },

  stability: {
    start: 100,
    max: 100,
    maxCap: 150,
    perUpgrade: 6,
    perfect: 4,
    good: 1,
    normal: -3,
    bad: -9,
    critical: -15,
    gentleK: 0.5,
    leanFree: 0.3,
    leanK: 26,
    gym: 12,
    gymMax: 10,
    danger: 30,
    deadlineDrainPerSec: 4,
    antiDeadlineK: 0.4,
    sessionPenaltyK: 1.5,
    builderTea: 35,
  },

  lives: 3,

  score: {
    base: 10,
    perfect: 20,
    good: 10,
    normal: 4,
    bad: 1,
    comboStep: 0.1,
    comboCap: 20,
    shabytAt: 5,
    shabytK: 1.5,
    shabyt2At: 10,
    shabyt2K: 2,
    libraryK: 1.5,
    examK: 2,
    sessionK: 1.5,
    garlandK: 2,
  },

  students: {
    perfectK: 1.5,
    goodK: 1.2,
    normalK: 1,
    badK: 0.6,
    synergyDorm: 3,
    magnetK: 1.5,
    perUpgrade: 0.1,
    festivalBonus: 3,
  },

  shai: {
    perfect: 2,
    comboMilestone: 5,
    chaiDorm: 5,
    canteenBonus: 8,
    perUpgrade: 0.08,
    crownBonusK: 1.25,
    dailyFirstK: 1.5,
    nauryzK: 1.5,
    sessionK: 1.5,
  },

  season: {
    perFloor: 2,
    perPerfect: 1,
    coworkingShare: 0.2,
    innovationDiv: 5,
  },

  faculty: {
    perBlock: 10,
    perfectK: 2,
    perFloorInFacultyMode: 2,
  },

  loot: {
    materialOnPerfect: 0.12,
    materialNauryz: 0.25,
    materialShabyt: 0.1,
    perUpgrade: 0.03,
    cosmeticDropHeight: 15,
    cosmeticDropChance: 0.22,
  },

  events: {
    firstFloor: 7,
    gapMin: 4,
    gapMax: 6,
    windAmpAdd: 38,
    windDrift: 55,
    gardenK: 0.25,
    gardenCap: 0.6,
    windbreakK: 0.5,
    durations: { wind: 4, deadline: 3, exam: 3, nauryz: 4, session: 4, festival: 3 } as Record<string, number>,
  },

  bonuses: {
    floors: [5, 11, 17, 24, 31, 38],
    /** After the listed floors, offer every this many floors. */
    gapAfter: 8,
    teaBreakBlocks: 2,
    wideCraneBlocks: 3,
    wideCraneK: 1.22,
    magnetBlocks: 5,
    garlandBlocks: 3,
    facultySpiritBlocks: 3,
  },

  rarityWeight: { common: 10, uncommon: 6, rare: 3, epic: 1.2, legendary: 0.4 },
  rareUpgradeK: 0.15,

  modes: {
    quickGoal: 30,
    crownMinFloors: 8,
  },

  collapse: {
    baseFallen: 2,
    perTenFloors: 1,
  },
} as const;

export type Balance = typeof BALANCE;
