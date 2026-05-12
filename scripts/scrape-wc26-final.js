require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mundial2026";
const ES_BASE = "https://es.wikipedia.org";

const GROUPS = {
  A: [
    { name: "Mexico", es: "México", code: "MEX", confederation: "CONCACAF", page: "Selección_de_fútbol_de_México" },
    { name: "South Africa", es: "Sudáfrica", code: "RSA", confederation: "CAF", page: "Selección_de_fútbol_de_Sudáfrica" },
    { name: "South Korea", es: "Corea del Sur", code: "KOR", confederation: "AFC", page: "Selección_de_fútbol_de_Corea_del_Sur" },
    { name: "Czechia", es: "Chequia", code: "CZE", confederation: "UEFA", page: "Selección_de_fútbol_de_Chequia" },
  ],
  B: [
    { name: "Canada", es: "Canadá", code: "CAN", confederation: "CONCACAF", page: "Selección_de_fútbol_de_Canadá" },
    { name: "Bosnia and Herzegovina", es: "Bosnia y Herzegovina", code: "BIH", confederation: "UEFA", page: "Selección_de_fútbol_de_Bosnia_y_Herzegovina" },
    { name: "Qatar", es: "Catar", code: "QAT", confederation: "AFC", page: "Selección_de_fútbol_de_Catar" },
    { name: "Switzerland", es: "Suiza", code: "SUI", confederation: "UEFA", page: "Selección_de_fútbol_de_Suiza" },
  ],
  C: [
    { name: "Brazil", es: "Brasil", code: "BRA", confederation: "CONMEBOL", page: "Selección_de_fútbol_de_Brasil" },
    { name: "Morocco", es: "Marruecos", code: "MAR", confederation: "CAF", page: "Selección_de_fútbol_de_Marruecos" },
    { name: "Haiti", es: "Haití", code: "HAI", confederation: "CONCACAF", page: "Selección_de_fútbol_de_Haití" },
    { name: "Scotland", es: "Escocia", code: "SCO", confederation: "UEFA", page: "Selección_de_fútbol_de_Escocia" },
  ],
  D: [
    { name: "United States", es: "Estados Unidos", code: "USA", confederation: "CONCACAF", page: "Selección_de_fútbol_de_los_Estados_Unidos" },
    { name: "Paraguay", es: "Paraguay", code: "PAR", confederation: "CONMEBOL", page: "Selección_de_fútbol_de_Paraguay" },
    { name: "Australia", es: "Australia", code: "AUS", confederation: "AFC", page: "Selección_de_fútbol_de_Australia" },
    { name: "Türkiye", es: "Turquía", code: "TUR", confederation: "UEFA", page: "Selección_de_fútbol_de_Turquía" },
  ],
  E: [
    { name: "Germany", es: "Alemania", code: "GER", confederation: "UEFA", page: "Selección_de_fútbol_de_Alemania" },
    { name: "Curaçao", es: "Curazao", code: "CUW", confederation: "CONCACAF", page: "Selección_de_fútbol_de_Curazao" },
    { name: "Côte d'Ivoire", es: "Costa de Marfil", code: "CIV", confederation: "CAF", page: "Selección_de_fútbol_de_Costa_de_Marfil" },
    { name: "Ecuador", es: "Ecuador", code: "ECU", confederation: "CONMEBOL", page: "Selección_de_fútbol_de_Ecuador" },
  ],
  F: [
    { name: "Netherlands", es: "Países Bajos", code: "NED", confederation: "UEFA", page: "Selección_de_fútbol_de_los_Países_Bajos" },
    { name: "Japan", es: "Japón", code: "JPN", confederation: "AFC", page: "Selección_de_fútbol_de_Japón" },
    { name: "Sweden", es: "Suecia", code: "SWE", confederation: "UEFA", page: "Selección_de_fútbol_de_Suecia" },
    { name: "Tunisia", es: "Túnez", code: "TUN", confederation: "CAF", page: "Selección_de_fútbol_de_Túnez" },
  ],
  G: [
    { name: "Belgium", es: "Bélgica", code: "BEL", confederation: "UEFA", page: "Selección_de_fútbol_de_Bélgica" },
    { name: "Egypt", es: "Egipto", code: "EGY", confederation: "CAF", page: "Selección_de_fútbol_de_Egipto" },
    { name: "Iran", es: "Irán", code: "IRN", confederation: "AFC", page: "Selección_de_fútbol_de_Irán" },
    { name: "New Zealand", es: "Nueva Zelanda", code: "NZL", confederation: "OFC", page: "Selección_de_fútbol_de_Nueva_Zelanda" },
  ],
  H: [
    { name: "Spain", es: "España", code: "ESP", confederation: "UEFA", page: "Selección_de_fútbol_de_España" },
    { name: "Cape Verde", es: "Cabo Verde", code: "CPV", confederation: "CAF", page: "Selección_de_fútbol_de_Cabo_Verde" },
    { name: "Saudi Arabia", es: "Arabia Saudita", code: "KSA", confederation: "AFC", page: "Selección_de_fútbol_de_Arabia_Saudita" },
    { name: "Uruguay", es: "Uruguay", code: "URU", confederation: "CONMEBOL", page: "Selección_de_fútbol_de_Uruguay" },
  ],
  I: [
    { name: "France", es: "Francia", code: "FRA", confederation: "UEFA", page: "Selección_de_fútbol_de_Francia" },
    { name: "Senegal", es: "Senegal", code: "SEN", confederation: "CAF", page: "Selección_de_fútbol_de_Senegal" },
    { name: "Iraq", es: "Irak", code: "IRQ", confederation: "AFC", page: "Selección_de_fútbol_de_Irak" },
    { name: "Norway", es: "Noruega", code: "NOR", confederation: "UEFA", page: "Selección_de_fútbol_de_Noruega" },
  ],
  J: [
    { name: "Argentina", es: "Argentina", code: "ARG", confederation: "CONMEBOL", page: "Selección_de_fútbol_de_Argentina" },
    { name: "Algeria", es: "Argelia", code: "ALG", confederation: "CAF", page: "Selección_de_fútbol_de_Argelia" },
    { name: "Austria", es: "Austria", code: "AUT", confederation: "UEFA", page: "Selección_de_fútbol_de_Austria" },
    { name: "Jordan", es: "Jordania", code: "JOR", confederation: "AFC", page: "Selección_de_fútbol_de_Jordania" },
  ],
  K: [
    { name: "Portugal", es: "Portugal", code: "POR", confederation: "UEFA", page: "Selección_de_fútbol_de_Portugal" },
    { name: "Congo DR", es: "República Democrática del Congo", code: "COD", confederation: "CAF", page: "Selección_de_fútbol_de_la_República_Democrática_del_Congo" },
    { name: "Uzbekistan", es: "Uzbekistán", code: "UZB", confederation: "AFC", page: "Selección_de_fútbol_de_Uzbekistán" },
    { name: "Colombia", es: "Colombia", code: "COL", confederation: "CONMEBOL", page: "Selección_de_fútbol_de_Colombia" },
  ],
  L: [
    { name: "England", es: "Inglaterra", code: "ENG", confederation: "UEFA", page: "Selección_de_fútbol_de_Inglaterra" },
    { name: "Croatia", es: "Croacia", code: "CRO", confederation: "UEFA", page: "Selección_de_fútbol_de_Croacia" },
    { name: "Ghana", es: "Ghana", code: "GHA", confederation: "CAF", page: "Selección_de_fútbol_de_Ghana" },
    { name: "Panama", es: "Panamá", code: "PAN", confederation: "CONCACAF", page: "Selección_de_fútbol_de_Panamá" },
  ],
};

