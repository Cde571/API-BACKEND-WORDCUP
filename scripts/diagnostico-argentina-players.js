require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mundial2026";

const ARGENTINA_PAGE = "Selección_de_fútbol_de_Argentina";
const ARGENTINA_URL = "https://es.wikipedia.org/wiki/Selecci%C3%B3n_de_f%C3%BAtbol_de_Argentina#Jugadores";

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

PlayerSchema.index({ team: 1, name: 1 }, { unique: true });

const Team = mongoose.model("Team", TeamSchema);
const Player = mongoose.model("Player", PlayerSchema);

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

function getPosition($, cell) {
  const text = normalize($(cell).text());
  const titleText = normalize(
    $(cell)
      .find("a,img,span")
      .map((_i, el) => {
        return [
          $(el).attr("title"),
          $(el).attr("alt"),
          $(el).attr("about"),
          $(el).text(),
        ].filter(Boolean).join(" ");
      })
      .get()
      .join(" ")
  );

  const all = `${text} ${titleText}`;

  if (all.includes("guardameta") || all.includes("portero") || all.includes("arquero") || all.includes("por")) {
    return "GK";
  }

  if (all.includes("defensa") || all.includes("defensor") || all.includes("def")) {
    return "DF";
  }

  if (all.includes("centrocampista") || all.includes("mediocampista") || all.includes("volante") || all.includes("med")) {
    return "MF";
  }

  if (all.includes("delantero") || all.includes("atacante") || all.includes("del")) {
    return "FW";
  }

  return "Unknown";
}

function getBestLinkText($, cell) {
  const links = $(cell)
    .find("a")
    .map((_i, a) => {
      const text = clean($(a).text());
      const href = clean($(a).attr("href"));
      const title = clean($(a).attr("title"));

      return { text, href, title };
    })
    .get()
    .filter((x) => {
      if (!x.text || x.text.length < 3) return false;
      if (!x.href.includes("/wiki/")) return false;
      if (/bandera|archivo|image|provincia|selecci[oó]n|f[uú]tbol/i.test(`${x.text} ${x.title}`)) return false;
      return true;
    });

  return links.length ? links[0] : null;
}

function getClub($, cell) {
  const links = $(cell)
    .find("a")
    .map((_i, a) => {
      const text = clean($(a).text());
      const title = clean($(a).attr("title"));
      const href = clean($(a).attr("href"));
      return { text, title, href };
    })
    .get()
    .filter((x) => {
      if (!x.text || x.text.length < 2) return false;
      if (/bandera|archivo|image/i.test(`${x.text} ${x.title}`)) return false;
      return true;
    });

  if (links.length) return links[links.length - 1].text;

  const text = clean($(cell).text());
  return text || "Unknown";
}

async function fetchWikipediaHtml(page) {
  const response = await axios.get("https://es.wikipedia.org/w/api.php", {
    timeout: 30000,
    params: {
      action: "parse",
      page,
      prop: "text",
      format: "json",
      origin: "*",
    },
    headers: {
      "User-Agent": "WC26-Arena/1.0 diagnostic scraper",
    },
  });

  return response.data?.parse?.text?.["*"] || "";
}

async function fetchPhotoFromSummary(playerHref) {
  try {
    if (!playerHref || !playerHref.includes("/wiki/")) return null;

    const title = decodeURIComponent(playerHref.split("/wiki/")[1] || "");
    if (!title) return null;

    const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "WC26-Arena/1.0 diagnostic scraper",
      },
    });

    return response.data?.thumbnail?.source || response.data?.originalimage?.source || null;
  } catch (_err) {
    return null;
  }
}

