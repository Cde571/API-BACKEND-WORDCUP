require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mundial2026";
const ES_BASE = "https://es.wikipedia.org/wiki/";
const FETCH_PHOTOS = process.env.FETCH_PHOTOS !== "false";

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
    birthText: { type: String, default: null },
    caps: { type: Number, default: null },
    goals: { type: Number, default: null },
    sourceUrl: { type: String, default: null },
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

function clean(value) {
  return String(value || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function firstNumber(value) {
  const m = clean(value).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function positionToEnum(value) {
  const text = normalize(value);

  if (text.includes("guardameta") || text.includes("portero") || text.includes("arquero") || text.includes("por") || text.includes("gk")) return "GK";
  if (text.includes("defensa") || text.includes("defensor") || text.includes("def") || text.includes("df")) return "DF";
  if (text.includes("mediocampista") || text.includes("centrocampista") || text.includes("volante") || text.includes("med") || text.includes("mf")) return "MF";
  if (text.includes("delantero") || text.includes("atacante") || text.includes("del") || text.includes("fw")) return "FW";

  return "Unknown";
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent": "WC26-Arena/1.0 scraper academico",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  return res.data;
}

function validWikiLink($, a) {
  const text = clean($(a).text());
  const href = clean($(a).attr("href"));
  const title = clean($(a).attr("title"));

  if (!text || text.length < 3) return false;
  if (!href.includes("/wiki/")) return false;

  const all = normalize(`${text} ${href} ${title}`);

  if (all.includes("archivo:")) return false;
  if (all.includes("bandera")) return false;
  if (all.includes("flag")) return false;
  if (all.includes("provincia")) return false;
  if (all.includes("guardameta")) return false;
  if (all.includes("defensa")) return false;
  if (all.includes("delantero")) return false;
  if (all.includes("centrocampista")) return false;
  if (all.includes("seleccion")) return false;

  return true;
}

function getNameFromCell($, cell) {
  const links = $(cell)
    .find("a")
    .map((_i, a) => {
      if (!validWikiLink($, a)) return null;
      return {
        text: clean($(a).text()),
        href: clean($(a).attr("href")),
        title: clean($(a).attr("title")),
      };
    })
    .get()
    .filter(Boolean);

  if (links.length) return links[0];

  const clone = $(cell).clone();
  clone.find(".flagicon, img, figure, style, sup").remove();

  const fallback = clean(clone.text());

  if (fallback && fallback.length >= 4) {
    return { text: fallback, href: null, title: fallback };
  }

  return null;
}

function getClubFromCell($, cell) {
  const links = $(cell)
    .find("a")
    .map((_i, a) => {
      if (!validWikiLink($, a)) return null;
      return {
        text: clean($(a).text()),
        href: clean($(a).attr("href")),
        title: clean($(a).attr("title")),
      };
    })
    .get()
    .filter(Boolean);

  if (links.length) return links[links.length - 1].text;

  const clone = $(cell).clone();
  clone.find(".flagicon, img, figure, style, sup").remove();

  return clean(clone.text()) || "Unknown";
}

function getPositionFromCell($, cell) {
  const raw =
    clean($(cell).text()) +
    " " +
    clean($(cell).html()) +
    " " +
    clean(
      $(cell)
        .find("a,img,span")
        .map((_i, el) => {
          return [
            $(el).attr("title"),
            $(el).attr("alt"),
            $(el).attr("data-mw"),
            $(el).text(),
          ]
            .filter(Boolean)
            .join(" ");
        })
        .get()
        .join(" ")
    );

  return positionToEnum(raw);
}

function findCandidateTables($) {
  const tables = [];

  $("section").each((_i, section) => {
    const label = normalize($(section).attr("aria-labelledby") || "");

    if (
      label.includes("ultima_convocatoria") ||
      label.includes("ultima convocatoria") ||
      label.includes("convocatoria") ||
      label.includes("jugadores")
    ) {
      $(section).find("table").each((_j, table) => {
        tables.push($(table));
      });
    }
  });

  $("table").each((_i, table) => {
    const txt = normalize($(table).text());

    if (
      txt.includes("posicion") &&
      txt.includes("nombre") &&
      (txt.includes("fecha de nacimiento") || txt.includes("edad")) &&
      txt.includes("equipo")
    ) {
      tables.push($(table));
    }
  });

  const unique = [];
  const seen = new Set();

  for (const t of tables) {
    const id = t.text().slice(0, 300);
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(t);
    }
  }

  return unique;
}

function parsePlayersFromTable($, table, sourceUrl) {
  const players = [];

  table.find("tr").each((_i, row) => {
    const cells = $(row).children("th,td");

    if (cells.length < 7) return;

    const dorsalText = clean($(cells[0]).text());

    if (!/^\d{1,2}$/.test(dorsalText)) return;

    const number = Number(dorsalText);
    const position = getPositionFromCell($, cells[1]);

    const nameInfo = getNameFromCell($, cells[2]);
    if (!nameInfo || !nameInfo.text) return;

    const birthText = clean($(cells[3]).text());

    const ageMatch =
      birthText.match(/\((\d{2})\s*años?\)/i) ||
      birthText.match(/\(age\s*(\d{2})\)/i);

    const age = ageMatch ? Number(ageMatch[1]) : null;

    const caps = firstNumber($(cells[4]).text());
    const goals = firstNumber($(cells[5]).text());
    const club = getClubFromCell($, cells[6]);

    players.push({
      name: nameInfo.text,
      position,
      number,
      age,
      birthText,
      caps,
      goals,
      club,
      href: nameInfo.href,
      photo: null,
      sourceUrl,
    });
  });

  const unique = new Map();

  for (const p of players) {
    unique.set(p.name, p);
  }

  return [...unique.values()].slice(0, 35);
}

async function fetchPlayerPhoto(playerHref) {
  try {
    if (!FETCH_PHOTOS) return null;
    if (!playerHref || !playerHref.includes("/wiki/")) return null;

    const title = decodeURIComponent(playerHref.split("/wiki/")[1] || "");
    if (!title) return null;

    const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "WC26-Arena/1.0 scraper academico",
      },
    });

    return res.data?.thumbnail?.source || res.data?.originalimage?.source || null;
  } catch (_err) {
    return null;
  }
}

