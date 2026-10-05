export const SIZE = 48,
  STEP = 0.2;
export const STRUCTURES = {
  hub: {
    name: "Landing core",
    icon: "⌂",
    cost: 0,
    power: 16,
    range: 8,
    description: "Emergency refinery, charging and colony storage.",
  },
  solar: {
    name: "Solar array",
    icon: "☀",
    cost: 10,
    power: 14,
    range: 7,
    description: "Produces 14 power. Connect within a network ring.",
  },
  relay: {
    name: "Power relay",
    icon: "⌁",
    cost: 5,
    power: 0,
    range: 8,
    description: "Extends the connected power network.",
  },
  charger: {
    name: "Charging dock",
    icon: "ϟ",
    cost: 8,
    power: -2,
    range: 5,
    description: "A nearby place to recharge. Keeps miners in the field.",
  },
  storage: {
    name: "Cargo depot",
    icon: "▤",
    cost: 8,
    power: 0,
    range: 0,
    description: "Local ore drop-off. Haulers move ore to a refinery.",
  },
  refinery: {
    name: "Refinery",
    icon: "♨",
    cost: 16,
    power: -4,
    range: 4,
    description: "Smelts 2 ore into 1 alloy every 3 seconds.",
  },
  mine: {
    name: "Mining rig",
    icon: "⛏",
    cost: 18,
    power: -3,
    range: 4,
    tech: "industry",
    description: "Extracts nearby ore into its buffer. Needs a hauler.",
  },
  factory: {
    name: "Fabricator",
    icon: "⬡",
    cost: 22,
    power: -4,
    range: 4,
    tech: "industry",
    description: "Converts 3 alloy into a component. Haulers supply it.",
  },
  lab: {
    name: "Research lab",
    icon: "⚗",
    cost: 14,
    power: -3,
    range: 4,
    description: "Enables research. Consumes delivered alloy for data.",
  },
  turret: {
    name: "Sentinel",
    icon: "⌖",
    cost: 16,
    power: -3,
    range: 4,
    tech: "defense",
    description: "Automatically attacks threats within 6 tiles.",
  },
  bay: {
    name: "Drone foundry",
    icon: "✥",
    cost: 20,
    power: -4,
    range: 4,
    tech: "industry",
    description: "Assemble drones from 3 delivered components.",
  },
  beacon: {
    name: "Signal beacon",
    icon: "◎",
    cost: 50,
    power: -8,
    range: 5,
    tech: "signal",
    description:
      "Consumes 10 components to reconnect with orbit. Your final objective.",
  },
};
export const TECH = {
  industry: {
    name: "Industrial systems",
    cost: 12,
    description: "Mining rigs, fabricators and drone foundries.",
  },
  defense: {
    name: "Adaptive defense",
    cost: 18,
    description: "Automated sentinel towers defend the power network.",
  },
  logic: {
    name: "Conditional intelligence",
    cost: 22,
    description: "Health, storage and ally-threat conditions.",
  },
  signal: {
    name: "Orbital uplink",
    cost: 40,
    requires: "industry",
    description: "Build the signal beacon and transmit to orbit.",
  },
};
export const CONDITIONS = {
  low: "Battery < 25%",
  cargo: "Carrying cargo",
  enemy: "Threat nearby",
  always: "No higher priority task",
  hurt: "Health < 60%",
  full: "Storage full",
  ally: "Ally under attack",
};
export const ACTIONS = {
  charge: "Find charger",
  deliver: "Deliver cargo",
  mine: "Mine ore",
  haul: "Transport goods",
  explore: "Explore frontier",
  build: "Build / repair",
  retreat: "Retreat to core",
  fight: "Defend colony",
  wait: "Hold position",
};
export const ROLES = {
  miner: "Miner",
  hauler: "Hauler",
  explorer: "Explorer",
  builder: "Engineer",
  combat: "Sentinel",
};
export function rules(role) {
  return [
    { condition: "low", action: "charge" },
    { condition: "enemy", action: role === "combat" ? "fight" : "retreat" },
    { condition: "cargo", action: "deliver" },
    {
      condition: "always",
      action: {
        miner: "mine",
        hauler: "haul",
        explorer: "explore",
        builder: "build",
        combat: "fight",
      }[role],
    },
  ];
}
