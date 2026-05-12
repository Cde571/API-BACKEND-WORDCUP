require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mundial2026";

const WIKI_BASE = "https://en.wikipedia.org";
const SQUADS_URL = "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads";

const GROUPS = "ABCDEFGHIJKL".split("");

const CONFED = {
  MEX: "CONCACAF", RSA: "CAF", KOR: "AFC", CZE: "UEFA",
  CAN: "CONCACAF", BIH: "UEFA", QAT: "AFC", SUI: "UEFA",
  BRA: "CONMEBOL", MAR: "CAF", HAI: "CONCACAF", SCO: "UEFA",
  USA: "CONCACAF", PAR: "CONMEBOL", AUS: "AFC", TUR: "UEFA",
  GER: "UEFA", CUW: "CONCACAF", CIV: "CAF", ECU: "CONMEBOL",
  NED: "UEFA", JPN: "AFC", SWE: "UEFA", TUN: "CAF",
  BEL: "UEFA", EGY: "CAF", IRN: "AFC", NZL: "OFC",
  ESP: "UEFA", CPV: "CAF", KSA: "AFC", URU: "CONMEBOL",
  FRA: "UEFA", SEN: "CAF", IRQ: "AFC", NOR: "UEFA",
  ARG: "CONMEBOL", ALG: "CAF", AUT: "UEFA", JOR: "AFC",
  POR: "UEFA", COD: "CAF", UZB: "AFC", COL: "CONMEBOL",
  ENG: "UEFA", CRO: "UEFA", GHA: "CAF", PAN: "CONCACAF",
};

const FALLBACK_GROUPS = {
  A: [
    ["Mexico", "MEX"],
    ["South Africa", "RSA"],
    ["South Korea", "KOR"],
    ["Czechia", "CZE"],
  ],
  B: [
    ["Canada", "CAN"],
    ["Bosnia and Herzegovina", "BIH"],
    ["Qatar", "QAT"],
    ["Switzerland", "SUI"],
  ],
  C: [
    ["Brazil", "BRA"],
    ["Morocco", "MAR"],
    ["Haiti", "HAI"],
    ["Scotland", "SCO"],
  ],
  D: [
    ["United States", "USA"],
    ["Paraguay", "PAR"],
    ["Australia", "AUS"],
    ["Türkiye", "TUR"],
  ],
  E: [
    ["Germany", "GER"],
    ["Curaçao", "CUW"],
    ["Côte d'Ivoire", "CIV"],
    ["Ecuador", "ECU"],
  ],
  F: [
    ["Netherlands", "NED"],
    ["Japan", "JPN"],
    ["Sweden", "SWE"],
    ["Tunisia", "TUN"],
  ],
  G: [
    ["Belgium", "BEL"],
    ["Egypt", "EGY"],
    ["Iran", "IRN"],
    ["New Zealand", "NZL"],
  ],
  H: [
    ["Spain", "ESP"],
    ["Cape Verde", "CPV"],
    ["Saudi Arabia", "KSA"],
    ["Uruguay", "URU"],
  ],
  I: [
    ["France", "FRA"],
    ["Senegal", "SEN"],
    ["Iraq", "IRQ"],
    ["Norway", "NOR"],
  ],
  J: [
    ["Argentina", "ARG"],
    ["Algeria", "ALG"],
    ["Austria", "AUT"],
    ["Jordan", "JOR"],
  ],
  K: [
    ["Portugal", "POR"],
    ["Congo DR", "COD"],
    ["Uzbekistan", "UZB"],
    ["Colombia", "COL"],
  ],
  L: [
    ["England", "ENG"],
    ["Croatia", "CRO"],
    ["Ghana", "GHA"],
    ["Panama", "PAN"],
  ],
};

const TEAM_ALIASES = {
  "Korea Republic": "South Korea",
  "Republic of Korea": "South Korea",
  "Czech Republic": "Czechia",
  "Côte d’Ivoire": "Côte d'Ivoire",
  "Cote d’Ivoire": "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire",
  "Ivory Coast": "Côte d'Ivoire",
  "IR Iran": "Iran",
  "USA": "United States",
  "United States of America": "United States",
  "Cape Verde Islands": "Cape Verde",
  "Cabo Verde": "Cape Verde",
  "Türkiye": "Türkiye",
  "Turkey": "Türkiye",
  "DR Congo": "Congo DR",
  "Congo Democratic Republic": "Congo DR",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
};

