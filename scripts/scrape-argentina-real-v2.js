require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mundial2026";
const ARG_URL = "https://es.wikipedia.org/wiki/Selecci%C3%B3n_de_f%C3%BAtbol_de_Argentina#Jugadores";

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
    position: {
      type: String,
      enum: ["GK", "DF", "MF", "FW", "Unknown"],
      default: "Unknown",
    },
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

function positionToEnum(value) {
  const text = normalize(value);

  if (
    text.includes("guardameta") ||
    text.includes("portero") ||
    text.includes("arquero") ||
    text.includes("por") ||
    text.includes("gk")
  ) {
    return "GK";
  }

  if (
    text.includes("defensa") ||
    text.includes("defensor") ||
    text.includes("def") ||
    text.includes("df")
  ) {
    return "DF";
  }

  if (
    text.includes("mediocampista") ||
    text.includes("centrocampista") ||
    text.includes("volante") ||
    text.includes("med") ||
    text.includes("mf")
  ) {
    return "MF";
  }

  if (
    text.includes("delantero") ||
    text.includes("atacante") ||
    text.includes("del") ||
    text.includes("fw")
  ) {
    return "FW";
  }

  return "Unknown";
}

async function fetchHtml() {
  const res = await axios.get(ARG_URL, {
    timeout: 30000,
    headers: {
      "User-Agent": "WC26-Arena/1.0 scraper academico",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  return res.data;
}

function findCallupTable($) {
  let selected = null;

  $("section").each((_i, section) => {
    const label = normalize($(section).attr("aria-labelledby") || "");

    if (
      label.includes("ultima_convocatoria") ||
      label.includes("ultima convocatoria")
    ) {
      const table = $(section).find("table").first();
      if (table.length) selected = table;
    }
  });

  if (selected) return selected;

  $("table").each((_i, table) => {
    if (selected) return;

    const txt = normalize($(table).text());

    const looksLikePlayersTable =
      txt.includes("posicion") &&
      txt.includes("nombre") &&
      txt.includes("fecha de nacimiento") &&
      txt.includes("equipo");

    if (looksLikePlayersTable) {
      selected = $(table);
    }
  });

  return selected;
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

  if (links.length) {
    return links[0];
  }

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

  if (links.length) {
    return links[links.length - 1].text;
  }

  const clone = $(cell).clone();
  clone.find(".flagicon, img, figure, style, sup").remove();

  return clean(clone.text()) || "Unknown";
}

async function fetchPlayerPhoto(playerHref) {
  try {
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

async function scrapeArgentinaPlayers() {
  const html = await fetchHtml();

  const debugPath = path.join(__dirname, "argentina-page-debug-v2.html");
  fs.writeFileSync(debugPath, html, "utf8");

  const $ = cheerio.load(html);
  const table = findCallupTable($);

  if (!table || !table.length) {
    throw new Error("No se encontró la tabla de Última convocatoria");
  }

  console.log("Tabla detectada. Filas:", table.find("tr").length);

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
    const ageMatch = birthText.match(/\((\d{2})\s*años?\)/i);
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
      sourceUrl: ARG_URL,
    });
  });

  const unique = new Map();

  for (const p of players) {
    unique.set(p.name, p);
  }

  const finalPlayers = [...unique.values()].slice(0, 35);

  for (const p of finalPlayers) {
    p.photo = await fetchPlayerPhoto(p.href);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return finalPlayers;
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
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    }
  );

  const players = await scrapeArgentinaPlayers();

  console.log("");
  console.log("DATOS DETECTADOS:");
  console.table(
    players.map((p) => ({
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
          position: p.position || "Unknown",
          number: p.number || null,
          age: p.age || null,
          club: p.club || "Unknown",
          photo: p.photo || null,
          birthText: p.birthText || null,
          caps: p.caps ?? null,
          goals: p.goals ?? null,
          sourceUrl: p.sourceUrl,
          team: argentina._id,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      }
    );
  }

  const jsonPath = path.join(__dirname, "argentina-players-real-v2.json");
  fs.writeFileSync(jsonPath, JSON.stringify(players, null, 2), "utf8");

  console.log("");
  console.log("============================================");
  console.log("SCRAPER ARGENTINA V2 TERMINADO");
  console.log("Jugadores detectados:", players.length);
  console.log("Guardados en MongoDB para Argentina:", await Player.countDocuments({ team: argentina._id }));
  console.log("JSON:", jsonPath);
  console.log("API:");
  console.log(`http://localhost:4000/api/players?teamId=${argentina._id}`);
  console.log("============================================");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
