require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mundial2026";

const ES_BASE = "https://es.wikipedia.org";
const EN_BASE = "https://en.wikipedia.org";

const GROUPS = {
  A: [
    { name: "Mexico", es: "México", code: "MEX", confederation: "CONCACAF" },
    { name: "South Africa", es: "Sudáfrica", code: "RSA", confederation: "CAF" },
    { name: "South Korea", es: "Corea del Sur", code: "KOR", confederation: "AFC" },
    { name: "Czechia", es: "Chequia", code: "CZE", confederation: "UEFA" },
  ],
  B: [
    { name: "Canada", es: "Canadá", code: "CAN", confederation: "CONCACAF" },
    { name: "Bosnia and Herzegovina", es: "Bosnia y Herzegovina", code: "BIH", confederation: "UEFA" },
    { name: "Qatar", es: "Catar", code: "QAT", confederation: "AFC" },
    { name: "Switzerland", es: "Suiza", code: "SUI", confederation: "UEFA" },
  ],
  C: [
    { name: "Brazil", es: "Brasil", code: "BRA", confederation: "CONMEBOL" },
    { name: "Morocco", es: "Marruecos", code: "MAR", confederation: "CAF" },
    { name: "Haiti", es: "Haití", code: "HAI", confederation: "CONCACAF" },
    { name: "Scotland", es: "Escocia", code: "SCO", confederation: "UEFA" },
  ],
  D: [
    { name: "United States", es: "Estados Unidos", code: "USA", confederation: "CONCACAF" },
    { name: "Paraguay", es: "Paraguay", code: "PAR", confederation: "CONMEBOL" },
    { name: "Australia", es: "Australia", code: "AUS", confederation: "AFC" },
    { name: "Türkiye", es: "Turquía", code: "TUR", confederation: "UEFA" },
  ],
  E: [
    { name: "Germany", es: "Alemania", code: "GER", confederation: "UEFA" },
    { name: "Curaçao", es: "Curazao", code: "CUW", confederation: "CONCACAF" },
    { name: "Côte d'Ivoire", es: "Costa de Marfil", code: "CIV", confederation: "CAF" },
    { name: "Ecuador", es: "Ecuador", code: "ECU", confederation: "CONMEBOL" },
  ],
  F: [
    { name: "Netherlands", es: "Países Bajos", code: "NED", confederation: "UEFA" },
    { name: "Japan", es: "Japón", code: "JPN", confederation: "AFC" },
    { name: "Sweden", es: "Suecia", code: "SWE", confederation: "UEFA" },
    { name: "Tunisia", es: "Túnez", code: "TUN", confederation: "CAF" },
  ],
  G: [
    { name: "Belgium", es: "Bélgica", code: "BEL", confederation: "UEFA" },
    { name: "Egypt", es: "Egipto", code: "EGY", confederation: "CAF" },
    { name: "Iran", es: "Irán", code: "IRN", confederation: "AFC" },
    { name: "New Zealand", es: "Nueva Zelanda", code: "NZL", confederation: "OFC" },
  ],
  H: [
    { name: "Spain", es: "España", code: "ESP", confederation: "UEFA" },
    { name: "Cape Verde", es: "Cabo Verde", code: "CPV", confederation: "CAF" },
    { name: "Saudi Arabia", es: "Arabia Saudita", code: "KSA", confederation: "AFC" },
    { name: "Uruguay", es: "Uruguay", code: "URU", confederation: "CONMEBOL" },
  ],
  I: [
    { name: "France", es: "Francia", code: "FRA", confederation: "UEFA" },
    { name: "Senegal", es: "Senegal", code: "SEN", confederation: "CAF" },
    { name: "Iraq", es: "Irak", code: "IRQ", confederation: "AFC" },
    { name: "Norway", es: "Noruega", code: "NOR", confederation: "UEFA" },
  ],
  J: [
    { name: "Argentina", es: "Argentina", code: "ARG", confederation: "CONMEBOL" },
    { name: "Algeria", es: "Argelia", code: "ALG", confederation: "CAF" },
    { name: "Austria", es: "Austria", code: "AUT", confederation: "UEFA" },
    { name: "Jordan", es: "Jordania", code: "JOR", confederation: "AFC" },
  ],
  K: [
    { name: "Portugal", es: "Portugal", code: "POR", confederation: "UEFA" },
    { name: "Congo DR", es: "República Democrática del Congo", code: "COD", confederation: "CAF" },
    { name: "Uzbekistan", es: "Uzbekistán", code: "UZB", confederation: "AFC" },
    { name: "Colombia", es: "Colombia", code: "COL", confederation: "CONMEBOL" },
  ],
  L: [
    { name: "England", es: "Inglaterra", code: "ENG", confederation: "UEFA" },
    { name: "Croatia", es: "Croacia", code: "CRO", confederation: "UEFA" },
    { name: "Ghana", es: "Ghana", code: "GHA", confederation: "CAF" },
    { name: "Panama", es: "Panamá", code: "PAN", confederation: "CONCACAF" },
  ],
};