const CODE_BY_NAME = {};
for (const [group, arr] of Object.entries(FALLBACK_GROUPS)) {
  for (const [name, code] of arr) {
    CODE_BY_NAME[name] = code;
  }
}
for (const [alias, canonical] of Object.entries(TEAM_ALIASES)) {
  if (CODE_BY_NAME[canonical]) CODE_BY_NAME[alias] = CODE_BY_NAME[canonical];
}

const TEAM_PAGE_BY_NAME = {
  "Mexico": "Mexico_national_football_team",
  "South Africa": "South_Africa_national_soccer_team",
  "South Korea": "South_Korea_national_football_team",
  "Czechia": "Czech_Republic_national_football_team",

  "Canada": "Canada_men%27s_national_soccer_team",
  "Bosnia and Herzegovina": "Bosnia_and_Herzegovina_national_football_team",
  "Qatar": "Qatar_national_football_team",
  "Switzerland": "Switzerland_national_football_team",

  "Brazil": "Brazil_national_football_team",
  "Morocco": "Morocco_national_football_team",
  "Haiti": "Haiti_national_football_team",
  "Scotland": "Scotland_national_football_team",

  "United States": "United_States_men%27s_national_soccer_team",
  "Paraguay": "Paraguay_national_football_team",
  "Australia": "Australia_men%27s_national_soccer_team",
  "Türkiye": "Turkey_national_football_team",

  "Germany": "Germany_national_football_team",
  "Curaçao": "Cura%C3%A7ao_national_football_team",
  "Côte d'Ivoire": "Ivory_Coast_national_football_team",
  "Ecuador": "Ecuador_national_football_team",

  "Netherlands": "Netherlands_national_football_team",
  "Japan": "Japan_national_football_team",
  "Sweden": "Sweden_national_football_team",
  "Tunisia": "Tunisia_national_football_team",

  "Belgium": "Belgium_national_football_team",
  "Egypt": "Egypt_national_football_team",
  "Iran": "Iran_national_football_team",
  "New Zealand": "New_Zealand_national_football_team",

  "Spain": "Spain_national_football_team",
  "Cape Verde": "Cape_Verde_national_football_team",
  "Saudi Arabia": "Saudi_Arabia_national_football_team",
  "Uruguay": "Uruguay_national_football_team",

  "France": "France_national_football_team",
  "Senegal": "Senegal_national_football_team",
  "Iraq": "Iraq_national_football_team",
  "Norway": "Norway_national_football_team",

  "Argentina": "Argentina_national_football_team",
  "Algeria": "Algeria_national_football_team",
  "Austria": "Austria_national_football_team",
  "Jordan": "Jordan_national_football_team",

  "Portugal": "Portugal_national_football_team",
  "Congo DR": "DR_Congo_national_football_team",
  "Uzbekistan": "Uzbekistan_national_football_team",
  "Colombia": "Colombia_national_football_team",

  "England": "England_national_football_team",
  "Croatia": "Croatia_national_football_team",
  "Ghana": "Ghana_national_football_team",
  "Panama": "Panama_national_football_team",
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

TeamSchema.index({ group: 1 });
PlayerSchema.index({ team: 1, name: 1 }, { unique: true });
MatchSchema.index({ group: 1, matchDate: 1 });

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

function normTeamName(name) {
  const v = clean(name)
    .replace(/^Team\s+/i, "")
    .replace(/\s+national football team$/i, "")
    .trim();

  return TEAM_ALIASES[v] || v;
}

function positionToEnum(pos) {
  const p = clean(pos).toUpperCase();
  if (["GK", "GOALKEEPER"].includes(p)) return "GK";
  if (["DF", "DEFENDER"].includes(p)) return "DF";
  if (["MF", "MIDFIELDER"].includes(p)) return "MF";
  if (["FW", "FORWARD"].includes(p)) return "FW";
  return "Unknown";
}

function buildMatchKey(group, homeName, awayName, date) {
  const d = new Date(date).toISOString().slice(0, 16);
  return `Group Stage|${group}|${homeName}|${awayName}|${d}`;
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent": "WC26-Arena/1.0 educational scraper contact: local-dev",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  return res.data;
}

async function upsertFallbackTeams() {
  const teamMap = new Map();

  for (const [group, list] of Object.entries(FALLBACK_GROUPS)) {
    for (const [name, code] of list) {
      const doc = await Team.findOneAndUpdate(
        { code },
        {
          $set: {
            name,
            code,
            group,
            confederation: CONFED[code] || null,
            logo: null,
          },
        },
        { upsert: true, returnDocument: "after", runValidators: true }
      );

      teamMap.set(name, doc);
    }
  }

  return teamMap;
}

function extractTeamsFromGroupPage(html, group) {
  const $ = cheerio.load(html);
  const out = [];

  $("table.wikitable").each((_i, table) => {
    const text = clean($(table).text());
    if (!text.includes("Draw position") || !text.includes("Confederation")) return;

    $(table).find("tr").each((_j, row) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;

      const pos = clean($(cells[0]).text());
      if (!new RegExp(`^${group}\\d$`).test(pos)) return;

      const teamText =
        clean($(cells[1]).find("a").first().text()) ||
        clean($(cells[1]).text());

      const teamName = normTeamName(teamText);
      const code = CODE_BY_NAME[teamName];

      if (teamName && code) {
        out.push({ group, name: teamName, code });
      }
    });
  });

  return out;
}

