/**
 * server.js â€” API Mundial 2026 (LIMPIO: local + producciÃ³n)
 * --------------------------------------------------------
 * Incluye:
 * - Express + Mongoose
 * - Auth Google OAuth (Passport) + sesiones persistentes (MongoStore si estÃ¡ instalado)
 * - CRUD Teams / Players / Matches
 * - Predicciones: match, group (single + bulk), tournament, knockout
 * - Stats, points-system, leaderboard (global + my-position)
 * - Admin por whitelist (ADMIN_EMAILS)
 * - Seed idempotente: equipos (TUN/RSA) + placeholders + jornada inicial
 *
 * Requisitos env:
 * - MONGODB_URI
 * - CLIENT_URL
 * - CORS_ORIGIN
 * - SESSION_SECRET
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_CALLBACK_URL
 * - ADMIN_EMAILS
 */

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");

// connect-mongo opcional y compatible con varias versiones.
let MongoStoreImport = null;
try {
  MongoStoreImport = require("connect-mongo");
} catch (_err) {
  MongoStoreImport = null;
  console.warn("âš ï¸ connect-mongo no estÃ¡ instalado. Se usarÃ¡ MemoryStore para sesiones.");
}

const app = express();

// ============================================
// CONFIG BASE
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mundial2026";
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:4321";
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || CLIENT_URL;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

// Si estÃ¡s detrÃ¡s de proxy (Render/Railway/Heroku/Nginx), esto es necesario.
if (isProd || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

function createMongoSessionStore() {
  if (!MongoStoreImport || !MONGODB_URI) return null;

  const MongoStore = MongoStoreImport.default || MongoStoreImport;

  try {
    // connect-mongo v4/v5
    if (MongoStore && typeof MongoStore.create === "function") {
      return MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: "sessions",
        ttl: SESSION_TTL_SECONDS,
      });
    }

    // connect-mongo v3: require("connect-mongo")(session)
    if (typeof MongoStore === "function") {
      try {
        const LegacyMongoStore = MongoStore(session);
        return new LegacyMongoStore({
          url: MONGODB_URI,
          collection: "sessions",
          ttl: SESSION_TTL_SECONDS,
        });
      } catch (_legacyFactoryError) {
        // Algunas versiones exportan directamente la clase.
        return new MongoStore({
          mongoUrl: MONGODB_URI,
          collectionName: "sessions",
          ttl: SESSION_TTL_SECONDS,
        });
      }
    }

    console.warn("âš ï¸ connect-mongo fue importado, pero no tiene una interfaz reconocida.");
    return null;
  } catch (err) {
    console.warn("âš ï¸ No se pudo crear MongoStore. Se usarÃ¡ MemoryStore.");
    console.warn("Detalle:", err.message);
    return null;
  }
}

// ============================================
// CORS
// ============================================
const allowedOrigins = String(CORS_ORIGIN_RAW)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS bloqueado. Origin no permitido: ${origin}`));
    },
    credentials: true,
  })
);

// ============================================
// BODY PARSERS
// ============================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// SESIÃ“N
// ============================================
const sessionOptions = {
  secret: process.env.SESSION_SECRET || "mundial2026_super_secret",
  resave: false,
  saveUninitialized: false,
  name: "mundial2026.sid",
  cookie: {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS * 1000,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  },
};

const mongoSessionStore = createMongoSessionStore();

if (mongoSessionStore) {
  sessionOptions.store = mongoSessionStore;
  console.log("âœ… Session store: MongoStore activo");
} else {
  console.warn("âš ï¸ Session store: MemoryStore activo. Correcto para local, no recomendado en producciÃ³n.");
}

app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session());

// Logging simple
app.use((req, _res, next) => {
  console.log(`ðŸ“¨ ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================
// MODELOS
// ============================================
const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      unique: true,
    },
    group: { type: String, uppercase: true, match: /^[A-L]$/, default: null },
    logo: { type: String, default: null },
    confederation: {
      type: String,
      enum: ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC", null],
      default: null,
    },
    fifaRanking: { type: Number, default: null },
  },
  { timestamps: true }
);
TeamSchema.index({ group: 1 });
const Team = mongoose.model("Team", TeamSchema);

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
PlayerSchema.index({ team: 1 });
PlayerSchema.index({ position: 1 });
PlayerSchema.index({ team: 1, name: 1 }, { unique: true });
const Player = mongoose.model("Player", PlayerSchema);

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
    phase: {
      type: String,
      enum: ["Group Stage", "Round of 32", "Round of 16", "Quarter Finals", "Semi Finals", "Third Place", "Final"],
      default: "Group Stage",
    },
    status: {
      type: String,
      enum: ["Scheduled", "Live", "Finished", "Postponed", "Cancelled"],
      default: "Scheduled",
    },
  },
  { timestamps: true }
);
MatchSchema.index({ matchKey: 1 });
MatchSchema.index({ phase: 1, matchDate: 1 });
MatchSchema.index({ group: 1, matchDate: 1 });
MatchSchema.index({ matchOrder: 1 });
const Match = mongoose.model("Match", MatchSchema);

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true },
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    profilePic: { type: String, default: null },
    bio: { type: String, default: "" },
    status: { type: String, enum: ["Online", "Offline"], default: "Online" },
    totalPoints: { type: Number, default: 0 },
    correctMatches: { type: Number, default: 0 },
    correctScores: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const User = mongoose.model("User", UserSchema);

const MatchPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true },
    homeGoalsPred: { type: Number, min: 0, default: 0 },
    awayGoalsPred: { type: Number, min: 0, default: 0 },
    winnerPred: { type: String, enum: ["HOME", "AWAY", "DRAW"], required: true },
    pointsAwarded: { type: Number, default: 0 },
    isCorrectWinner: { type: Boolean, default: false },
    isCorrectScore: { type: Boolean, default: false },
  },
  { timestamps: true }
);
MatchPredictionSchema.index({ user: 1, match: 1 }, { unique: true });
const MatchPrediction = mongoose.model("MatchPrediction", MatchPredictionSchema);

const GroupPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    group: { type: String, required: true, uppercase: true, match: /^[A-L]$/ },
    firstPlaceTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    secondPlaceTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    thirdPlaceTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);
GroupPredictionSchema.index({ user: 1, group: 1 }, { unique: true });
const GroupPrediction = mongoose.model("GroupPrediction", GroupPredictionSchema);

const TournamentPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    championTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    runnerUpTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    topScorerPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    bestPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    bestGoalkeeper: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const TournamentPrediction = mongoose.model("TournamentPrediction", TournamentPredictionSchema);

const KnockoutPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    stage: {
      type: String,
      enum: ["Round of 32", "Round of 16", "Quarter Finals", "Semi Finals", "Third Place", "Final"],
      required: true,
    },
    matchOrder: { type: Number, required: true, min: 1 },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", default: null },
    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    predictedWinnerTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    predictedScoreHome: { type: Number, min: 0, default: null },
    predictedScoreAway: { type: Number, min: 0, default: null },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);
KnockoutPredictionSchema.index({ user: 1, stage: 1, matchOrder: 1 }, { unique: true });
const KnockoutPrediction = mongoose.model("KnockoutPrediction", KnockoutPredictionSchema);

const OraclePredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    topScorerPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    bestPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    bestGoalkeeper: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    bestYoungPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    mostAssistsPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    bestGoalPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    surpriseTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    championDarkHorse: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    totalGoals: { type: Number, default: null },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const OraclePrediction = mongoose.model("OraclePrediction", OraclePredictionSchema);


// ============================================
// AUTH HELPERS
// ============================================
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "No autorizado. Inicia sesiÃ³n." });
}

function isAdmin(user) {
  if (!user || !user.email) return false;
  const adminEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(String(user.email).toLowerCase());
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "No autorizado", message: "Debes iniciar sesiÃ³n" });
  }
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: "Acceso denegado", message: "Requiere permisos de administrador" });
  }
  next();
}


