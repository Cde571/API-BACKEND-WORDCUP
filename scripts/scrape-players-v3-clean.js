require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mundial2026";

const MIN_VALID_PLAYERS = 10;
const FETCH_PHOTOS = process.env.FETCH_PHOTOS === "true"; // por defecto NO descarga fotos para evitar 429
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 3500);

const ES = "https://es.wikipedia.org/wiki/";
const EN = "https://en.wikipedia.org/wiki/";

const PLACEHOLDERS = ["F1W", "F2W", "U1W", "U2W", "U3W"];

const ES_PAGES = {
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

const EN_PAGES = {
  MEX: "Mexico_national_football_team",
  RSA: "South_Africa_national_soccer_team",
  KOR: "South_Korea_national_football_team",
  CZE: "Czech_Republic_national_football_team",
  CAN: "Canada_men%27s_national_soccer_team",
  BIH: "Bosnia_and_Herzegovina_national_football_team",
  QAT: "Qatar_national_football_team",
  SUI: "Switzerland_national_football_team",
  BRA: "Brazil_national_football_team",
  MAR: "Morocco_national_football_team",
  HAI: "Haiti_national_football_team",
  SCO: "Scotland_national_football_team",
  USA: "United_States_men%27s_national_soccer_team",
  PAR: "Paraguay_national_football_team",
  AUS: "Australia_men%27s_national_soccer_team",
  TUR: "Turkey_national_football_team",
  GER: "Germany_national_football_team",
  CUW: "Cura%C3%A7ao_national_football_team",
  CIV: "Ivory_Coast_national_football_team",
  ECU: "Ecuador_national_football_team",
  NED: "Netherlands_national_football_team",
  JPN: "Japan_national_football_team",
  SWE: "Sweden_national_football_team",
  TUN: "Tunisia_national_football_team",
  BEL: "Belgium_national_football_team",
  EGY: "Egypt_national_football_team",
  IRN: "Iran_national_football_team",
  NZL: "New_Zealand_national_football_team",
  ESP: "Spain_national_football_team",
  CPV: "Cape_Verde_national_football_team",
  KSA: "Saudi_Arabia_national_football_team",
  URU: "Uruguay_national_football_team",
  FRA: "France_national_football_team",
  SEN: "Senegal_national_football_team",
  IRQ: "Iraq_national_football_team",
  NOR: "Norway_national_football_team",
  ARG: "Argentina_national_football_team",
  ALG: "Algeria_national_football_team",
  AUT: "Austria_national_football_team",
  JOR: "Jordan_national_football_team",
  POR: "Portugal_national_football_team",
  COD: "DR_Congo_national_football_team",
  UZB: "Uzbekistan_national_football_team",
  COL: "Colombia_national_football_team",
  ENG: "England_national_football_team",
  CRO: "Croatia_national_football_team",
  GHA: "Ghana_national_football_team",
  PAN: "Panama_national_football_team",
};

const TeamSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

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

PlayerSchema.index({ team: 1, name: 1 }, { unique: true });

const Team = mongoose.model("Team", TeamSchema);
const Player = mongoose.model("Player", PlayerSchema);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  if (
    text.includes("guardameta") ||
    text.includes("portero") ||
    text.includes("arquero") ||
    text.includes("goalkeeper") ||
    text.includes("por") ||
    text.includes("gk")
  ) return "GK";

  if (
    text.includes("defensa") ||
    text.includes("defensor") ||
    text.includes("defender") ||
    text.includes("def") ||
    text.includes("df")
  ) return "DF";

  if (
    text.includes("mediocampista") ||
    text.includes("centrocampista") ||
    text.includes("midfielder") ||
    text.includes("volante") ||
    text.includes("med") ||
    text.includes("mf")
  ) return "MF";

  if (
    text.includes("delantero") ||
    text.includes("atacante") ||
    text.includes("forward") ||
    text.includes("striker") ||
    text.includes("del") ||
    text.includes("fw")
  ) return "FW";

  return "Unknown";
}