function parseDateHeading(text) {
  const t = clean(text);
  const match = t.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2})\s+([A-Za-z]+)\s+2026/i);
  if (!match) return null;

  const day = match[2].padStart(2, "0");
  const monthName = match[3].toLowerCase();
  const months = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };

  const month = months[monthName];
  if (!month) return null;

  return `2026-${month}-${day}`;
}

function parseWikiDateTime($table, currentDate) {
  const dt =
    $table.find(".dtstart").attr("data-sort-value") ||
    $table.find(".dtstart").attr("title") ||
    $table.find(".dtstart").text();

  const cleaned = clean(dt);

  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const normalized = cleaned.replace(" ", "T");
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const rowText = clean($table.find("tr").first().text());
  const timeMatch = rowText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : "12:00";

  if (!currentDate) return null;

  return new Date(`${currentDate}T${time}:00Z`);
}

function extractFixturesFromGroupPage(html, group) {
  const $ = cheerio.load(html);
  const fixtures = [];
  let currentDate = null;

  $(".mw-parser-output").children().each((_i, el) => {
    const $el = $(el);
    const tag = (el.tagName || "").toLowerCase();
    const text = clean($el.text());

    if (["h2", "h3", "h4"].includes(tag)) {
      const parsed = parseDateHeading(text);
      if (parsed) currentDate = parsed;
    }

    const isMatchBox =
      $el.is("table.vevent") ||
      $el.hasClass("vevent") ||
      $el.find(".vcard.attendee").length >= 2;

    if (!isMatchBox) return;

    const $table = $el.is("table") ? $el : $el.find("table").first();

    let teams = $table
      .find(".vcard.attendee")
      .map((_idx, node) => normTeamName($(node).text()))
      .get()
      .filter(Boolean);

    if (teams.length < 2) {
      const firstRowLinks = $table
        .find("tr")
        .first()
        .find("a")
        .map((_idx, node) => normTeamName($(node).text()))
        .get()
        .filter((x) => CODE_BY_NAME[x]);

      teams = firstRowLinks.slice(0, 2);
    }

    if (teams.length < 2) return;

    const homeName = teams[0];
    const awayName = teams[1];

    if (!CODE_BY_NAME[homeName] || !CODE_BY_NAME[awayName]) return;

    const matchDate = parseWikiDateTime($table, currentDate);
    if (!matchDate) return;

    const stadium =
      clean($table.find(".location").text()) ||
      clean($table.find("tr").last().text()) ||
      null;

    fixtures.push({
      group,
      homeName,
      awayName,
      matchDate,
      stadium,
      phase: "Group Stage",
      status: "Scheduled",
    });
  });

  return fixtures;
}