const TEAM_PAGES_ES = {
  MEX: "Selección_de_fútbol_de_México",
  RSA: "Selección_de_fútbol_de_Sudáfrica",
  KOR: "Selección_de_fútbol_de_Corea_del_Sur",
  CZE: "Selección_de_fútbol_de_Chequia",
  CAN: "Selección_de_fútbol_de_Canadá",
  BIH: "Selección_de_fútbol_de_Bosnia_y_Herzegovina",
  QAT: "Selección_de_fútbol_de_Catar",
  SUI: "Selección_de_fútbol_de_Suiza",
  BRA: "Selección_de_fútbol_de_Brasil",
  MAR: "Selección_de_fútbol_de_Marruecos",
  HAI: "Selección_de_fútbol_de_Haití",
  SCO: "Selección_de_fútbol_de_Escocia",
  USA: "Selección_de_fútbol_de_los_Estados_Unidos",
  PAR: "Selección_de_fútbol_de_Paraguay",
  AUS: "Selección_de_fútbol_de_Australia",
  TUR: "Selección_de_fútbol_de_Turquía",
  GER: "Selección_de_fútbol_de_Alemania",
  CUW: "Selección_de_fútbol_de_Curazao",
  CIV: "Selección_de_fútbol_de_Costa_de_Marfil",
  ECU: "Selección_de_fútbol_de_Ecuador",
  NED: "Selección_de_fútbol_de_los_Países_Bajos",
  JPN: "Selección_de_fútbol_de_Japón",
  SWE: "Selección_de_fútbol_de_Suecia",
  TUN: "Selección_de_fútbol_de_Túnez",
  BEL: "Selección_de_fútbol_de_Bélgica",
  EGY: "Selección_de_fútbol_de_Egipto",
  IRN: "Selección_de_fútbol_de_Irán",
  NZL: "Selección_de_fútbol_de_Nueva_Zelanda",
  ESP: "Selección_de_fútbol_de_España",
  CPV: "Selección_de_fútbol_de_Cabo_Verde",
  KSA: "Selección_de_fútbol_de_Arabia_Saudita",
  URU: "Selección_de_fútbol_de_Uruguay",
  FRA: "Selección_de_fútbol_de_Francia",
  SEN: "Selección_de_fútbol_de_Senegal",
  IRQ: "Selección_de_fútbol_de_Irak",
  NOR: "Selección_de_fútbol_de_Noruega",
  ARG: "Selección_de_fútbol_de_Argentina",
  ALG: "Selección_de_fútbol_de_Argelia",
  AUT: "Selección_de_fútbol_de_Austria",
  JOR: "Selección_de_fútbol_de_Jordania",
  POR: "Selección_de_fútbol_de_Portugal",
  COD: "Selección_de_fútbol_de_la_República_Democrática_del_Congo",
  UZB: "Selección_de_fútbol_de_Uzbekistán",
  COL: "Selección_de_fútbol_de_Colombia",
  ENG: "Selección_de_fútbol_de_Inglaterra",
  CRO: "Selección_de_fútbol_de_Croacia",
  GHA: "Selección_de_fútbol_de_Ghana",
  PAN: "Selección_de_fútbol_de_Panamá",
};