function findCallupTable($) {
  let selected = null;

  $("table").each((_i, table) => {
    const header = normalize($(table).find("th").text());
    const body = normalize($(table).text());

    const hasPlayerHeaders =
      (header.includes("n.º") || header.includes("n°") || header.includes("n.o") || body.includes("n.º")) &&
      (header.includes("posicion") || body.includes("posicion")) &&
      (header.includes("nombre") || body.includes("nombre")) &&
      (header.includes("fecha de nacimiento") || body.includes("fecha de nacimiento")) &&
      (header.includes("equipo") || body.includes("equipo"));

    if (hasPlayerHeaders && !selected) {
      selected = table;
    }
  });

  return selected;
}

async function scrapeArgentinaPlayers() {
  const html = await fetchWikipediaHtml(ARGENTINA_PAGE);
  const $ = cheerio.load(html);

  const table = findCallupTable($);

  if (!table) {
    throw new Error("No se encontró la tabla de Última convocatoria");
  }

  const players = [];

  $(table)
    .find("tr")
    .each((_i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 7) return;

      const number = firstNumber($(cells[0]).text());
      const position = getPosition($, cells[1]);

      const nameLink = getBestLinkText($, cells[2]);
      const name = nameLink?.text || "";
      const href = nameLink?.href || null;

      if (!name || name.length < 4) return;

      const birthText = clean($(cells[3]).text());
      const ageMatch = birthText.match(/\((\d{2})\s*años?\)/i);
      const age = ageMatch ? Number(ageMatch[1]) : null;

      const caps = firstNumber($(cells[4]).text());
      const goals = firstNumber($(cells[5]).text());
      const club = getClub($, cells[6]);

      players.push({
        name,
        position,
        number,
        age,
        birthText,
        caps,
        goals,
        club,
        href,
        photo: null,
        sourceUrl: ARGENTINA_URL,
      });
    });

  const unique = new Map();

  for (const p of players) {
    unique.set(p.name, p);
  }

  const result = [...unique.values()].slice(0, 35);

  for (let i = 0; i < result.length; i++) {
    result[i].photo = await fetchPhotoFromSummary(result[i].href);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return result;
}

async function main() {
  console.log("Conectando a MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const argentina = await Team.findOneAndUpdate(
    { code: "ARG" },
    {
      $set: {
        name: "Argentina",
        code: "ARG",
        group: "J",
        confederation: "CONMEBOL",
        logo: null,
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  );

  console.log("Scrapeando Argentina...");
  const players = await scrapeArgentinaPlayers();

  console.log("");
  console.log("DATOS DETECTADOS:");
  console.table(
    players.slice(0, 15).map((p) => ({
      nro: p.number,
      pos: p.position,
      nombre: p.name,
      edad: p.age,
      pj: p.caps,
      goles: p.goals,
      club: p.club,
      foto: p.photo ? "SI" : "NO",
    }))
  );

  await Player.deleteMany({ team: argentina._id });

  for (const p of players) {
    await Player.findOneAndUpdate(
      { team: argentina._id, name: p.name },
      {
        $set: {
          name: p.name,
          position: p.position,
          number: p.number,
          age: p.age,
          club: p.club || "Unknown",
          photo: p.photo || null,
          birthText: p.birthText || null,
          caps: p.caps ?? null,
          goals: p.goals ?? null,
          sourceUrl: p.sourceUrl,
          team: argentina._id,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
  }

  const outPath = path.join(__dirname, "diagnostico-argentina-players.json");
  fs.writeFileSync(outPath, JSON.stringify(players, null, 2), "utf8");

  const totalArgentina = await Player.countDocuments({ team: argentina._id });
  const totalAll = await Player.countDocuments();

  console.log("");
  console.log("============================================");
  console.log("DIAGNÓSTICO TERMINADO");
  console.log("Jugadores Argentina guardados:", totalArgentina);
  console.log("Jugadores totales en DB:", totalAll);
  console.log("JSON generado:", outPath);
  console.log("Prueba API:");
  console.log(`http://localhost:4000/api/players?teamId=${argentina._id}`);
  console.log("============================================");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR DIAGNÓSTICO:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