async function scrapeGroupsAndFixtures() {
  let allFixtures = [];

  for (const group of GROUPS) {
    const url = `${WIKI_BASE}/wiki/2026_FIFA_World_Cup_Group_${group}`;
    console.log(`Scraping Grupo ${group}: ${url}`);

    try {
      const html = await fetchHtml(url);

      const teams = extractTeamsFromGroupPage(html, group);
      for (const t of teams) {
        await Team.findOneAndUpdate(
          { code: t.code },
          {
            $set: {
              name: t.name,
              code: t.code,
              group,
              confederation: CONFED[t.code] || null,
            },
          },
          { upsert: true, returnDocument: "after", runValidators: true }
        );
      }

      const fixtures = extractFixturesFromGroupPage(html, group);
      console.log(`Grupo ${group}: equipos_scraped=${teams.length}, partidos_scraped=${fixtures.length}`);

      allFixtures.push(...fixtures);
    } catch (err) {
      console.warn(`No se pudo scrapear Grupo ${group}: ${err.message}`);
    }
  }

  return allFixtures;
}

async function upsertFixtures(fixtures) {
  let count = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];

    const home = await Team.findOne({ code: CODE_BY_NAME[f.homeName] });
    const away = await Team.findOne({ code: CODE_BY_NAME[f.awayName] });

    if (!home || !away) {
      console.warn("Fixture omitido por equipo faltante:", f.homeName, "vs", f.awayName);
      continue;
    }

    const matchKey = buildMatchKey(f.group, f.homeName, f.awayName, f.matchDate);

    await Match.findOneAndUpdate(
      { matchKey },
      {
        $set: {
          matchKey,
          homeTeam: home._id,
          awayTeam: away._id,
          homeScore: null,
          awayScore: null,
          matchDate: f.matchDate,
          stadium: f.stadium || null,
          group: f.group,
          matchOrder: i + 1,
          phase: f.phase || "Group Stage",
          status: f.status || "Scheduled",
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    );

    count++;
  }

  return count;
}

function extractPlayersFromSquadTable($, table, teamName) {
  const players = [];

  $(table).find("tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const values = cells.map((_j, c) => clean($(c).text())).get();

    let number = null;
    let position = "Unknown";
    let name = "";
    let age = null;
    let club = "Unknown";

    const numberCandidate = values.find((v) => /^\d{1,2}$/.test(v));
    if (numberCandidate) number = Number(numberCandidate);

    const posCandidate = values.find((v) => /^(GK|DF|MF|FW|Goalkeeper|Defender|Midfielder|Forward)$/i.test(v));
    if (posCandidate) position = positionToEnum(posCandidate);

    const nameLink = $(row).find("a").filter((_j, a) => {
      const t = clean($(a).text());
      return t && !TEAM_ALIASES[t] && !CODE_BY_NAME[t] && !/national|club|team/i.test(t);
    }).first();

    name = clean(nameLink.text());

    const ageCandidate = values.find((v) => /^\d{2}$/.test(v) && Number(v) >= 16 && Number(v) <= 50);
    if (ageCandidate) age = Number(ageCandidate);

    const lastLink = clean($(row).find("a").last().text());
    if (lastLink && lastLink !== name) club = lastLink;

    if (!name || name.length < 3) return;

    players.push({
      teamName,
      name,
      position,
      number,
      age,
      club,
      photo: null,
    });
  });

  return players;
}

async function scrapeSquadsPage() {
  console.log("Scraping página de plantillas del Mundial 2026...");
  const html = await fetchHtml(SQUADS_URL);
  const $ = cheerio.load(html);
  const players = [];

  let currentTeam = null;

  $(".mw-parser-output").children().each((_i, el) => {
    const $el = $(el);
    const tag = (el.tagName || "").toLowerCase();

    if (["h2", "h3", "h4"].includes(tag)) {
      const title = normTeamName($el.text());
      if (CODE_BY_NAME[title]) {
        currentTeam = title;
      }
      return;
    }

    if (currentTeam && $el.is("table")) {
      const tableText = clean($el.text());
      if (tableText.includes("No.") || tableText.includes("Pos.") || tableText.includes("Club")) {
        players.push(...extractPlayersFromSquadTable($, el, currentTeam));
      }
    }
  });

  return players;
}