const FIRST_DATES = {
  A: "2026-06-11", B: "2026-06-12", C: "2026-06-13", D: "2026-06-12",
  E: "2026-06-14", F: "2026-06-14", G: "2026-06-15", H: "2026-06-15",
  I: "2026-06-16", J: "2026-06-16", K: "2026-06-17", L: "2026-06-17",
};

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true, unique: true },
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

    // Campos extra para aprovechar la tabla completa de Wikipedia.
    birthText: { type: String, default: null },
    caps: { type: Number, default: null },
    goals: { type: Number, default: null },
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
    stadium: { type: String, default: "TBD" },
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

function clean(text) {
  return String(text || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text) {
  return clean(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function posToEnum(value) {
  const p = normalize(value).toUpperCase();

  if (/(^| )(POR|ARQ|GK|PORTERO|ARQUERO|GOALKEEPER)( |$)/.test(p)) return "GK";
  if (/(^| )(DEF|DF|DEFENSA|DEFENDER)( |$)/.test(p)) return "DF";
  if (/(^| )(MED|VOL|MC|MF|MEDIOCAMPISTA|MIDFIELDER)( |$)/.test(p)) return "MF";
  if (/(^| )(DEL|FW|DELANTERO|ATACANTE|FORWARD)( |$)/.test(p)) return "FW";

  return "Unknown";
}

function num(text) {
  const m = clean(text).match(/\d+/);
  return m ? Number(m[0]) : null;
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
  const teamMap = new Map();
  const allowedCodes = [];

  for (const [group, teams] of Object.entries(GROUPS)) {
    for (const t of teams) {
      allowedCodes.push(t.code);

      const team = await Team.findOneAndUpdate(
        { code: t.code },
        {
          $set: {
            name: t.name,
            code: t.code,
            group,
            logo: null,
            confederation: t.confederation,
          },
        },
        { upsert: true, returnDocument: "after", runValidators: true }
      );

      teamMap.set(t.code, team);
    }
  }

  // Limpia placeholders viejos que dejaron 53 equipos.
  await Team.deleteMany({ code: { $nin: allowedCodes } });

  return teamMap;
}

function makeGroupMatches() {
  const matches = [];
  let order = 1;

  for (const [group, teams] of Object.entries(GROUPS)) {
    const [t1, t2, t3, t4] = teams;

    const base = new Date(`${FIRST_DATES[group]}T18:00:00-05:00`);

    const rounds = [
      [[t1, t2], [t3, t4]],
      [[t4, t2], [t1, t3]],
      [[t4, t1], [t2, t3]],
    ];

    for (let r = 0; r < rounds.length; r++) {
      for (let i = 0; i < rounds[r].length; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + r * 6);
        d.setHours(d.getHours() + i * 3);

        const [home, away] = rounds[r][i];

        matches.push({
          group,
          home,
          away,
          matchDate: d,
          stadium: "TBD",
          phase: "Group Stage",
          status: "Scheduled",
          matchOrder: order++,
        });
      }
    }
  }

  return matches;
}

async function upsertMatches(teamMap) {
  const matches = makeGroupMatches();

  await Match.deleteMany({ phase: "Group Stage" });

  let count = 0;

  for (const m of matches) {
    const home = teamMap.get(m.home.code);
    const away = teamMap.get(m.away.code);

    if (!home || !away) continue;

    const matchKey = `Group Stage|${m.group}|${m.home.code}|${m.away.code}|${m.matchDate.toISOString().slice(0, 16)}`;

    await Match.create({
      matchKey,
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

function getCallupTables($) {
  const tables = [];

  $("section").each((_i, section) => {
    const label = normalize($(section).attr("aria-labelledby") || "");
    if (label.includes("ultima_convocatoria") || label.includes("ultima convocatoria")) {
      $(section).find("table").each((_j, table) => tables.push(table));
    }
  });

  if (tables.length > 0) return tables;

  $("table").each((_i, table) => {
    const headers = normalize($(table).find("th").text());
    const body = normalize($(table).text());

    if (
      (headers.includes("posicion") || body.includes("posicion")) &&
      (headers.includes("nombre") || body.includes("nombre")) &&
      (headers.includes("equipo") || body.includes("equipo"))
    ) {
      tables.push(table);
    }
  });

  return tables;
}

function parsePlayersFromTable($, table, teamCode) {
  const players = [];

  $(table).find("tbody tr, tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 6) return;

    const number = num($(cells[0]).text());
    const position = posToEnum($(cells[1]).text());

    const nameCell = $(cells[2]);
    const nameLinks = nameCell
      .find("a")
      .map((_i, a) => clean($(a).text()))
      .get()
      .filter((x) => x.length >= 3);

    let name = nameLinks[nameLinks.length - 1] || clean(nameCell.text());
    name = name.replace(/^[A-Z]{2,3}\s+/, "").trim();

    if (!name || name.length < 4) return;
    if (/seleccion|futbol|bandera|provincia|pais/i.test(name)) return;

    const birthText = clean($(cells[3]).text());
    const ageMatch = birthText.match(/\((\d{2})\s*años?\)/i);
    const age = ageMatch ? Number(ageMatch[1]) : null;

    const caps = num($(cells[4]).text());
    const goals = num($(cells[5]).text());

    const clubCell = $(cells[6]);
    const club =
      clean(clubCell.find("a").last().text()) ||
      clean(clubCell.text()) ||
      "Unknown";

    players.push({
      teamCode,
      name,
      position,
      number,
      age,
      birthText,
      caps,
      goals,
      club,
      photo: null,
    });
  });

  const unique = new Map();

  for (const p of players) {
    unique.set(`${p.teamCode}|${p.name}`, p);
  }

  return [...unique.values()].slice(0, 35);
}

async function scrapePlayersForTeam(team) {
  const url = `${ES_BASE}/wiki/${encodeURIComponent(team.page)}#Jugadores`;

  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const tables = getCallupTables($);

    let players = [];

    for (const table of tables) {
      players.push(...parsePlayersFromTable($, table, team.code));
    }

    const unique = new Map();
    for (const p of players) {
      unique.set(`${p.teamCode}|${p.name}`, p);
    }

    players = [...unique.values()].slice(0, 35);

    console.log(`${team.code} ${team.name}: ${players.length} jugadores`);
    return players;
  } catch (err) {
    console.log(`${team.code} ${team.name}: error leyendo jugadores -> ${err.message}`);
    return [];
  }
}

async function upsertPlayers(teamMap) {
  await Player.deleteMany({});

  let saved = 0;

  for (const teams of Object.values(GROUPS)) {
    for (const team of teams) {
      const dbTeam = teamMap.get(team.code);
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
              birthText: p.birthText || null,
              caps: p.caps ?? null,
              goals: p.goals ?? null,
            },
          },
          { upsert: true, returnDocument: "after", runValidators: true }
        );

        saved++;
      }
    }
  }

  return saved;
}

async function main() {
  console.log("Conectando a MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log("1) Guardando 48 equipos...");
  const teamMap = await upsertTeams();

  console.log("2) Regenerando 72 partidos de fase de grupos...");
  const matchCount = await upsertMatches(teamMap);

  console.log("3) Scrapeando jugadores desde Wikipedia ES, sección Última convocatoria...");
  const playerCount = await upsertPlayers(teamMap);

  const totalTeams = await Team.countDocuments();
  const totalMatches = await Match.countDocuments();
  const totalPlayers = await Player.countDocuments();

  console.log("============================================");
  console.log("SCRAPING FINAL TERMINADO");
  console.log(`Equipos totales: ${totalTeams}`);
  console.log(`Partidos totales: ${totalMatches}`);
  console.log(`Partidos de grupos creados: ${matchCount}`);
  console.log(`Jugadores guardados: ${playerCount}`);
  console.log(`Jugadores totales: ${totalPlayers}`);
  console.log("============================================");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR SCRAPER FINAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