async function scrapePlayersForTeam(team) {
  const sourceUrl = `${ES_BASE}${encodeURIComponent(team.page)}#Jugadores`;

  try {
    const html = await fetchHtml(sourceUrl);
    const $ = cheerio.load(html);

    const tables = findCandidateTables($);

    let bestPlayers = [];

    for (const table of tables) {
      const parsed = parsePlayersFromTable($, table, sourceUrl);

      if (parsed.length > bestPlayers.length) {
        bestPlayers = parsed;
      }
    }

    for (const p of bestPlayers) {
      p.photo = await fetchPlayerPhoto(p.href);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return bestPlayers;
  } catch (err) {
    console.log(`ERROR scrapeando ${team.code} ${team.name}: ${err.message}`);
    return [];
  }
}

async function upsertTeamsAndCleanOld() {
  const allowedCodes = [];
  const teamMap = new Map();

  for (const [group, teams] of Object.entries(GROUPS)) {
    for (const team of teams) {
      allowedCodes.push(team.code);

      const doc = await Team.findOneAndUpdate(
        { code: team.code },
        {
          $set: {
            name: team.name,
            code: team.code,
            group,
            confederation: team.confederation,
            logo: null,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
        }
      );

      teamMap.set(team.code, doc);
    }
  }

  const oldTeams = await Team.find({ code: { $nin: allowedCodes } }).select("_id code name");
  const oldTeamIds = oldTeams.map((t) => t._id);

  if (oldTeamIds.length) {
    await Player.deleteMany({ team: { $in: oldTeamIds } });
    await Team.deleteMany({ _id: { $in: oldTeamIds } });
  }

  return { teamMap, allowedCodes, oldTeams };
}

function makeGroupMatches() {
  const matches = [];
  let order = 1;

  for (const [group, teams] of Object.entries(GROUPS)) {
    const [t1, t2, t3, t4] = teams;

    const base = new Date(`${FIRST_DATES[group]}T18:00:00-05:00`);

    const rounds = [
      [[t1, t2], [t3, t4]],
      [[t1, t3], [t4, t2]],
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

async function regenerateGroupMatches(teamMap) {
  await Match.deleteMany({ phase: "Group Stage" });

  const generated = makeGroupMatches();
  let saved = 0;

  for (const m of generated) {
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

    saved++;
  }

  return saved;
}

async function scrapeAndSaveAllPlayers(teamMap) {
  await Player.deleteMany({});

  const report = [];
  let totalSaved = 0;

  for (const [group, teams] of Object.entries(GROUPS)) {
    for (const team of teams) {
      const dbTeam = teamMap.get(team.code);

      if (!dbTeam) {
        report.push({
          group,
          code: team.code,
          name: team.name,
          status: "NO_DB_TEAM",
          count: 0,
        });
        continue;
      }

      const players = await scrapePlayersForTeam(team);

      for (const p of players) {
        await Player.findOneAndUpdate(
          { team: dbTeam._id, name: p.name },
          {
            $set: {
              name: p.name,
              position: p.position || "Unknown",
              number: p.number || null,
              age: p.age || null,
              club: p.club || "Unknown",
              photo: p.photo || null,
              birthText: p.birthText || null,
              caps: p.caps ?? null,
              goals: p.goals ?? null,
              sourceUrl: p.sourceUrl,
              team: dbTeam._id,
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
          }
        );

        totalSaved++;
      }

      console.log(`${team.code} ${team.name}: ${players.length} jugadores`);

      report.push({
        group,
        code: team.code,
        name: team.name,
        status: players.length > 0 ? "OK" : "SIN_DATOS",
        count: players.length,
        sample: players.slice(0, 5).map((p) => ({
          number: p.number,
          position: p.position,
          name: p.name,
          age: p.age,
          club: p.club,
          caps: p.caps,
          goals: p.goals,
          photo: Boolean(p.photo),
        })),
      });
    }
  }

  return { totalSaved, report };
}

async function main() {
  console.log("Conectando MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log("1) Corrigiendo equipos y limpiando basura...");
  const { teamMap, oldTeams } = await upsertTeamsAndCleanOld();

  console.log("Equipos viejos eliminados:", oldTeams.map((t) => `${t.code}:${t.name}`).join(", ") || "ninguno");

  console.log("2) Regenerando 72 partidos de fase de grupos...");
  const matchCount = await regenerateGroupMatches(teamMap);

  console.log("3) Scrapeando jugadores de las 48 selecciones...");
  const { totalSaved, report } = await scrapeAndSaveAllPlayers(teamMap);

  const totalTeams = await Team.countDocuments();
  const totalMatches = await Match.countDocuments({ phase: "Group Stage" });
  const totalPlayers = await Player.countDocuments();

  const reportPath = path.join(__dirname, "scraping-wc26-report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalTeams,
        totalMatches,
        totalPlayers,
        totalSaved,
        report,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log("============================================");
  console.log("SCRAPING COMPLETO TERMINADO");
  console.log("Equipos totales:", totalTeams);
  console.log("Partidos fase grupos:", totalMatches);
  console.log("Jugadores guardados:", totalPlayers);
  console.log("Reporte:", reportPath);
  console.log("============================================");

  console.table(
    report.map((r) => ({
      grupo: r.group,
      code: r.code,
      equipo: r.name,
      jugadores: r.count,
      estado: r.status,
    }))
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR GENERAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