async function scrapeNationalTeamCurrentSquad(teamName) {
  const page = TEAM_PAGE_BY_NAME[teamName];
  if (!page) return [];

  const url = `${WIKI_BASE}/wiki/${page}`;
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const players = [];
    let inCurrentSquad = false;

    $(".mw-parser-output").children().each((_i, el) => {
      const $el = $(el);
      const tag = (el.tagName || "").toLowerCase();
      const text = clean($el.text());

      if (["h2", "h3", "h4"].includes(tag)) {
        inCurrentSquad = /current squad|squad|players/i.test(text);
      }

      if (inCurrentSquad && $el.is("table")) {
        const tableText = clean($el.text());
        if (tableText.includes("Pos") || tableText.includes("Player") || tableText.includes("Club")) {
          players.push(...extractPlayersFromSquadTable($, el, teamName));
        }
      }
    });

    return players.slice(0, 35);
  } catch (err) {
    console.warn(`No se pudo scrapear jugadores de ${teamName}: ${err.message}`);
    return [];
  }
}

async function upsertPlayers(players) {
  let count = 0;

  for (const p of players) {
    const code = CODE_BY_NAME[p.teamName];
    if (!code) continue;

    const team = await Team.findOne({ code });
    if (!team) continue;

    await Player.findOneAndUpdate(
      { team: team._id, name: p.name },
      {
        $set: {
          name: p.name,
          position: p.position || "Unknown",
          number: p.number || null,
          club: p.club || "Unknown",
          age: p.age || null,
          photo: p.photo || null,
          team: team._id,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    );

    count++;
  }

  return count;
}

async function main() {
  console.log("Conectando a MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log("1) Upsert de grupos base actualizados...");
  await upsertFallbackTeams();

  console.log("2) Scraping de grupos y fixtures...");
  const fixtures = await scrapeGroupsAndFixtures();

  if (fixtures.length < 50) {
    console.warn(`Solo se encontraron ${fixtures.length} partidos en scraping. Revisa estructura HTML de Wikipedia/FIFA.`);
  }

  const matchesSaved = await upsertFixtures(fixtures);

  console.log("3) Scraping de jugadores desde página de squads...");
  let allPlayers = [];
  try {
    allPlayers = await scrapeSquadsPage();
  } catch (err) {
    console.warn("No se pudo scrapear página global de squads:", err.message);
  }

  const groupedPlayerCounts = new Map();
  for (const p of allPlayers) {
    groupedPlayerCounts.set(p.teamName, (groupedPlayerCounts.get(p.teamName) || 0) + 1);
  }

  console.log("4) Completando jugadores faltantes desde páginas de selecciones...");
  for (const list of Object.values(FALLBACK_GROUPS)) {
    for (const [teamName] of list) {
      const current = groupedPlayerCounts.get(teamName) || 0;
      if (current >= 18) continue;

      const extra = await scrapeNationalTeamCurrentSquad(teamName);
      allPlayers.push(...extra);
      console.log(`${teamName}: +${extra.length} jugadores fallback`);
    }
  }

  const unique = new Map();
  for (const p of allPlayers) {
    const key = `${p.teamName}|${p.name}`;
    if (!unique.has(key)) unique.set(key, p);
  }

  const playersSaved = await upsertPlayers([...unique.values()]);

  const totalTeams = await Team.countDocuments();
  const totalMatches = await Match.countDocuments();
  const totalPlayers = await Player.countDocuments();

  console.log("============================================");
  console.log("SCRAPING TERMINADO");
  console.log(`Equipos en DB: ${totalTeams}`);
  console.log(`Partidos guardados/actualizados ahora: ${matchesSaved}`);
  console.log(`Partidos totales en DB: ${totalMatches}`);
  console.log(`Jugadores guardados/actualizados ahora: ${playersSaved}`);
  console.log(`Jugadores totales en DB: ${totalPlayers}`);
  console.log("============================================");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR SCRAPER:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