const TEAM_PAGES_EN = {
  ARG: "Argentina_national_football_team",
  BRA: "Brazil_national_football_team",
  COL: "Colombia_national_football_team",
  MEX: "Mexico_national_football_team",
  USA: "United_States_men%27s_national_soccer_team",
  CAN: "Canada_men%27s_national_soccer_team",
  ENG: "England_national_football_team",
  ESP: "Spain_national_football_team",
  FRA: "France_national_football_team",
  GER: "Germany_national_football_team",
  POR: "Portugal_national_football_team",
  NED: "Netherlands_national_football_team",
  BEL: "Belgium_national_football_team",
  CRO: "Croatia_national_football_team",
  URU: "Uruguay_national_football_team",
  JPN: "Japan_national_football_team",
  KOR: "South_Korea_national_football_team",
  AUS: "Australia_men%27s_national_soccer_team",
  MAR: "Morocco_national_football_team",
  SEN: "Senegal_national_football_team",
  GHA: "Ghana_national_football_team",
  EGY: "Egypt_national_football_team",
  TUN: "Tunisia_national_football_team",
};

const STADIUM_BY_GROUP = {
  A: ["Mexico City Stadium", "Guadalajara Stadium", "Monterrey Stadium"],
  B: ["Toronto Stadium", "Vancouver Stadium", "San Francisco Bay Area Stadium"],
  C: ["New York New Jersey Stadium", "Boston Stadium", "Miami Stadium"],
  D: ["Los Angeles Stadium", "Vancouver Stadium", "San Francisco Bay Area Stadium"],
  E: ["Houston Stadium", "Philadelphia Stadium", "Dallas Stadium"],
  F: ["Dallas Stadium", "Monterrey Stadium", "Kansas City Stadium"],
  G: ["Seattle Stadium", "Los Angeles Stadium", "Vancouver Stadium"],
  H: ["Atlanta Stadium", "Miami Stadium", "Houston Stadium"],
  I: ["New York New Jersey Stadium", "Boston Stadium", "Toronto Stadium"],
  J: ["Kansas City Stadium", "San Francisco Bay Area Stadium", "Seattle Stadium"],
  K: ["Houston Stadium", "Mexico City Stadium", "Miami Stadium"],
  L: ["Dallas Stadium", "Toronto Stadium", "Philadelphia Stadium"],
};

const FIRST_DATES = {
  A: "2026-06-11",
  B: "2026-06-12",
  C: "2026-06-13",
  D: "2026-06-12",
  E: "2026-06-14",
  F: "2026-06-14",
  G: "2026-06-15",
  H: "2026-06-15",
  I: "2026-06-16",
  J: "2026-06-16",
  K: "2026-06-17",
  L: "2026-06-17",
};

const SECOND_DATES = {
  A: "2026-06-18",
  B: "2026-06-18",
  C: "2026-06-19",
  D: "2026-06-19",
  E: "2026-06-20",
  F: "2026-06-20",
  G: "2026-06-21",
  H: "2026-06-21",
  I: "2026-06-22",
  J: "2026-06-22",
  K: "2026-06-23",
  L: "2026-06-23",
};

const THIRD_DATES = {
  A: "2026-06-24",
  B: "2026-06-24",
  C: "2026-06-24",
  D: "2026-06-25",
  E: "2026-06-25",
  F: "2026-06-25",
  G: "2026-06-26",
  H: "2026-06-26",
  I: "2026-06-26",
  J: "2026-06-27",
  K: "2026-06-27",
  L: "2026-06-27",
};

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 3, unique: true },
    group: { type: String, uppercase: true, default: null },
    logo: { type: String, default: null },
    confederation: { type: String, default: null },
    fifaRanking: { type: Number, default: null },
  },
  { timestamps: true }
);

const PlayerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    position: { type: String, enum: ["GK", "DF", "MF", "FW", "Unknown"], default: "Unknown" },
    number: { type: Number, min: 1, max: 99, default: null },
    club: { type: String, trim: true, default: "Unknown" },
    age: { type: Number, min: 16, max: 50, default: null },
    photo: { type: String, default: null },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
  },
  { timestamps: true }
);

const MatchSchema = new mongoose.Schema(
  {
    matchKey: { type: String, required: true, unique: true },
    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    matchDate: { type: Date, required: true },
    stadium: { type: String, default: null },
    group: { type: String, uppercase: true, default: null },
    matchOrder: { type: Number, default: null },
    phase: { type: String, default: "Group Stage" },
    status: { type: String, default: "Scheduled" },
  },
  { timestamps: true }
);

PlayerSchema.index({ team: 1, name: 1 }, { unique: true });

const Team = mongoose.model("Team", TeamSchema);
const Player = mongoose.model("Player", PlayerSchema);
const Match = mongoose.model("Match", MatchSchema);