// ============================================
// PREDICTION LOCK: una vez guardado, no se puede modificar
// ============================================
const PREDICTIONS_LOCK_ENABLED = process.env.PREDICTIONS_LOCK_ENABLED !== "false";

function lockedPredictionResponse(res, message) {
  return res.status(423).json({
    error: "PREDICCION_BLOQUEADA",
    message,
  });
}

app.use(async (req, res, next) => {
  if (!PREDICTIONS_LOCK_ENABLED) return next();

  if (req.method === "DELETE" && req.path.startsWith("/api/predictions/")) {
    return lockedPredictionResponse(
      res,
      "Esta predicción ya está bloqueada. No se permite eliminar predicciones guardadas."
    );
  }

  next();
});

app.use("/api/predictions/match", async (req, res, next) => {
  if (!PREDICTIONS_LOCK_ENABLED || req.method !== "POST") return next();

  return ensureAuthenticated(req, res, async () => {
    try {
      const { matchId } = req.body || {};
      if (!matchId) return next();

      const exists = await MatchPrediction.exists({ user: req.user._id, match: matchId });
      if (exists) {
        return lockedPredictionResponse(
          res,
          "Este marcador ya fue guardado y quedó bloqueado. No se puede modificar."
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  });
});

app.use("/api/predictions/group", async (req, res, next) => {
  if (!PREDICTIONS_LOCK_ENABLED || req.method !== "POST") return next();

  return ensureAuthenticated(req, res, async () => {
    try {
      const group = String(req.body?.group || "").toUpperCase();
      if (!group) return next();

      const exists = await GroupPrediction.exists({ user: req.user._id, group });
      if (exists) {
        return lockedPredictionResponse(
          res,
          `El grupo ${group} ya fue guardado y quedó bloqueado. No se puede modificar.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  });
});

app.use("/api/predictions/groups/bulk", async (req, res, next) => {
  if (!PREDICTIONS_LOCK_ENABLED || req.method !== "POST") return next();

  return ensureAuthenticated(req, res, async () => {
    try {
      const predictions = req.body?.predictions || {};
      const groups = Object.keys(predictions).map((g) => String(g).toUpperCase()).filter(Boolean);
      if (!groups.length) return next();

      const existing = await GroupPrediction.find({
        user: req.user._id,
        group: { $in: groups },
      }).select("group");

      if (existing.length) {
        const locked = existing.map((p) => p.group).join(", ");
        return lockedPredictionResponse(
          res,
          `Ya tienes grupos guardados y bloqueados: ${locked}. No se pueden modificar.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  });
});

app.use("/api/predictions/tournament", async (req, res, next) => {
  if (!PREDICTIONS_LOCK_ENABLED || req.method !== "POST") return next();

  return ensureAuthenticated(req, res, async () => {
    try {
      const exists = await TournamentPrediction.exists({ user: req.user._id });
      if (exists) {
        return lockedPredictionResponse(
          res,
          "Tu predicción de campeón/subcampeón ya fue guardada y quedó bloqueada."
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  });
});

app.use("/api/predictions/knockout", async (req, res, next) => {
  if (!PREDICTIONS_LOCK_ENABLED || req.method !== "POST") return next();

  return ensureAuthenticated(req, res, async () => {
    try {
      const { stage, matchOrder } = req.body || {};
      if (!stage || !matchOrder) return next();

      const exists = await KnockoutPrediction.exists({
        user: req.user._id,
        stage,
        matchOrder: Number(matchOrder),
      });

      if (exists) {
        return lockedPredictionResponse(
          res,
          `La predicción ${stage} #${matchOrder} ya fue guardada y quedó bloqueada.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  });
});

// ============================================
// PASSPORT GOOGLE
// ============================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/auth/google/callback";
const googleAuthEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

if (!googleAuthEnabled) {
  console.warn("âš ï¸ Google OAuth no estÃ¡ configurado. El backend seguirÃ¡ activo; /auth/google devolverÃ¡ 503.");
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("Google profile sin email"), null);

          let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });

          if (!user) {
            user = await User.create({
              googleId: profile.id,
              username: profile.displayName || "Usuario",
              email,
              profilePic: profile._json?.picture || null,
              bio: "",
              status: "Online",
            });
          } else {
            user.googleId = user.googleId || profile.id;
            user.profilePic = user.profilePic || profile._json?.picture || null;
            await user.save();
          }

          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});

// ============================================
// UTILIDADES
// ============================================
function computeActualWinner(match) {
  if (match.homeScore == null || match.awayScore == null) return null;
  if (match.homeScore > match.awayScore) return "HOME";
  if (match.awayScore > match.homeScore) return "AWAY";
  return "DRAW";
}

async function recalcUserTotals(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const groupPreds = await GroupPrediction.find({ user: userId });
  const matchPreds = await MatchPrediction.find({ user: userId });
  const knockoutPreds = await KnockoutPrediction.find({ user: userId });
  const tournamentPred = await TournamentPrediction.findOne({ user: userId });

  const totalPoints =
    groupPreds.reduce((s, p) => s + (p.pointsAwarded || 0), 0) +
    matchPreds.reduce((s, p) => s + (p.pointsAwarded || 0), 0) +
    knockoutPreds.reduce((s, p) => s + (p.pointsAwarded || 0), 0) +
    (tournamentPred?.pointsAwarded || 0);

  user.totalPoints = totalPoints;
  user.correctMatches = matchPreds.filter((p) => p.isCorrectWinner).length;
  user.correctScores = matchPreds.filter((p) => p.isCorrectScore).length;
  await user.save();

  return user;
}

function makeMatchKey(m) {
  const dateKey = new Date(m.matchDate).toISOString().slice(0, 16);
  return `${m.phase}|${m.group || ""}|${m.homeName}|${m.awayName}|${dateKey}`;
}

// ============================================
// SEEDS
// ============================================
const SEED_TEAMS = [
  { name: "Tunisia", code: "TUN", group: "K", confederation: "CAF", logo: null, fifaRanking: null },
  { name: "South Africa", code: "RSA", group: "L", confederation: "CAF", logo: null, fifaRanking: null },
];

const PLACEHOLDER_TEAMS = [
  { name: "UEFA playoff path 1 winner", code: "U1W", group: null, confederation: "UEFA" },
  { name: "UEFA playoff path 2 winner", code: "U2W", group: null, confederation: "UEFA" },
  { name: "UEFA playoff path 3 winner", code: "U3W", group: null, confederation: "UEFA" },
  { name: "FIFA playoff winner 1", code: "F1W", group: null, confederation: null },
  { name: "FIFA playoff winner 2", code: "F2W", group: null, confederation: null },
];

const OFFICIAL_MATCHES_SEED = [
  { phase: "Group Stage", group: "A", status: "Scheduled", matchDate: "2026-06-11T15:00:00-05:00", stadium: "Mexico City", homeName: "Mexico", awayName: "South Africa" },
  { phase: "Group Stage", group: "A", status: "Scheduled", matchDate: "2026-06-11T20:00:00-05:00", stadium: "Zapopan", homeName: "South Korea", awayName: "UEFA playoff path 2 winner" },
  { phase: "Group Stage", group: "B", status: "Scheduled", matchDate: "2026-06-12T15:00:00-05:00", stadium: "Toronto", homeName: "Canada", awayName: "UEFA playoff path 1 winner" },
  { phase: "Group Stage", group: "D", status: "Scheduled", matchDate: "2026-06-12T18:00:00-07:00", stadium: "Inglewood, CA", homeName: "United States", awayName: "Paraguay" },
  { phase: "Group Stage", group: "B", status: "Scheduled", matchDate: "2026-06-13T12:00:00-07:00", stadium: "Santa Clara, CA", homeName: "Qatar", awayName: "Switzerland" },
  { phase: "Group Stage", group: "C", status: "Scheduled", matchDate: "2026-06-13T18:00:00-04:00", stadium: "East Rutherford, NJ", homeName: "Brazil", awayName: "Morocco" },
  { phase: "Group Stage", group: "C", status: "Scheduled", matchDate: "2026-06-13T21:00:00-04:00", stadium: "Foxborough, MA", homeName: "Haiti", awayName: "Scotland" },
  { phase: "Group Stage", group: "D", status: "Scheduled", matchDate: "2026-06-13T21:00:00-07:00", stadium: "Vancouver", homeName: "Australia", awayName: "UEFA playoff path 3 winner" },
  { phase: "Group Stage", group: "E", status: "Scheduled", matchDate: "2026-06-14T12:00:00-05:00", stadium: "Houston", homeName: "Germany", awayName: "CuraÃ§ao" },
  { phase: "Group Stage", group: "F", status: "Scheduled", matchDate: "2026-06-14T15:00:00-05:00", stadium: "Arlington, TX", homeName: "Netherlands", awayName: "Japan" },
  { phase: "Group Stage", group: "E", status: "Scheduled", matchDate: "2026-06-14T19:00:00-04:00", stadium: "Philadelphia", homeName: "Ivory Coast", awayName: "Ecuador" },
  { phase: "Group Stage", group: "F", status: "Scheduled", matchDate: "2026-06-14T20:00:00-05:00", stadium: "Guadalupe (Mexico)", homeName: "UEFA playoff path 2 winner", awayName: "Tunisia" },
  { phase: "Group Stage", group: "H", status: "Scheduled", matchDate: "2026-06-15T12:00:00-04:00", stadium: "Atlanta", homeName: "Spain", awayName: "Cape Verde" },
  { phase: "Group Stage", group: "G", status: "Scheduled", matchDate: "2026-06-15T15:00:00-07:00", stadium: "Seattle", homeName: "Belgium", awayName: "Egypt" },
  { phase: "Group Stage", group: "H", status: "Scheduled", matchDate: "2026-06-15T18:00:00-04:00", stadium: "Miami Gardens, FL", homeName: "Saudi Arabia", awayName: "Uruguay" },
  { phase: "Group Stage", group: "G", status: "Scheduled", matchDate: "2026-06-15T21:00:00-07:00", stadium: "Inglewood, CA", homeName: "Iran", awayName: "New Zealand" },
  { phase: "Group Stage", group: "I", status: "Scheduled", matchDate: "2026-06-16T15:00:00-04:00", stadium: "East Rutherford, NJ", homeName: "France", awayName: "Senegal" },
  { phase: "Group Stage", group: "I", status: "Scheduled", matchDate: "2026-06-16T18:00:00-04:00", stadium: "Foxborough, MA", homeName: "FIFA playoff winner 2", awayName: "Norway" },
  { phase: "Group Stage", group: "J", status: "Scheduled", matchDate: "2026-06-16T19:00:00-05:00", stadium: "Kansas City, MO", homeName: "Argentina", awayName: "Algeria" },
  { phase: "Group Stage", group: "J", status: "Scheduled", matchDate: "2026-06-16T21:00:00-07:00", stadium: "Santa Clara, CA", homeName: "Austria", awayName: "Jordan" },
  { phase: "Group Stage", group: "K", status: "Scheduled", matchDate: "2026-06-17T15:00:00-05:00", stadium: "Houston", homeName: "Portugal", awayName: "FIFA playoff winner 1" },
  { phase: "Group Stage", group: "L", status: "Scheduled", matchDate: "2026-06-17T18:00:00-05:00", stadium: "Arlington, TX", homeName: "England", awayName: "Croatia" },
  { phase: "Group Stage", group: "L", status: "Scheduled", matchDate: "2026-06-17T19:00:00-04:00", stadium: "Toronto", homeName: "Ghana", awayName: "Panama" },
  { phase: "Group Stage", group: "K", status: "Scheduled", matchDate: "2026-06-17T20:00:00-05:00", stadium: "Mexico City", homeName: "Uzbekistan", awayName: "Colombia" },
];

async function seedMissingTeams() {
  try {
    for (const t of SEED_TEAMS) {
      await Team.findOneAndUpdate(
        { code: t.code },
        { $set: t },
        { upsert: true, new: true, runValidators: true }
      );
    }
    console.log("âœ… Seed teams OK: TUN y RSA verificados/creados.");
  } catch (e) {
    console.error("âŒ Error seedeando equipos:", e.message);
  }
}

async function ensurePlaceholderTeamByName(name) {
  const t = PLACEHOLDER_TEAMS.find((x) => x.name === name);
  if (!t) return null;

  return await Team.findOneAndUpdate(
    { code: t.code },
    { $set: { ...t, logo: null, fifaRanking: null } },
    { upsert: true, new: true, runValidators: true }
  );
}

async function seedInitialMatches() {
  try {
    for (const t of PLACEHOLDER_TEAMS) {
      await Team.findOneAndUpdate(
        { code: t.code },
        { $set: { ...t, logo: null, fifaRanking: null } },
        { upsert: true, new: true, runValidators: true }
      );
    }

    let inserted = 0;

    for (const m of OFFICIAL_MATCHES_SEED) {
      const homeTeam =
        (await Team.findOne({ name: m.homeName })) || (await ensurePlaceholderTeamByName(m.homeName));
      const awayTeam =
        (await Team.findOne({ name: m.awayName })) || (await ensurePlaceholderTeamByName(m.awayName));

      if (!homeTeam || !awayTeam) {
        console.log("âš ï¸ Seed match omitido (equipo faltante en DB):", m.homeName, "vs", m.awayName);
        continue;
      }

      const matchKey = makeMatchKey(m);
      const exists = await Match.findOne({ matchKey }).select("_id");
      if (exists) continue;

      await Match.create({
        matchKey,
        homeTeam: homeTeam._id,
        awayTeam: awayTeam._id,
        matchDate: new Date(m.matchDate),
        stadium: m.stadium || null,
        group: m.group || null,
        phase: m.phase || "Group Stage",
        status: m.status || "Scheduled",
        matchOrder: m.matchOrder ?? null,
      });

      inserted++;
    }

    console.log(`âœ… Seed partidos: OK. Insertados nuevos: ${inserted}`);
  } catch (e) {
    console.error("âŒ Error seedeando partidos:", e);
  }
}

// ============================================
// ROUTES BASE
// ============================================
app.get("/", (_req, res) => {
  res.json({
    message: "API Mundial 2026 - Bienvenido",
    env: NODE_ENV,
    corsAllowed: allowedOrigins,
    endpoints: {
      health: "/health",
      auth: {
        google: "/auth/google",
        callback: "/auth/google/callback",
        status: "/auth/status",
        logout: "/logout",
      },
      profile: "/profile-data",
      teams: "/api/teams",
      players: "/api/players",
      matches: "/api/matches",
      predictions: "/api/predictions/*",
      stats: "/api/stats",
      pointsSystem: "/api/points-system",
      leaderboard: "/api/leaderboard?page=1&limit=50",
      admin: "/api/admin/*",
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    auth: { googleEnabled: googleAuthEnabled },
    db: mongoose.connection.readyState,
    corsAllowed: allowedOrigins,
  });
});

// ============================================
// AUTH ROUTES
// ============================================
app.get("/auth/google", (req, res, next) => {
  if (!googleAuthEnabled) {
    return res.status(503).json({
      error: "Google OAuth no configurado",
      message: "Define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET para habilitar login.",
    });
  }
  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get(
  "/auth/google/callback",
  (req, res, next) => {
    if (!googleAuthEnabled) return res.redirect(`${CLIENT_URL}/perfil?auth=disabled`);
    return passport.authenticate("google", { failureRedirect: `${CLIENT_URL}/perfil` })(req, res, next);
  },
  (_req, res) => res.redirect(`${CLIENT_URL}/perfil`)
);

app.get("/auth/status", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false, user: null, isAdmin: false });

  const { _id, username, email, profilePic, status, totalPoints, correctMatches, correctScores } = req.user;
  res.json({
    loggedIn: true,
    user: { _id, username, email, profilePic, status, totalPoints, correctMatches, correctScores },
    isAdmin: isAdmin(req.user),
  });
});

app.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Error cerrando sesiÃ³n" });
    req.session.destroy(() => res.sendStatus(200));
  });
});

app.get("/profile-data", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        username: "",
        email: "",
        profilePic: "",
        bio: "",
        status: "Offline",
        totalPoints: 0,
        correctMatches: 0,
        correctScores: 0,
      });
    }

    const user = await User.findById(req.user._id).select(
      "username email profilePic bio status totalPoints correctMatches correctScores createdAt"
    );

    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json(user);
  } catch (err) {
    console.error("âŒ Error en /profile-data:", err);
    res.status(500).json({ error: "Error obteniendo datos de perfil." });
  }
});

// ============================================
// TEAMS
// ============================================
app.post("/api/teams", async (req, res) => {
  try {
    const { name, code, group, logo, confederation, fifaRanking } = req.body;
    if (!name || !code) return res.status(400).json({ error: "name y code son obligatorios" });

    const normalizedCode = String(code).toUpperCase().trim();
    const team = await Team.findOneAndUpdate(
      { $or: [{ name: String(name).trim() }, { code: normalizedCode }] },
      { name, code: normalizedCode, group, logo, confederation, fifaRanking },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(team);
  } catch (error) {
    console.error("âŒ Error al crear/actualizar equipo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/teams", async (req, res) => {
  try {
    const { group, confederation } = req.query;
    const filter = {};
    if (group) filter.group = String(group).toUpperCase();
    if (confederation) filter.confederation = String(confederation).toUpperCase();

    const teams = await Team.find(filter).sort({ group: 1, name: 1 });
    res.json({ count: teams.length, teams });
  } catch (error) {
    console.error("âŒ Error al obtener equipos:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/teams/:id", async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: "Equipo no encontrado" });
    res.json(team);
  } catch (error) {
    console.error("âŒ Error al obtener equipo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/teams/:id", requireAdmin, async (req, res) => {
  try {
    const { name, code, group, logo, confederation, fifaRanking } = req.body;
    const update = { name, group, logo, confederation, fifaRanking };
    if (code) update.code = String(code).toUpperCase().trim();

    const team = await Team.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!team) return res.status(404).json({ error: "Equipo no encontrado" });
    res.json(team);
  } catch (error) {
    console.error("âŒ Error al actualizar equipo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/teams/:id", requireAdmin, async (req, res) => {
  try {
    await Player.deleteMany({ team: req.params.id });
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ error: "Equipo no encontrado" });
    res.json({ message: "Equipo eliminado exitosamente", team });
  } catch (error) {
    console.error("âŒ Error al eliminar equipo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/teams/:id/players", async (req, res) => {
  try {
    const players = await Player.find({ team: req.params.id }).sort({ position: 1, number: 1, name: 1 });
    res.json({ count: players.length, players });
  } catch (error) {
    console.error("âŒ Error al obtener jugadores del equipo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PLAYERS
// ============================================
app.post("/api/players", async (req, res) => {
  try {
    const { name, position, number, shirtNumber, club, age, photo, teamId } = req.body;
    if (!name || !teamId) return res.status(400).json({ error: "name y teamId son obligatorios" });

    const teamExists = await Team.findById(teamId);
    if (!teamExists) return res.status(404).json({ error: "Equipo no encontrado" });

    const normalizedNumber = number ?? shirtNumber ?? null;
    const player = await Player.findOneAndUpdate(
      { team: teamId, name: String(name).trim() },
      {
        name: String(name).trim(),
        position: position || "Unknown",
        number: normalizedNumber === "" ? null : normalizedNumber,
        club: club || "Unknown",
        age: age || null,
        photo: photo || null,
        team: teamId,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(player);
  } catch (error) {
    console.error("âŒ Error al crear/actualizar jugador:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/players", async (req, res) => {
  try {
    const { position, teamId } = req.query;
    const filter = {};
    if (position) filter.position = String(position).toUpperCase();
    if (teamId) filter.team = teamId;

    const players = await Player.find(filter).populate("team", "name code logo").sort({ name: 1 });
    res.json({ count: players.length, players });
  } catch (error) {
    console.error("âŒ Error al obtener jugadores:", error.message);
    res.status(500).json({ error: error.message });
  }
});


async function fetchWikimediaPlayerPhoto(playerName, teamName = "") {
  const cleanName = String(playerName || "").trim();
  if (!cleanName) return null;

  const queries = [
    `${cleanName} footballer`,
    `${cleanName} futbolista`,
    cleanName,
    teamName ? `${cleanName} ${teamName}` : cleanName,
  ];

  const endpoints = [
    "https://en.wikipedia.org/w/api.php",
    "https://es.wikipedia.org/w/api.php",
  ];

  for (const endpoint of endpoints) {
    for (const q of queries) {
      try {
        const url =
          `${endpoint}?action=query` +
          `&generator=search` +
          `&gsrsearch=${encodeURIComponent(q)}` +
          `&gsrlimit=3` +
          `&prop=pageimages|pageprops` +
          `&pithumbsize=360` +
          `&pilicense=any` +
          `&format=json` +
          `&origin=*`;

        const response = await fetch(url, {
          headers: {
            "User-Agent": "WC26-Arena/1.0 (player photo resolver)",
          },
        });

        if (!response.ok) continue;

        const data = await response.json();
        const pages = Object.values(data?.query?.pages || {});

        for (const page of pages) {
          const thumb = page?.thumbnail?.source;
          if (thumb && /^https?:\/\//i.test(thumb)) {
            return thumb;
          }
        }
      } catch (error) {
        console.warn("Wikimedia photo fallback failed:", cleanName, error.message);
      }
    }
  }

  return null;
}


async function fetchPublicPlayerPhoto(playerName, teamName = "") {
  const cleanName = String(playerName || "").trim();
  if (!cleanName) return null;

  const queries = [
    `${cleanName} footballer`,
    `${cleanName} futbolista`,
    teamName ? `${cleanName} ${teamName} footballer` : cleanName,
    cleanName,
  ];

  const endpoints = [
    "https://en.wikipedia.org/w/api.php",
    "https://es.wikipedia.org/w/api.php",
  ];

  for (const endpoint of endpoints) {
    for (const query of queries) {
      try {
        const url =
          `${endpoint}?action=query` +
          `&generator=search` +
          `&gsrsearch=${encodeURIComponent(query)}` +
          `&gsrlimit=4` +
          `&prop=pageimages` +
          `&pithumbsize=420` +
          `&format=json` +
          `&origin=*`;

        const response = await fetch(url, {
          headers: {
            "User-Agent": "WC26-Arena/1.0 player-photo-resolver",
          },
        });

        if (!response.ok) continue;

        const data = await response.json();
        const pages = Object.values(data?.query?.pages || {});

        for (const page of pages) {
          const src = page?.thumbnail?.source;
          if (src && /^https?:\/\//i.test(src)) return src;
        }
      } catch (error) {
        console.warn("Foto jugador fallback falló:", cleanName, error.message);
      }
    }
  }

  return null;
}

app.get("/api/players/photo", async (req, res) => {
  try {
    const { playerId, name, team } = req.query;

    const filter = {};

    if (playerId) {
      filter._id = playerId;
    } else if (name) {
      filter.name = { $regex: String(name), $options: "i" };
    }

    if (team && !playerId) {
      const foundTeam = await Team.findOne({
        $or: [
          { code: String(team).toUpperCase() },
          { name: { $regex: String(team), $options: "i" } },
        ],
      }).select("_id");

      if (foundTeam) filter.team = foundTeam._id;
    }

    const player = await Player.findOne(filter).populate("team", "name code");

    if (!player) {
      return res.status(404).json({
        photo: null,
        url: null,
        source: null,
        error: "Jugador no encontrado",
      });
    }

    if (player.photo) {
      return res.json({
        photo: player.photo,
        url: player.photo,
        source: "database",
        player: {
          _id: player._id,
          name: player.name,
          team: player.team,
        },
      });
    }

    const publicPhoto = await fetchPublicPlayerPhoto(player.name, player.team?.name || "");

    if (publicPhoto) {
      player.photo = publicPhoto;
      await player.save();

      return res.json({
        photo: publicPhoto,
        url: publicPhoto,
        source: "wikimedia",
        saved: true,
        player: {
          _id: player._id,
          name: player.name,
          team: player.team,
        },
      });
    }

    return res.json({
      photo: null,
      url: null,
      source: null,
      saved: false,
      player: {
        _id: player._id,
        name: player.name,
        team: player.team,
      },
    });
  } catch (error) {
    console.error("Error en /api/players/photo:", error);
    res.status(500).json({
      photo: null,
      url: null,
      source: null,
      error: error.message,
    });
  }
});

app.get("/api/players/:id", async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate("team", "name code logo");
    if (!player) return res.status(404).json({ error: "Jugador no encontrado" });
    res.json(player);
  } catch (error) {
    console.error("âŒ Error al obtener jugador:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/players/:id", requireAdmin, async (req, res) => {
  try {
    const { name, position, number, shirtNumber, club, age, photo, team } = req.body;
    const update = { name, position, club, age, photo, team };
    update.number = number ?? shirtNumber ?? null;

    const player = await Player.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate(
      "team",
      "name code logo"
    );

    if (!player) return res.status(404).json({ error: "Jugador no encontrado" });
    res.json(player);
  } catch (error) {
    console.error("âŒ Error al actualizar jugador:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/players/:id", requireAdmin, async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id);
    if (!player) return res.status(404).json({ error: "Jugador no encontrado" });
    res.json({ message: "Jugador eliminado exitosamente", player });
  } catch (error) {
    console.error("âŒ Error al eliminar jugador:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MATCHES
// ============================================
app.post("/api/matches", requireAdmin, async (req, res) => {
  try {
    const { homeTeam, awayTeam, matchDate, stadium, group, phase, status, matchOrder } = req.body;

    if (!homeTeam || !awayTeam || !matchDate) {
      return res.status(400).json({ error: "homeTeam, awayTeam y matchDate son obligatorios" });
    }
    if (String(homeTeam) === String(awayTeam)) {
      return res.status(400).json({ error: "homeTeam y awayTeam no pueden ser el mismo" });
    }

    const matchKey = `manual|${homeTeam}|${awayTeam}|${new Date(matchDate).toISOString()}`;

    const newMatch = await Match.create({
      homeTeam,
      awayTeam,
      matchDate,
      stadium,
      group,
      phase: phase || "Group Stage",
      status: status || "Scheduled",
      matchOrder: matchOrder ?? null,
      matchKey,
    });

    const populated = await Match.findById(newMatch._id)
      .populate("homeTeam", "name code logo")
      .populate("awayTeam", "name code logo");

    res.status(201).json(populated);
  } catch (error) {
    console.error("âŒ Error al crear partido:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/matches", async (req, res) => {
  try {
    const { group, phase, status } = req.query;
    const filter = {};
    if (group) filter.group = String(group).toUpperCase();
    if (phase) filter.phase = String(phase);
    if (status) filter.status = String(status);

    const matches = await Match.find(filter)
      .populate("homeTeam", "name code logo")
      .populate("awayTeam", "name code logo")
      .sort({ matchDate: 1 });

    res.json({ count: matches.length, matches });
  } catch (error) {
    console.error("âŒ Error al obtener partidos:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/matches/:id", async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate("homeTeam", "name code logo")
      .populate("awayTeam", "name code logo");

    if (!match) return res.status(404).json({ error: "Partido no encontrado" });
    res.json(match);
  } catch (error) {
    console.error("âŒ Error al obtener partido:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/matches/:id", requireAdmin, async (req, res) => {
  try {
    const { homeScore, awayScore, status, stadium, matchDate, group, phase, matchOrder } = req.body;

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { homeScore, awayScore, status, stadium, matchDate, group, phase, matchOrder },
      { new: true, runValidators: true }
    )
      .populate("homeTeam", "name code logo")
      .populate("awayTeam", "name code logo");

    if (!match) return res.status(404).json({ error: "Partido no encontrado" });

    if (match.status === "Finished" && match.homeScore != null && match.awayScore != null) {
      await calculateMatchPointsForAllUsers(match._id);
    }

    res.json(match);
  } catch (error) {
    console.error("âŒ Error al actualizar partido:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/matches/:id", requireAdmin, async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) return res.status(404).json({ error: "Partido no encontrado" });

    await MatchPrediction.deleteMany({ match: match._id });
    await KnockoutPrediction.updateMany({ match: match._id }, { $set: { match: null } });

    res.json({ message: "Partido eliminado exitosamente", match });
  } catch (error) {
    console.error("âŒ Error al eliminar partido:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATS + POINTS SYSTEM
// ============================================
app.get("/api/stats", async (_req, res) => {
  try {
    const totalTeams = await Team.countDocuments();
    const totalPlayers = await Player.countDocuments();
    const totalMatches = await Match.countDocuments();

    const teamsByConfederation = await Team.aggregate([
      { $group: { _id: "$confederation", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const playersByPosition = await Player.aggregate([
      { $group: { _id: "$position", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ totalTeams, totalPlayers, totalMatches, teamsByConfederation, playersByPosition });
  } catch (error) {
    console.error("âŒ Error al obtener estadÃ­sticas:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/points-system", (_req, res) => {
  res.json({
    groups: { firstPlace: 5, secondPlace: 3, thirdPlace: 2, perfectGroupBonus: 5 },
    matches: { correctWinner: 3, correctScore: 5, correctDraw: 3 },
    tournament: { champion: 10, runnerUp: 5, topScorer: 5, bestPlayer: 3, bestGoalkeeper: 3 },
    knockout: { round32: 1, round16: 2, quarters: 3, semis: 5, thirdPlace: 3, final: 10 },
    oracle: { topScorer: 8, bestPlayer: 6, bestGoalkeeper: 5, bestYoungPlayer: 4, bestGoal: 4, surpriseTeam: 4, totalGoalsNear: 5 },
  });
});

// ============================================
// PREDICTIONS â€” MATCH
// ============================================
app.post("/api/predictions/match", ensureAuthenticated, async (req, res) => {
  try {
    const { matchId, homeGoalsPred, awayGoalsPred, winnerPred } = req.body;
    if (!matchId || !winnerPred) return res.status(400).json({ error: "matchId y winnerPred son obligatorios" });

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: "Partido no encontrado" });
    if (match.status === "Finished") return res.status(400).json({ error: "El partido ya finalizÃ³" });

    const existingPrediction = await MatchPrediction.findOne({ user: req.user._id, match: matchId }).select("_id");
    if (existingPrediction) {
      return res.status(423).json({ error: "PREDICCION_BLOQUEADA: ya guardaste este partido" });
    }

    const prediction = await MatchPrediction.findOneAndUpdate(
      { user: req.user._id, match: matchId },
      { homeGoalsPred, awayGoalsPred, winnerPred },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(prediction);
  } catch (error) {
    console.error("âŒ Error al guardar predicciÃ³n de partido:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/predictions/match", ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await MatchPrediction.find({ user: req.user._id })
      .populate({
        path: "match",
        populate: [
          { path: "homeTeam", select: "name code logo" },
          { path: "awayTeam", select: "name code logo" },
        ],
      })
      .sort({ createdAt: -1 });

    res.json({ count: predictions.length, predictions });
  } catch (error) {
    console.error("âŒ Error al obtener predicciones de partidos:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/predictions/match/:matchId", ensureAuthenticated, async (req, res) => {
  try {
    const pred = await MatchPrediction.findOneAndDelete({ user: req.user._id, match: req.params.matchId });
    if (!pred) return res.status(404).json({ error: "PredicciÃ³n no encontrada" });

    await recalcUserTotals(req.user._id);
    res.json({ message: "PredicciÃ³n eliminada", prediction: pred });
  } catch (error) {
    console.error("âŒ Error al eliminar predicciÃ³n:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREDICTIONS â€” GROUP
// ============================================
app.post("/api/predictions/group", ensureAuthenticated, async (req, res) => {
  try {
    const { group, firstPlaceTeam, secondPlaceTeam, thirdPlaceTeam } = req.body;
    if (!group || !firstPlaceTeam || !secondPlaceTeam) {
      return res.status(400).json({ error: "group, firstPlaceTeam y secondPlaceTeam son obligatorios" });
    }

    const g = String(group).toUpperCase();
    const existingPrediction = await GroupPrediction.findOne({ user: req.user._id, group: g }).select("_id");
    if (existingPrediction) {
      return res.status(423).json({ error: "PREDICCION_BLOQUEADA: ya guardaste este grupo" });
    }

    const prediction = await GroupPrediction.findOneAndUpdate(
      { user: req.user._id, group: g },
      { firstPlaceTeam, secondPlaceTeam, thirdPlaceTeam: thirdPlaceTeam || null },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(prediction);
  } catch (error) {
    console.error("âŒ Error al guardar predicciÃ³n de grupo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/predictions/group", ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await GroupPrediction.find({ user: req.user._id })
      .populate("firstPlaceTeam", "name code logo")
      .populate("secondPlaceTeam", "name code logo")
      .populate("thirdPlaceTeam", "name code logo")
      .sort({ group: 1 });

    res.json({ count: predictions.length, predictions });
  } catch (error) {
    console.error("âŒ Error al obtener predicciones de grupos:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/predictions/group/:group", ensureAuthenticated, async (req, res) => {
  try {
    const group = String(req.params.group).toUpperCase();
    const pred = await GroupPrediction.findOneAndDelete({ user: req.user._id, group });
    if (!pred) return res.status(404).json({ error: "PredicciÃ³n no encontrada" });

    await recalcUserTotals(req.user._id);
    res.json({ message: "PredicciÃ³n de grupo eliminada", prediction: pred });
  } catch (error) {
    console.error("âŒ Error al eliminar predicciÃ³n de grupo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/predictions/groups/bulk", ensureAuthenticated, async (req, res) => {
  try {
    const { predictions } = req.body;
    if (!predictions || typeof predictions !== "object") {
      return res.status(400).json({ error: "Formato de predicciones invÃ¡lido" });
    }

    const savedPredictions = [];
    const errors = [];

    for (const [groupKey, groupPred] of Object.entries(predictions)) {
      try {
        const g = String(groupKey).toUpperCase();
        if (!/^[A-L]$/.test(g)) {
          errors.push({ group: g, error: "Grupo invÃ¡lido" });
          continue;
        }
        if (!groupPred.first || !groupPred.second) {
          errors.push({ group: g, error: "Faltan 1Âº o 2Âº lugar" });
          continue;
        }

        const existingGroupPrediction = await GroupPrediction.findOne({ user: req.user._id, group: g }).select("_id");
        if (existingGroupPrediction) {
          errors.push({ group: g, error: "Grupo bloqueado: ya fue guardado" });
          continue;
        }

        const teamIds = [groupPred.first, groupPred.second, groupPred.third].filter(Boolean);
        const teams = await Team.find({ _id: { $in: teamIds } });
        if (teams.length < 2) {
          errors.push({ group: g, error: "Equipos no encontrados" });
          continue;
        }

        const prediction = await GroupPrediction.findOneAndUpdate(
          { user: req.user._id, group: g },
          {
            firstPlaceTeam: groupPred.first,
            secondPlaceTeam: groupPred.second,
            thirdPlaceTeam: groupPred.third || null,
          },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).populate("firstPlaceTeam secondPlaceTeam thirdPlaceTeam", "name code logo");

        savedPredictions.push(prediction);
      } catch (err) {
        errors.push({ group: groupKey, error: err.message });
      }
    }

    res.status(201).json({
      message: "Predicciones procesadas",
      saved: savedPredictions.length,
      total: Object.keys(predictions).length,
      predictions: savedPredictions,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("âŒ Error al guardar predicciones masivas:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/predictions/groups/my-predictions", ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await GroupPrediction.find({ user: req.user._id })
      .populate("firstPlaceTeam", "name code logo")
      .populate("secondPlaceTeam", "name code logo")
      .populate("thirdPlaceTeam", "name code logo")
      .sort({ group: 1 });

    const formatted = {};
    for (const pred of predictions) {
      formatted[pred.group] = {
        first: pred.firstPlaceTeam?.code || null,
        second: pred.secondPlaceTeam?.code || null,
        third: pred.thirdPlaceTeam?.code || null,
        firstTeam: pred.firstPlaceTeam,
        secondTeam: pred.secondPlaceTeam,
        thirdTeam: pred.thirdPlaceTeam,
        points: pred.pointsAwarded,
      };
    }

    res.json({ userId: req.user._id, predictions: formatted });
  } catch (error) {
    console.error("âŒ Error al obtener predicciones formatted:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/predictions/groups/calculate-points", ensureAuthenticated, async (req, res) => {
  try {
    const { group, actualStandings } = req.body;
    if (!group || !actualStandings) {
      return res.status(400).json({ error: "group y actualStandings son obligatorios" });
    }

    const g = String(group).toUpperCase();
    const prediction = await GroupPrediction.findOne({ user: req.user._id, group: g });
    if (!prediction) return res.status(404).json({ error: "No hay predicciÃ³n para este grupo" });

    let points = 0;
    const details = {};

    if (String(prediction.firstPlaceTeam) === String(actualStandings.first)) {
      points += 5;
      details.firstPlace = { correct: true, points: 5 };
    } else details.firstPlace = { correct: false, points: 0 };

    if (String(prediction.secondPlaceTeam) === String(actualStandings.second)) {
      points += 3;
      details.secondPlace = { correct: true, points: 3 };
    } else details.secondPlace = { correct: false, points: 0 };

    if (prediction.thirdPlaceTeam && String(prediction.thirdPlaceTeam) === String(actualStandings.third)) {
      points += 2;
      details.thirdPlace = { correct: true, points: 2 };
    } else details.thirdPlace = { correct: false, points: 0 };

    if (points === 10) {
      points += 5;
      details.perfectBonus = { earned: true, points: 5 };
    }

    prediction.pointsAwarded = points;
    await prediction.save();
    const user = await recalcUserTotals(req.user._id);

    res.json({ group: g, pointsEarned: points, totalPoints: user?.totalPoints || 0, details });
  } catch (error) {
    console.error("âŒ Error al calcular puntos de grupo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREDICTIONS â€” TOURNAMENT
// ============================================
app.post("/api/predictions/tournament", ensureAuthenticated, async (req, res) => {
  try {
    const { championTeam, runnerUpTeam, topScorerPlayer, bestPlayer, bestGoalkeeper } = req.body;

    const existingPrediction = await TournamentPrediction.findOne({ user: req.user._id }).select("_id");
    if (existingPrediction) {
      return res.status(423).json({ error: "PREDICCION_BLOQUEADA: ya guardaste tu predicción del torneo" });
    }

    const prediction = await TournamentPrediction.findOneAndUpdate(
      { user: req.user._id },
      { championTeam, runnerUpTeam, topScorerPlayer, bestPlayer, bestGoalkeeper },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(prediction);
  } catch (error) {
    console.error("âŒ Error al guardar predicciÃ³n de torneo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/predictions/tournament", ensureAuthenticated, async (req, res) => {
  try {
    const prediction = await TournamentPrediction.findOne({ user: req.user._id })
      .populate("championTeam", "name code logo")
      .populate("runnerUpTeam", "name code logo")
      .populate("topScorerPlayer", "name team")
      .populate("bestPlayer", "name team")
      .populate("bestGoalkeeper", "name team");

    res.json(prediction || null);
  } catch (error) {
    console.error("âŒ Error al obtener predicciÃ³n de torneo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/predictions/tournament", ensureAuthenticated, async (req, res) => {
  try {
    const pred = await TournamentPrediction.findOneAndDelete({ user: req.user._id });
    await recalcUserTotals(req.user._id);
    res.json({ message: "PredicciÃ³n de torneo eliminada", prediction: pred || null });
  } catch (error) {
    console.error("âŒ Error eliminando predicciÃ³n torneo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREDICTIONS â€” KNOCKOUT
// ============================================
app.post("/api/predictions/knockout", ensureAuthenticated, async (req, res) => {
  try {
    const { stage, matchOrder, matchId, homeTeam, awayTeam, predictedWinnerTeam, predictedScoreHome, predictedScoreAway } = req.body;

    if (!stage || !matchOrder || !predictedWinnerTeam) {
      return res.status(400).json({ error: "stage, matchOrder y predictedWinnerTeam son obligatorios" });
    }

    const existingPrediction = await KnockoutPrediction.findOne({ user: req.user._id, stage, matchOrder }).select("_id");
    if (existingPrediction) {
      return res.status(423).json({ error: "PREDICCION_BLOQUEADA: ya guardaste este cruce" });
    }

    const prediction = await KnockoutPrediction.findOneAndUpdate(
      { user: req.user._id, stage, matchOrder },
      {
        stage,
        matchOrder,
        match: matchId || null,
        homeTeam: homeTeam || null,
        awayTeam: awayTeam || null,
        predictedWinnerTeam,
        predictedScoreHome: predictedScoreHome ?? null,
        predictedScoreAway: predictedScoreAway ?? null,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate("predictedWinnerTeam homeTeam awayTeam match", "name code logo phase matchOrder");

    res.status(201).json(prediction);
  } catch (error) {
    console.error("âŒ Error al guardar predicciÃ³n knockout:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/predictions/knockout", ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await KnockoutPrediction.find({ user: req.user._id })
      .populate("predictedWinnerTeam homeTeam awayTeam", "name code logo")
      .populate({
        path: "match",
        populate: [
          { path: "homeTeam", select: "name code logo" },
          { path: "awayTeam", select: "name code logo" },
        ],
      })
      .sort({ stage: 1, matchOrder: 1 });

    res.json({ count: predictions.length, predictions });
  } catch (error) {
    console.error("âŒ Error al obtener predicciones knockout:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/predictions/knockout", ensureAuthenticated, async (req, res) => {
  try {
    const result = await KnockoutPrediction.deleteMany({ user: req.user._id });
    await recalcUserTotals(req.user._id);
    res.json({ message: "Predicciones knockout eliminadas", deleted: result.deletedCount });
  } catch (error) {
    console.error("âŒ Error eliminando knockout:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/predictions/knockout/results", ensureAuthenticated, async (req, res) => {
  try {
    const preds = await KnockoutPrediction.find({ user: req.user._id })
      .populate("predictedWinnerTeam", "name code")
      .populate("match")
      .sort({ stage: 1, matchOrder: 1 });

    const played = await Match.find({
      phase: { $in: ["Round of 32", "Round of 16", "Quarter Finals", "Semi Finals", "Third Place", "Final"] },
      status: "Finished",
    }).populate("homeTeam awayTeam", "name code");

    const realById = new Map();
    for (const m of played) {
      let winnerId = null;
      let winnerName = "Empate";
      if (m.homeScore != null && m.awayScore != null) {
        if (m.homeScore > m.awayScore) {
          winnerId = String(m.homeTeam._id);
          winnerName = m.homeTeam.name;
        } else if (m.awayScore > m.homeScore) {
          winnerId = String(m.awayTeam._id);
          winnerName = m.awayTeam.name;
        }
      }
      realById.set(String(m._id), { winnerId, winnerName, phase: m.phase });
    }

    const phasePoints = {
      "Round of 32": 1,
      "Round of 16": 2,
      "Quarter Finals": 3,
      "Semi Finals": 5,
      "Third Place": 3,
      Final: 10,
    };

    const results = [];
    let correctPredictions = 0;
    let pointsFromKnockout = 0;

    for (const p of preds) {
      const matchId = p.match ? String(p.match._id) : null;
      const real = matchId ? realById.get(matchId) : null;
      let isCorrect = null;
      let pointsEarned = 0;

      if (real && real.winnerId) {
        isCorrect = String(p.predictedWinnerTeam?._id) === String(real.winnerId);
        if (isCorrect) {
          pointsEarned = phasePoints[p.stage] || 1;
          correctPredictions++;
          pointsFromKnockout += pointsEarned;
        }
      }

      results.push({
        stage: p.stage,
        matchOrder: p.matchOrder,
        matchId,
        myPrediction: p.predictedWinnerTeam?.name || null,
        actualWinner: real?.winnerName || null,
        isCorrect,
        pointsEarned,
      });
    }

    res.json({
      results,
      summary: {
        totalPredictions: preds.length,
        completedMatches: results.filter((r) => r.isCorrect !== null).length,
        pendingMatches: results.filter((r) => r.isCorrect === null).length,
        correctPredictions,
        pointsFromKnockout,
      },
    });
  } catch (error) {
    console.error("âŒ Error comparando knockout:", error.message);
    res.status(500).json({ error: error.message });
  }
});


// ============================================
// PREDICTIONS — ORACLE / FUN
// ============================================
app.post("/api/predictions/oracle", ensureAuthenticated, async (req, res) => {
  try {
    const existingPrediction = await OraclePrediction.findOne({ user: req.user._id }).select("_id");
    if (existingPrediction) {
      return res.status(423).json({ error: "PREDICCION_BLOQUEADA: ya guardaste tu bola de cristal" });
    }

    const allowed = [
      "topScorerPlayer",
      "bestPlayer",
      "bestGoalkeeper",
      "bestYoungPlayer",
      "mostAssistsPlayer",
      "bestGoalPlayer",
      "surpriseTeam",
      "championDarkHorse",
      "totalGoals",
    ];

    const payload = { user: req.user._id };
    for (const key of allowed) {
      if (req.body[key] !== undefined && req.body[key] !== "") payload[key] = req.body[key];
    }

    const prediction = await OraclePrediction.create(payload);
    const populated = await OraclePrediction.findById(prediction._id)
      .populate("topScorerPlayer bestPlayer bestGoalkeeper bestYoungPlayer mostAssistsPlayer bestGoalPlayer", "name photo position number club team")
      .populate("surpriseTeam championDarkHorse", "name code logo group confederation");

    res.status(201).json({ message: "Bola de cristal guardada", prediction: populated });
  } catch (error) {
    console.error("❌ Error al guardar oráculo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/predictions/oracle", ensureAuthenticated, async (req, res) => {
  try {
    const prediction = await OraclePrediction.findOne({ user: req.user._id })
      .populate("topScorerPlayer bestPlayer bestGoalkeeper bestYoungPlayer mostAssistsPlayer bestGoalPlayer", "name photo position number club team")
      .populate("surpriseTeam championDarkHorse", "name code logo group confederation");

    res.json({ prediction: prediction || null });
  } catch (error) {
    console.error("❌ Error al obtener oráculo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUMMARY
// ============================================
app.get("/api/predictions/summary", ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const groupPredictions = await GroupPrediction.find({ user: req.user._id });
    const matchPredictions = await MatchPrediction.find({ user: req.user._id });
    const knockoutPredictions = await KnockoutPrediction.find({ user: req.user._id });
    const tournamentPrediction = await TournamentPrediction.findOne({ user: req.user._id }).populate(
      "championTeam runnerUpTeam",
      "name code logo"
    );
    const oraclePrediction = await OraclePrediction.findOne({ user: req.user._id });

    const groupsCompleted = groupPredictions.filter((p) => p.firstPlaceTeam && p.secondPlaceTeam).length;
    const groupPointsEarned = groupPredictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);
    const matchPointsEarned = matchPredictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);
    const knockoutPointsEarned = knockoutPredictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);

    res.json({
      user: {
        username: user.username,
        totalPoints: user.totalPoints,
        correctMatches: user.correctMatches,
        correctScores: user.correctScores,
      },
      predictions: {
        groups: { total: 12, completed: groupsCompleted, pointsEarned: groupPointsEarned },
        matches: { total: matchPredictions.length, pointsEarned: matchPointsEarned },
        knockout: { total: knockoutPredictions.length, pointsEarned: knockoutPointsEarned },
        tournament: tournamentPrediction
          ? { champion: tournamentPrediction.championTeam?.name, runnerUp: tournamentPrediction.runnerUpTeam?.name }
          : null,
        oracle: oraclePrediction ? { completed: true } : { completed: false },
      },
    });
  } catch (error) {
    console.error("âŒ Error al obtener resumen:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LEADERBOARD
// ============================================
app.get("/api/leaderboard/my-position", ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const betterUsers = await User.countDocuments({
      $or: [
        { totalPoints: { $gt: user.totalPoints } },
        { totalPoints: user.totalPoints, correctScores: { $gt: user.correctScores } },
        { totalPoints: user.totalPoints, correctScores: user.correctScores, correctMatches: { $gt: user.correctMatches } },
      ],
    });

    const position = betterUsers + 1;
    const totalUsers = await User.countDocuments({});

    res.json({
      position,
      totalUsers,
      totalPoints: user.totalPoints,
      correctMatches: user.correctMatches,
      correctScores: user.correctScores,
      percentile: totalUsers > 0 ? Math.max(0, Math.round((1 - position / totalUsers) * 100)) : 0,
    });
  } catch (error) {
    console.error("âŒ Error al obtener posiciÃ³n:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const skip = (page - 1) * limit;

    const users = await User.find({})
      .sort({ totalPoints: -1, correctScores: -1, correctMatches: -1 })
      .skip(skip)
      .limit(limit)
      .select("username profilePic totalPoints correctMatches correctScores");

    const totalUsers = await User.countDocuments({});

    const leaderboard = users.map((u, i) => ({
      position: skip + i + 1,
      username: u.username,
      profilePic: u.profilePic,
      totalPoints: u.totalPoints,
      correctMatches: u.correctMatches,
      correctScores: u.correctScores,
    }));

    res.json({ leaderboard, page, totalPages: Math.ceil(totalUsers / limit), totalUsers });
  } catch (error) {
    console.error("âŒ Error obteniendo leaderboard:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN
// ============================================
app.get("/api/admin/check", ensureAuthenticated, (req, res) => {
  res.json({ isAdmin: isAdmin(req.user), email: req.user.email, username: req.user.username });
});

app.put("/api/admin/matches/:id", requireAdmin, async (req, res) => {
  try {
    const { homeScore, awayScore, status } = req.body;

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { homeScore, awayScore, status },
      { new: true, runValidators: true }
    )
      .populate("homeTeam", "name code logo")
      .populate("awayTeam", "name code logo");

    if (!match) return res.status(404).json({ error: "Partido no encontrado" });

    if (match.status === "Finished" && match.homeScore != null && match.awayScore != null) {
      await calculateMatchPointsForAllUsers(match._id);
    }

    res.json(match);
  } catch (error) {
    console.error("âŒ Error admin actualizando partido:", error.message);
    res.status(500).json({ error: error.message });
  }
});

async function calculateMatchPointsForAllUsers(matchId) {
  const match = await Match.findById(matchId);
  if (!match || match.status !== "Finished") return;

  const actualWinner = computeActualWinner(match);
  if (!actualWinner) return;

  const preds = await MatchPrediction.find({ match: match._id });

  for (const pred of preds) {
    const isCorrectWinner = pred.winnerPred === actualWinner;
    const isCorrectScore = isCorrectWinner && pred.homeGoalsPred === match.homeScore && pred.awayGoalsPred === match.awayScore;

    let points = 0;
    if (isCorrectWinner) points += 3;
    if (isCorrectScore) points += 5;

    pred.pointsAwarded = points;
    pred.isCorrectWinner = isCorrectWinner;
    pred.isCorrectScore = isCorrectScore;
    await pred.save();
  }

  const affectedUserIds = [...new Set(preds.map((p) => String(p.user)))];
  for (const uid of affectedUserIds) {
    await recalcUserTotals(uid);
  }
}

app.post("/api/admin/recalculate-group-points", requireAdmin, async (req, res) => {
  try {
    const { groupResults } = req.body;
    if (!groupResults || typeof groupResults !== "object") {
      return res.status(400).json({ error: "groupResults invÃ¡lido" });
    }

    const results = [];

    for (const [group, standings] of Object.entries(groupResults)) {
      const g = String(group).toUpperCase();
      const predictions = await GroupPrediction.find({ group: g });

      for (const prediction of predictions) {
        let points = 0;
        if (String(prediction.firstPlaceTeam) === String(standings.first)) points += 5;
        if (String(prediction.secondPlaceTeam) === String(standings.second)) points += 3;
        if (prediction.thirdPlaceTeam && String(prediction.thirdPlaceTeam) === String(standings.third)) points += 2;
        if (points === 10) points += 5;

        prediction.pointsAwarded = points;
        await prediction.save();
        results.push({ userId: prediction.user, group: g, newPoints: points });
      }
    }

    const touched = [...new Set(results.map((r) => String(r.userId)))];
    for (const uid of touched) await recalcUserTotals(uid);

    res.json({ message: "Puntos de grupos recalculados", updated: results.length, results });
  } catch (error) {
    console.error("âŒ Error recalculando puntos grupos:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/calculate-all-points", requireAdmin, async (_req, res) => {
  try {
    const users = await User.find({}).select("_id");
    for (const u of users) {
      await recalcUserTotals(u._id);
    }
    res.json({ message: "Puntos recalculados exitosamente", usersUpdated: users.length });
  } catch (error) {
    console.error("âŒ Error en calculate-all-points:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 404 + ERROR HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada", path: req.path, method: req.method });
});

app.use((err, req, res, _next) => {
  console.error("âŒ Error no manejado:", err.stack || err);
  res.status(500).json({
    error: "Error interno del servidor",
    details: NODE_ENV === "development" ? String(err.message || err) : undefined,
  });
});

// ============================================
// START
// ============================================
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("ðŸŸ¢ MongoDB conectada exitosamente");

        if (process.env.RUN_LEGACY_SEED === "true") {
      console.log("RUN_LEGACY_SEED=true -> ejecutando seed viejo...");
      await seedMissingTeams();
      await seedInitialMatches();
    } else {
      console.log("✅ Legacy seed desactivado. Calendario controlado por script oficial.");
    }

    app.listen(PORT, () => {
      console.log("============================================");
      console.log(`ðŸš€ Servidor corriendo en puerto ${PORT}`);
      console.log(`ðŸŒ http://localhost:${PORT}`);
      console.log(`ðŸŒ CLIENT_URL: ${CLIENT_URL}`);
      console.log(`ðŸ›¡ï¸ CORS allowlist: ${allowedOrigins.join(", ")}`);
      console.log(`ðŸª Cookies: secure=${isProd} sameSite=${isProd ? "none" : "lax"}`);
      console.log(`ðŸ§  Session store: ${mongoSessionStore ? "MongoStore (connect-mongo)" : "MemoryStore (NO recomendado prod)"}`);
      console.log("============================================");
    });
  } catch (err) {
    console.error("ðŸ”´ Error al iniciar servidor:", err.message);
    process.exit(1);
  }
}

start();

process.on("SIGINT", async () => {
  console.log("\nðŸ›‘ Cerrando servidor...");
  await mongoose.connection.close();
  console.log("ðŸŸ¢ ConexiÃ³n a MongoDB cerrada");
  process.exit(0);
});






