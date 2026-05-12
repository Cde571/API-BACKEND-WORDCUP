require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mundial2026";

/**
 * Orden real por posición de sorteo:
 * 1 vs 2, 3 vs 4
 * 1 vs 3, 4 vs 2
 * 4 vs 1, 2 vs 3
 */
const GROUPS = {
  A: [
    ["Mexico", "MEX", "CONCACAF"],
    ["South Africa", "RSA", "CAF"],
    ["South Korea", "KOR", "AFC"],
    ["Czechia", "CZE", "UEFA"],
  ],
  B: [
    ["Canada", "CAN", "CONCACAF"],
    ["Bosnia and Herzegovina", "BIH", "UEFA"],
    ["Qatar", "QAT", "AFC"],
    ["Switzerland", "SUI", "UEFA"],
  ],
  C: [
    ["Brazil", "BRA", "CONMEBOL"],
    ["Morocco", "MAR", "CAF"],
    ["Haiti", "HAI", "CONCACAF"],
    ["Scotland", "SCO", "UEFA"],
  ],
  D: [
    ["United States", "USA", "CONCACAF"],
    ["Paraguay", "PAR", "CONMEBOL"],
    ["Australia", "AUS", "AFC"],
    ["Türkiye", "TUR", "UEFA"],
  ],
  E: [
    ["Germany", "GER", "UEFA"],
    ["Curaçao", "CUW", "CONCACAF"],
    ["Côte d'Ivoire", "CIV", "CAF"],
    ["Ecuador", "ECU", "CONMEBOL"],
  ],
  F: [
    ["Netherlands", "NED", "UEFA"],
    ["Japan", "JPN", "AFC"],
    ["Sweden", "SWE", "UEFA"],
    ["Tunisia", "TUN", "CAF"],
  ],
  G: [
    ["Belgium", "BEL", "UEFA"],
    ["Egypt", "EGY", "CAF"],
    ["Iran", "IRN", "AFC"],
    ["New Zealand", "NZL", "OFC"],
  ],
  H: [
    ["Spain", "ESP", "UEFA"],
    ["Cape Verde", "CPV", "CAF"],
    ["Saudi Arabia", "KSA", "AFC"],
    ["Uruguay", "URU", "CONMEBOL"],
  ],
  I: [
    ["France", "FRA", "UEFA"],
    ["Senegal", "SEN", "CAF"],
    ["Iraq", "IRQ", "AFC"],
    ["Norway", "NOR", "UEFA"],
  ],
  J: [
    ["Argentina", "ARG", "CONMEBOL"],
    ["Algeria", "ALG", "CAF"],
    ["Austria", "AUT", "UEFA"],
    ["Jordan", "JOR", "AFC"],
  ],
  K: [
    ["Portugal", "POR", "UEFA"],
    ["Congo DR", "COD", "CAF"],
    ["Uzbekistan", "UZB", "AFC"],
    ["Colombia", "COL", "CONMEBOL"],
  ],
  L: [
    ["England", "ENG", "UEFA"],
    ["Croatia", "CRO", "UEFA"],
    ["Ghana", "GHA", "CAF"],
    ["Panama", "PAN", "CONCACAF"],
  ],
};

const GROUP_START_DATES = {
  A: "2026-06-11T15:00:00-05:00",
  B: "2026-06-12T15:00:00-05:00",
  C: "2026-06-13T18:00:00-04:00",
  D: "2026-06-12T18:00:00-07:00",
  E: "2026-06-14T12:00:00-05:00",
  F: "2026-06-14T15:00:00-05:00",
  G: "2026-06-15T15:00:00-07:00",
  H: "2026-06-15T12:00:00-04:00",
  I: "2026-06-16T15:00:00-04:00",
  J: "2026-06-16T19:00:00-05:00",
  K: "2026-06-17T15:00:00-05:00",
  L: "2026-06-17T18:00:00-05:00",
};

const VENUES = {
  A: ["Mexico City", "Guadalajara", "Atlanta", "Guadalajara", "Monterrey", "Mexico City"],
  B: ["Toronto", "Santa Clara", "Inglewood", "Vancouver", "Vancouver", "Seattle"],
  C: ["East Rutherford", "Foxborough", "Miami", "Atlanta", "Miami", "East Rutherford"],
  D: ["Inglewood", "Vancouver", "Seattle", "Kansas City", "Santa Clara", "Inglewood"],
  E: ["Houston", "Philadelphia", "Toronto", "Miami", "Philadelphia", "Houston"],
  F: ["Arlington", "Monterrey", "Kansas City", "Toronto", "Guadalajara", "Arlington"],
  G: ["Seattle", "Inglewood", "Houston", "Vancouver", "Vancouver", "Seattle"],
  H: ["Atlanta", "Miami", "Foxborough", "Arlington", "Kansas City", "Atlanta"],
  I: ["East Rutherford", "Foxborough", "Philadelphia", "East Rutherford", "Boston", "Philadelphia"],
  J: ["Kansas City", "Santa Clara", "Atlanta", "Inglewood", "Miami", "Kansas City"],
  K: ["Houston", "Mexico City", "Monterrey", "Houston", "Miami", "Mexico City"],
  L: ["Arlington", "Toronto", "Vancouver", "Dallas", "Toronto", "Arlington"],
};

const TeamSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const PlayerSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const MatchSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Team = mongoose.model("Team", TeamSchema);
const Player = mongoose.model("Player", PlayerSchema);
const Match = mongoose.model("Match", MatchSchema);

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function buildFixtures() {
  const fixtures = [];
  let order = 1;

  for (const [group, rawTeams] of Object.entries(GROUPS)) {
    const teams = rawTeams.map(([name, code, confederation]) => ({ name, code, confederation }));

    const [t1, t2, t3, t4] = teams;
    const base = new Date(GROUP_START_DATES[group]);

    const pairs = [
      [t1, t2, 0, 0],
      [t3, t4, 0, 3],

      [t1, t3, 7, 0],
      [t4, t2, 7, 3],

      [t4, t1, 14, 0],
      [t2, t3, 14, 0],
    ];

    pairs.forEach(([home, away, dayOffset, hourOffset], index) => {
      const date = addHours(addDays(base, dayOffset), hourOffset);

      fixtures.push({
        matchKey: `WC26|${group}|${home.code}|${away.code}`,
        group,
        home,
        away,
        matchDate: date,
        stadium: VENUES[group]?.[index] || "TBD",
        matchOrder: order++,
        phase: "Group Stage",
        status: "Scheduled",
      });
    });
  }

  return fixtures;
}

async function clearCollection(name) {
  try {
    const result = await mongoose.connection.db.collection(name).deleteMany({});
    console.log(`OK: ${name} limpiada (${result.deletedCount})`);
  } catch (error) {
    console.log(`AVISO: ${name}: ${error.message}`);
  }
}

async function main() {
  console.log("Conectando a MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const allowedCodes = Object.values(GROUPS).flat().map((t) => t[1]);
  const teamMap = new Map();

  console.log("1) Asegurando 48 equipos en orden correcto...");

  for (const [group, teams] of Object.entries(GROUPS)) {
    for (let i = 0; i < teams.length; i++) {
      const [name, code, confederation] = teams[i];

      const team = await Team.findOneAndUpdate(
        { code },
        {
          $set: {
            name,
            code,
            group,
            groupPosition: i + 1,
            confederation,
            logo: null,
            fifaRanking: null,
          },
        },
        { upsert: true, new: true, returnDocument: "after" }
      );

      teamMap.set(code, team);
    }
  }

  console.log("2) Eliminando equipos fuera de la competición...");

  const oldTeams = await Team.find({ code: { $nin: allowedCodes } }).select("_id code name").lean();
  const oldIds = oldTeams.map((t) => t._id);

  if (oldIds.length) {
    await Player.deleteMany({ team: { $in: oldIds } });
    await Team.deleteMany({ _id: { $in: oldIds } });
  }

  console.log("Eliminados:", oldTeams.map((t) => `${t.code}:${t.name}`).join(", ") || "ninguno");

  console.log("3) Eliminando partidos viejos y predicciones dependientes...");
  await Match.deleteMany({});
  await clearCollection("matchpredictions");
  await clearCollection("knockoutpredictions");

  console.log("4) Insertando 72 partidos correctos...");

  const fixtures = buildFixtures();

  for (const fixture of fixtures) {
    const homeTeam = teamMap.get(fixture.home.code);
    const awayTeam = teamMap.get(fixture.away.code);

    await Match.create({
      matchKey: fixture.matchKey,
      homeTeam: homeTeam._id,
      awayTeam: awayTeam._id,
      homeScore: null,
      awayScore: null,
      matchDate: fixture.matchDate,
      stadium: fixture.stadium,
      group: fixture.group,
      matchOrder: fixture.matchOrder,
      phase: fixture.phase,
      status: fixture.status,
    });
  }

  const totalTeams = await Team.countDocuments();
  const totalMatches = await Match.countDocuments();

  console.log("\n============================================");
  console.log("CALENDARIO CORREGIDO");
  console.log("Equipos:", totalTeams);
  console.log("Partidos:", totalMatches);
  console.log("Placeholders eliminados:", oldTeams.length);
  console.log("============================================");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("ERROR:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