function clean(v) {
  return String(v || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function posToEnum(value) {
  const p = clean(value).toUpperCase();

  if (/^(POR|ARQ|GK|GOALKEEPER|PORTERO|ARQUERO)$/.test(p)) return "GK";
  if (/^(DEF|DF|DEFENDER|DEFENSA|ZAGUERO)$/.test(p)) return "DF";
  if (/^(MED|MC|MF|MIDFIELDER|MEDIOCAMPISTA|VOLANTE)$/.test(p)) return "MF";
  if (/^(DEL|FW|FORWARD|DELANTERO|ATACANTE)$/.test(p)) return "FW";

  return "Unknown";
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent": "WC26-Arena educational scraper",
      "Accept": "text/html,application/xhtml+xml",
    },
  });

  return res.data;
}

async function upsertTeams() {
  const map = new Map();

  for (const [group, teams] of Object.entries(GROUPS)) {
    for (const team of teams) {
      const doc = await Team.findOneAndUpdate(
        { code: team.code },
        {
          $set: {
            name: team.name,
            code: team.code,
            group,
            logo: null,
            confederation: team.confederation,
          },
        },
        { upsert: true, returnDocument: "after", runValidators: true }
      );

      map.set(team.code, doc);
    }
  }

  return map;
}

function buildGroupMatches() {
  const matches = [];
  let order = 1;

  for (const [group, teams] of Object.entries(GROUPS)) {
    const t1 = teams[0];
    const t2 = teams[1];
    const t3 = teams[2];
    const t4 = teams[3];

    const rounds = [
      { date: FIRST_DATES[group], pairs: [[t1, t2], [t3, t4]], label: 1 },
      { date: SECOND_DATES[group], pairs: [[t1, t3], [t4, t2]], label: 2 },
      { date: THIRD_DATES[group], pairs: [[t4, t1], [t2, t3]], label: 3 },
    ];

    for (const round of rounds) {
      for (let i = 0; i < round.pairs.length; i++) {
        const [home, away] = round.pairs[i];
        const hour = i === 0 ? "18:00:00" : "21:00:00";
        const stadium = STADIUM_BY_GROUP[group]?.[round.label - 1] || "TBD";
        const date = `${round.date}T${hour}-05:00`;

        matches.push({
          group,
          home,
          away,
          matchDate: new Date(date),
          stadium,
          phase: "Group Stage",
          status: "Scheduled",
          matchOrder: order++,
        });
      }
    }
  }

  return matches;
}

function matchKey(m) {
  return `Group Stage|${m.group}|${m.home.code}|${m.away.code}|${m.matchDate.toISOString().slice(0, 16)}`;
}

async function upsertMatches(teamMap) {
  const generated = buildGroupMatches();

  await Match.deleteMany({ phase: "Group Stage" });

  let count = 0;

  for (const m of generated) {
    const home = teamMap.get(m.home.code) || (await Team.findOne({ code: m.home.code }));
    const away = teamMap.get(m.away.code) || (await Team.findOne({ code: m.away.code }));

    if (!home || !away) {
      console.log("Omitido:", m.home.name, "vs", m.away.name);
      continue;
    }

    await Match.create({
      matchKey: matchKey(m),
      homeTeam: home._id,
      awayTeam: away._id,
      homeScore: null,
      awayScore: null,
      matchDate: m.matchDate,
      stadium: m.stadium,
      group: m.group,
      matchOrder: m.matchOrder,
      phase: m.phase,
      status: m.status,
    });

    count++;
  }

  return count;
}