async function fetchHtml(url, attempt = 1) {
  try {
    const res = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent": "WC26-Arena/1.0 educational scraper",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    return res.data;
  } catch (err) {
    const status = err.response?.status;

    if (status === 429 && attempt <= 3) {
      const wait = attempt * 25000;
      console.log(`429 en ${url}. Esperando ${wait / 1000}s y reintentando...`);
      await sleep(wait);
      return fetchHtml(url, attempt + 1);
    }

    throw err;
  }
}

function validWikiLink($, a) {
  const text = clean($(a).text());
  const href = clean($(a).attr("href"));
  const title = clean($(a).attr("title"));

  if (!text || text.length < 3) return false;
  if (!href.includes("/wiki/")) return false;

  const all = normalize(`${text} ${href} ${title}`);

  if (all.includes("archivo:")) return false;
  if (all.includes("file:")) return false;
  if (all.includes("bandera")) return false;
  if (all.includes("flag")) return false;
  if (all.includes("provincia")) return false;
  if (all.includes("seleccion")) return false;
  if (all.includes("national football team")) return false;
  if (all.includes("guardameta")) return false;
  if (all.includes("defensa")) return false;
  if (all.includes("delantero")) return false;
  if (all.includes("centrocampista")) return false;
  if (all.includes("goalkeeper")) return false;
  if (all.includes("defender")) return false;
  if (all.includes("midfielder")) return false;
  if (all.includes("forward")) return false;

  return true;
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
          ].filter(Boolean).join(" ");
        })
        .get()
        .join(" ")
    );

  return positionToEnum(raw);
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

function parsePlayersFromTable($, table, sourceUrl) {
  const players = [];

  table.find("tr").each((_i, row) => {
    const cells = $(row).children("th,td");
    if (cells.length < 5) return;

    let number = null;
    let posIndex = null;
    let nameIndex = null;
    let birthIndex = null;
    let capsIndex = null;
    let goalsIndex = null;
    let clubIndex = null;

    const first = clean($(cells[0]).text());
    const firstIsNumber = /^\d{1,2}$/.test(first);

    if (firstIsNumber && cells.length >= 7) {
      number = Number(first);
      posIndex = 1;
      nameIndex = 2;
      birthIndex = 3;
      capsIndex = 4;
      goalsIndex = 5;
      clubIndex = 6;
    } else {
      // Formato sin dorsal: Pos | Nombre | Nacimiento | PJ | G | Club
      const maybePos = getPositionFromCell($, cells[0]);

      if (maybePos === "Unknown") return;

      posIndex = 0;
      nameIndex = 1;
      birthIndex = 2;
      capsIndex = 3;
      goalsIndex = 4;
      clubIndex = 5;
    }

    if (cells.length <= clubIndex) return;

    const position = getPositionFromCell($, cells[posIndex]);
    const nameInfo = getNameFromCell($, cells[nameIndex]);
    if (!nameInfo || !nameInfo.text) return;

    const birthText = clean($(cells[birthIndex]).text());

    const ageMatch =
      birthText.match(/\((\d{2})\s*años?\)/i) ||
      birthText.match(/\(age\s*(\d{2})\)/i) ||
      birthText.match(/\((\d{2})\)/);

    const age = ageMatch ? Number(ageMatch[1]) : null;
    const caps = firstNumber($(cells[capsIndex]).text());
    const goals = firstNumber($(cells[goalsIndex]).text());
    const club = getClubFromCell($, cells[clubIndex]);

    const badName = normalize(nameInfo.text);
    if (
      badName.includes("posicion") ||
      badName.includes("nombre") ||
      badName.includes("fecha") ||
      badName.includes("equipo")
    ) return;

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
  for (const p of players) unique.set(p.name, p);

  return [...unique.values()].slice(0, 35);
}

function findBestPlayersTable($, sourceUrl) {
  let best = [];

  $("table").each((_i, table) => {
    const parsed = parsePlayersFromTable($, $(table), sourceUrl);

    let score = parsed.length;

    const tableText = normalize($(table).text());

    if (tableText.includes("posicion")) score += 3;
    if (tableText.includes("nombre")) score += 3;
    if (tableText.includes("fecha de nacimiento") || tableText.includes("date of birth")) score += 3;
    if (tableText.includes("equipo") || tableText.includes("club")) score += 3;

    if (score > best.length) {
      best = parsed;
    }
  });

  return best;
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
        "User-Agent": "WC26-Arena/1.0 educational scraper",
      },
    });

    return res.data?.thumbnail?.source || res.data?.originalimage?.source || null;
  } catch (_err) {
    return null;
  }
}