function parsePlayersFromTables($, teamCode) {
  const players = [];

  const candidateHeadings = $("h2,h3,h4").filter((_i, h) => {
    const text = clean($(h).text());
    const id = clean($(h).find(".mw-headline").attr("id") || $(h).attr("id") || "");
    return /última convocatoria|ultima convocatoria|convocatoria|jugadores convocados|current squad|recent call-ups/i.test(text + " " + id);
  });

  candidateHeadings.each((_i, heading) => {
    let el = $(heading).next();

    while (el.length) {
      const tag = (el[0].tagName || "").toLowerCase();
      if (/^h2$/.test(tag)) break;

      if (el.is("table") || el.find("table").length) {
        const tables = el.is("table") ? el : el.find("table");

        tables.each((_t, table) => {
          $(table).find("tr").each((_r, row) => {
            const cells = $(row).find("td");
            if (cells.length < 2) return;

            const texts = cells.map((_c, cell) => clean($(cell).text())).get();

            const pos = texts.map(posToEnum).find((x) => x !== "Unknown") || "Unknown";

            const links = $(row).find("a").map((_a, a) => clean($(a).text())).get().filter(Boolean);

            let name = "";
            for (const l of links) {
              if (
                l.length >= 3 &&
                !/club|selección|fútbol|liga|primera|segunda|copa|mundial|nacional/i.test(l) &&
                !Object.values(TEAM_PAGES_ES).some((p) => decodeURIComponent(p).toLowerCase().includes(l.toLowerCase()))
              ) {
                name = l;
                break;
              }
            }

            if (!name) {
              name = texts.find((t) => /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.\- ]{4,}$/.test(t)) || "";
            }

            if (!name || name.length < 4) return;

            const numberText = texts.find((t) => /^\d{1,2}$/.test(t));
            const number = numberText ? Number(numberText) : null;

            const ageText = texts.find((t) => /^\d{2}$/.test(t) && Number(t) >= 16 && Number(t) <= 50);
            const age = ageText ? Number(ageText) : null;

            let club = links.length > 1 ? links[links.length - 1] : "Unknown";
            if (club === name) club = "Unknown";

            players.push({
              teamCode,
              name,
              position: pos,
              number,
              age,
              club,
              photo: null,
            });
          });
        });
      }

      el = el.next();
    }
  });

  const unique = new Map();
  for (const p of players) {
    unique.set(`${p.teamCode}|${p.name}`, p);
  }

  return [...unique.values()].slice(0, 35);
}

async function scrapePlayersForTeam(team) {
  const urls = [];

  if (TEAM_PAGES_ES[team.code]) {
    urls.push(`${ES_BASE}/wiki/${TEAM_PAGES_ES[team.code]}#Jugadores`);
  }

  if (TEAM_PAGES_EN[team.code]) {
    urls.push(`${EN_BASE}/wiki/${TEAM_PAGES_EN[team.code]}`);
  }

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const players = parsePlayersFromTables($, team.code);

      if (players.length > 0) {
        console.log(`${team.name}: ${players.length} jugadores desde ${url}`);
        return players;
      }
    } catch (err) {
      console.log(`${team.name}: no se pudo leer ${url}: ${err.message}`);
    }
  }

  console.log(`${team.name}: 0 jugadores`);
  return [];
}

async function upsertPlayers(teamMap) {
  await Player.deleteMany({});

  let count = 0;

  for (const teams of Object.values(GROUPS)) {
    for (const team of teams) {
      const dbTeam = teamMap.get(team.code) || (await Team.findOne({ code: team.code }));
      if (!dbTeam) continue;

      const players = await scrapePlayersForTeam(team);

      for (const p of players) {
        await Player.findOneAndUpdate(
          { team: dbTeam._id, name: p.name },
          {
            $set: {
              name: p.name,
              position: p.position || "Unknown",
              number: p.number || null,
              club: p.club || "Unknown",
              age: p.age || null,
              photo: p.photo || null,
              team: dbTeam._id,
            },
          },
          { upsert: true, returnDocument: "after", runValidators: true }
        );

        count++;
      }
    }
  }

  return count;
}

async function main() {
  console.log("Conectando MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log("1) Guardando equipos...");
  const teamMap = await upsertTeams();

  console.log("2) Generando partidos de fase de grupos...");
  const matchCount = await upsertMatches(teamMap);

  console.log("3) Scrapeando jugadores desde Wikipedia ES/EN...");
  const playerCount = await upsertPlayers(teamMap);

  const totalTeams = await Team.countDocuments();
  const totalMatches = await Match.countDocuments();
  const totalPlayers = await Player.countDocuments();

  console.log("============================================");
  console.log("SCRAPING FIXED TERMINADO");
  console.log(`Equipos totales: ${totalTeams}`);
  console.log(`Partidos de grupos generados: ${matchCount}`);
  console.log(`Partidos totales DB: ${totalMatches}`);
  console.log(`Jugadores guardados: ${playerCount}`);
  console.log(`Jugadores totales DB: ${totalPlayers}`);
  console.log("============================================");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