async function scrapeUrl(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const players = findBestPlayersTable($, url);

  if (FETCH_PHOTOS) {
    for (const p of players) {
      p.photo = await fetchPlayerPhoto(p.href);
      await sleep(500);
    }
  }

  return players;
}

async function scrapeTeam(team) {
  const candidates = [];

  if (ES_PAGES[team.code]) {
    candidates.push({
      lang: "ES",
      url: `${ES}${encodeURIComponent(ES_PAGES[team.code])}#Jugadores`,
    });
  }

  if (EN_PAGES[team.code]) {
    candidates.push({
      lang: "EN",
      url: `${EN}${EN_PAGES[team.code]}`,
    });
  }

  let best = [];
  let bestLang = null;
  let bestUrl = null;
  let error = null;

  for (const c of candidates) {
    try {
      const players = await scrapeUrl(c.url);

      if (players.length > best.length) {
        best = players;
        bestLang = c.lang;
        bestUrl = c.url;
      }

      if (best.length >= MIN_VALID_PLAYERS) break;
    } catch (err) {
      error = err.message;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { players: best, lang: bestLang, url: bestUrl, error };
}

async function main() {
  console.log("Conectando MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log("Limpiando placeholders viejos...");
  const oldTeams = await Team.find({ code: { $in: PLACEHOLDERS } }).select("_id code name");
  const oldIds = oldTeams.map((t) => t._id);

  if (oldIds.length) {
    await Player.deleteMany({ team: { $in: oldIds } });
    await Team.deleteMany({ _id: { $in: oldIds } });
  }

  const teams = await Team.find({
    code: { $nin: PLACEHOLDERS },
    group: { $ne: null },
  }).sort({ group: 1, code: 1 });

  console.log("Equipos a procesar:", teams.length);

  const report = [];
  let totalSaved = 0;

  for (const team of teams) {
    const result = await scrapeTeam(team);

    const ok = result.players.length >= MIN_VALID_PLAYERS;

    if (ok) {
      await Player.deleteMany({ team: team._id });

      for (const p of result.players) {
        await Player.findOneAndUpdate(
          { team: team._id, name: p.name },
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
              team: team._id,
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
    } else {
      // Borra resultados malos de 1, 4, etc. para que no se vea basura en frontend.
      await Player.deleteMany({ team: team._id });
    }

    const status = ok ? "OK" : "REVISAR";

    console.log(`${team.code} ${team.name}: ${result.players.length} jugadores | ${status} | fuente=${result.lang || "N/A"}`);

    report.push({
      group: team.group,
      code: team.code,
      name: team.name,
      count: result.players.length,
      saved: ok ? result.players.length : 0,
      status,
      sourceLang: result.lang,
      sourceUrl: result.url,
      error: result.error,
      sample: result.players.slice(0, 5).map((p) => ({
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

    await sleep(REQUEST_DELAY_MS);
  }

  const totalTeams = await Team.countDocuments({ code: { $nin: PLACEHOLDERS } });
  const totalPlayers = await Player.countDocuments();

  const reportPath = path.join(__dirname, "scraping-players-v3-report.json");

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        fetchPhotos: FETCH_PHOTOS,
        requestDelayMs: REQUEST_DELAY_MS,
        minValidPlayers: MIN_VALID_PLAYERS,
        totalTeams,
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
  console.log("SCRAPER V3 TERMINADO");
  console.log("Equipos totales:", totalTeams);
  console.log("Jugadores totales guardados:", totalPlayers);
  console.log("Reporte:", reportPath);
  console.log("============================================");

  console.table(
    report.map((r) => ({
      grupo: r.group,
      code: r.code,
      equipo: r.name,
      detectados: r.count,
      guardados: r.saved,
      estado: r.status,
      fuente: r.sourceLang,
    }))
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR GENERAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
