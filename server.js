/**
 * server.js — API Mundial 2026 (corregida + endpoints faltantes)
 * - Sin rutas duplicadas
 * - Auth Google OAuth (Passport) + sesiones
 * - CRUD Teams / Players / Matches
 * - Predicciones: match, group (single + bulk), tournament, knockout
 * - Stats, points-system, leaderboard (global + my-position)
 * - Admin real por whitelist de emails (ADMIN_EMAILS)
 * - Corrección: evitar sumar puntos múltiples veces (delta sobre puntos previos)
 *
 * ✅ FIX aplicado:
 * - El seed (TUN, RSA) y el modelo Team quedan definidos ANTES de mongoose.connect()
 *   para evitar ReferenceError / hoisting issues.
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 🔐 Auth
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();

// ============================================
// CONFIG BASE
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mundial2026';
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:4321';

// Recomendado cuando usas cookies/sesiones detrás de proxy (Render/Heroku/Nginx)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ============================================
// MIDDLEWARES
// ============================================
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mundial2026_super_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // true solo con HTTPS (en prod usar secure:true + sameSite:'none' si cross-site)
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================
// MODELOS
// ============================================

// 1) TEAM
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
      enum: ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'],
      default: null,
    },
    fifaRanking: { type: Number, default: null },
  },
  { timestamps: true }
);

TeamSchema.index({ name: 1 });
TeamSchema.index({ code: 1 });
TeamSchema.index({ group: 1 });

const Team = mongoose.model('Team', TeamSchema);

// ============================================
// SEED: Equipos faltantes (TUN, RSA)
// ============================================
const SEED_TEAMS = [
  { name: 'Tunisia', code: 'TUN', group: 'K', confederation: 'CAF', logo: null, fifaRanking: null },
  { name: 'South Africa', code: 'RSA', group: 'L', confederation: 'CAF', logo: null, fifaRanking: null },
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
    console.log('✅ Seed teams OK: TUN y RSA verificados/creados.');
  } catch (e) {
    console.error('❌ Error seedeando equipos:', e.message);
  }
}

// 2) PLAYER
const PlayerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    position: { type: String, enum: ['GK', 'DF', 'MF', 'FW', 'Unknown'], default: 'Unknown' },
    number: { type: Number, min: 1, max: 99, default: null },
    club: { type: String, trim: true, default: 'Unknown' },
    age: { type: Number, min: 16, max: 50, default: null },
    photo: { type: String, default: null },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  },
  { timestamps: true }
);

PlayerSchema.index({ team: 1 });
PlayerSchema.index({ position: 1 });
PlayerSchema.index({ team: 1, name: 1 }, { unique: true });

const Player = mongoose.model('Player', PlayerSchema);

// 3) MATCH
const MatchSchema = new mongoose.Schema(
  {
    matchKey: { type: String, required: true, unique: true, index: true },

    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },

    matchDate: { type: Date, required: true },
    stadium: { type: String, default: null },
    group: { type: String, uppercase: true, default: null },

    matchOrder: { type: Number, default: null },

    phase: {
      type: String,
      enum: [
        'Group Stage',
        'Round of 32',
        'Round of 16',
        'Quarter Finals',
        'Semi Finals',
        'Third Place',
        'Final',
      ],
      default: 'Group Stage',
    },

    status: {
      type: String,
      enum: ['Scheduled', 'Live', 'Finished', 'Postponed', 'Cancelled'],
      default: 'Scheduled',
    },
  },
  { timestamps: true }
);

MatchSchema.index({ phase: 1, matchDate: 1 });
MatchSchema.index({ group: 1, matchDate: 1 });
MatchSchema.index({ matchOrder: 1 });

// ✅ IMPORTANTE: crear el modelo
const Match = mongoose.model('Match', MatchSchema);

// 4) USER
const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true },
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    profilePic: { type: String, default: null },
    bio: { type: String, default: '' },
    status: { type: String, enum: ['Online', 'Offline'], default: 'Online' },

    totalPoints: { type: Number, default: 0 },
    correctMatches: { type: Number, default: 0 },
    correctScores: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const User = mongoose.model('User', UserSchema);

// 5) MATCH PREDICTION
const MatchPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },

    homeGoalsPred: { type: Number, min: 0, default: 0 },
    awayGoalsPred: { type: Number, min: 0, default: 0 },

    winnerPred: { type: String, enum: ['HOME', 'AWAY', 'DRAW'], required: true },

    pointsAwarded: { type: Number, default: 0 },

    isCorrectWinner: { type: Boolean, default: false },
    isCorrectScore: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MatchPredictionSchema.index({ user: 1, match: 1 }, { unique: true });

const MatchPrediction = mongoose.model('MatchPrediction', MatchPredictionSchema);

// 6) GROUP PREDICTION
const GroupPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: String, required: true, uppercase: true, match: /^[A-L]$/ },

    firstPlaceTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    secondPlaceTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    thirdPlaceTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

GroupPredictionSchema.index({ user: 1, group: 1 }, { unique: true });

const GroupPrediction = mongoose.model('GroupPrediction', GroupPredictionSchema);

// 7) TOURNAMENT PREDICTION
const TournamentPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },

    championTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    runnerUpTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

    topScorerPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    bestPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    bestGoalkeeper: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },

    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const TournamentPrediction = mongoose.model('TournamentPrediction', TournamentPredictionSchema);

// 8) KNOCKOUT PREDICTION
const KnockoutPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    stage: {
      type: String,
      enum: ['Round of 32', 'Round of 16', 'Quarter Finals', 'Semi Finals', 'Third Place', 'Final'],
      required: true,
    },

    matchOrder: { type: Number, required: true, min: 1 },

    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },

    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

    predictedWinnerTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

    predictedScoreHome: { type: Number, min: 0, default: null },
    predictedScoreAway: { type: Number, min: 0, default: null },

    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

KnockoutPredictionSchema.index({ user: 1, stage: 1, matchOrder: 1 }, { unique: true });

const KnockoutPrediction = mongoose.model('KnockoutPrediction', KnockoutPredictionSchema);

// ============================================
// MONGODB (✅ ahora sí, después de modelos + seed)
// ============================================
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('🟢 MongoDB Conectada exitosamente');
    await seedMissingTeams(); // 👈 inyecta TUN y RSA al arranque
    await seedInitialMatches();
  })
  .catch((err) => {
    console.error('🔴 Error al conectar MongoDB:', err.message);
    process.exit(1);
  });

// ============================================
// AUTH HELPERS (admin)
// ============================================
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
}

function isAdmin(user) {
  if (!user || !user.email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(String(user.email).toLowerCase());
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'No autorizado', message: 'Debes iniciar sesión' });
  }
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Acceso denegado', message: 'Requiere permisos de administrador' });
  }
  next();
}

// ============================================
// PASSPORT GOOGLE
// ============================================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        let user = await User.findOne({
          $or: [{ googleId: profile.id }, { email }],
        });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            username: profile.displayName || 'Usuario',
            email,
            profilePic: profile._json?.picture || null,
            bio: '',
            status: 'Online',
          });
        } else if (!user.googleId) {
          user.googleId = profile.id;
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
// UTIL: Cálculo de puntos por partido (idempotente)
// ============================================
function computeActualWinner(match) {
  if (match.homeScore > match.awayScore) return 'HOME';
  if (match.awayScore > match.homeScore) return 'AWAY';
  return 'DRAW';
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

  const correctMatches = matchPreds.filter((p) => p.isCorrectWinner).length;
  const correctScores = matchPreds.filter((p) => p.isCorrectScore).length;

  user.totalPoints = totalPoints;
  user.correctMatches = correctMatches;
  user.correctScores = correctScores;
  await user.save();

  return user;
}

// ============================================
// RUTA RAÍZ (info)
// ============================================
app.get('/', (req, res) => {
  res.json({
    message: '⚽ API Mundial 2026 - Bienvenido',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        google: '/auth/google',
        callback: '/auth/google/callback',
        status: '/auth/status',
        logout: '/logout',
      },
      profile: '/profile-data',
      teams: {
        list: 'GET /api/teams',
        create: 'POST /api/teams',
        detail: 'GET /api/teams/:id',
        update: 'PUT /api/teams/:id',
        delete: 'DELETE /api/teams/:id',
        playersByTeam: 'GET /api/teams/:id/players',
      },
      players: {
        list: 'GET /api/players',
        create: 'POST /api/players',
        detail: 'GET /api/players/:id',
        update: 'PUT /api/players/:id',
        delete: 'DELETE /api/players/:id',
      },
      matches: {
        list: 'GET /api/matches',
        create: 'POST /api/matches',
        detail: 'GET /api/matches/:id',
        update: 'PUT /api/matches/:id (admin recomendado)',
        delete: 'DELETE /api/matches/:id (admin recomendado)',
      },
      predictions: {
        match: {
          upsert: 'POST /api/predictions/match',
          mine: 'GET /api/predictions/match',
          deleteOne: 'DELETE /api/predictions/match/:matchId',
        },
        groups: {
          upsert: 'POST /api/predictions/group',
          mine: 'GET /api/predictions/group',
          bulk: 'POST /api/predictions/groups/bulk',
          mineFormatted: 'GET /api/predictions/groups/my-predictions',
          calculatePoints: 'POST /api/predictions/groups/calculate-points',
          deleteOne: 'DELETE /api/predictions/group/:group',
        },
        tournament: {
          upsert: 'POST /api/predictions/tournament',
          mine: 'GET /api/predictions/tournament',
          delete: 'DELETE /api/predictions/tournament',
        },
        knockout: {
          upsert: 'POST /api/predictions/knockout',
          mine: 'GET /api/predictions/knockout',
          reset: 'DELETE /api/predictions/knockout',
          results: 'GET /api/predictions/knockout/results',
        },
        summary: 'GET /api/predictions/summary',
      },
      stats: '/api/stats',
      pointsSystem: '/api/points-system',
      leaderboard: {
        mine: '/api/leaderboard/my-position',
        global: '/api/leaderboard?page=1&limit=50',
      },
      admin: {
        check: 'GET /api/admin/check',
        recalcGroups: 'POST /api/admin/recalculate-group-points',
        calculateAll: 'POST /api/admin/calculate-all-points',
        updateMatch: 'PUT /api/admin/matches/:id',
      },
    },
  });
});

// Health
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ============================================
// AUTH ROUTES
// ============================================
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/perfil` }),
  (req, res) => res.redirect(`${CLIENT_URL}/perfil`)
);

app.get('/auth/status', (req, res) => {
  if (!req.user) return res.json({ loggedIn: false, user: null });

  const { _id, username, email, profilePic, status, totalPoints, correctMatches, correctScores } = req.user;

  res.json({
    loggedIn: true,
    user: { _id, username, email, profilePic, status, totalPoints, correctMatches, correctScores },
    isAdmin: isAdmin(req.user),
  });
});

app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Error cerrando sesión' });
    req.session.destroy(() => res.sendStatus(200));
  });
});

app.get('/profile-data', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        username: '',
        email: '',
        profilePic: '',
        bio: '',
        status: 'Offline',
        totalPoints: 0,
        correctMatches: 0,
        correctScores: 0,
      });
    }

    const user = await User.findById(req.user._id).select(
      'username email profilePic bio status totalPoints correctMatches correctScores createdAt'
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    res.json(user);
  } catch (err) {
    console.error('❌ Error en /profile-data:', err);
    res.status(500).json({ error: 'Error obteniendo datos de perfil.' });
  }
});

// ============================================
// TEAMS
// ============================================
app.post('/api/teams', async (req, res) => {
  try {
    const { name, code, group, logo, confederation, fifaRanking } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name y code son obligatorios' });

    const team = await Team.findOneAndUpdate(
      { $or: [{ name }, { code: String(code).toUpperCase() }] },
      { name, code, group, logo, confederation, fifaRanking },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json(team);
  } catch (error) {
    console.error('❌ Error al crear/actualizar equipo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const { group, confederation } = req.query;
    const filter = {};
    if (group) filter.group = String(group).toUpperCase();
    if (confederation) filter.confederation = String(confederation).toUpperCase();

    const teams = await Team.find(filter).sort({ name: 1 });
    res.json({ count: teams.length, teams });
  } catch (error) {
    console.error('❌ Error al obtener equipos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(team);
  } catch (error) {
    console.error('❌ Error al obtener equipo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teams/:id', async (req, res) => {
  try {
    const { name, code, group, logo, confederation, fifaRanking } = req.body;
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { name, code, group, logo, confederation, fifaRanking },
      { new: true, runValidators: true }
    );
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(team);
  } catch (error) {
    console.error('❌ Error al actualizar equipo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  try {
    await Player.deleteMany({ team: req.params.id });
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json({ message: 'Equipo eliminado exitosamente', team });
  } catch (error) {
    console.error('❌ Error al eliminar equipo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teams/:id/players', async (req, res) => {
  try {
    const players = await Player.find({ team: req.params.id }).sort({
      position: 1,
      number: 1,
      name: 1,
    });
    res.json({ count: players.length, players });
  } catch (error) {
    console.error('❌ Error al obtener jugadores del equipo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PLAYERS
// ============================================
app.post('/api/players', async (req, res) => {
  try {
    const { name, position, number, club, age, photo, teamId } = req.body;
    if (!name || !teamId) return res.status(400).json({ error: 'name y teamId son obligatorios' });

    const teamExists = await Team.findById(teamId);
    if (!teamExists) return res.status(404).json({ error: 'Equipo no encontrado' });

    const newPlayer = await Player.create({
      name,
      position: position || 'Unknown',
      number,
      club: club || 'Unknown',
      age,
      photo,
      team: teamId,
    });

    res.status(201).json(newPlayer);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Ese jugador ya existe en ese equipo' });
    }
    console.error('❌ Error al crear jugador:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/players', async (req, res) => {
  try {
    const { position, teamId } = req.query;
    const filter = {};
    if (position) filter.position = String(position).toUpperCase();
    if (teamId) filter.team = teamId;

    const players = await Player.find(filter).populate('team', 'name code logo').sort({ name: 1 });
    res.json({ count: players.length, players });
  } catch (error) {
    console.error('❌ Error al obtener jugadores:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/players/:id', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate('team', 'name code logo');
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json(player);
  } catch (error) {
    console.error('❌ Error al obtener jugador:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/players/:id', async (req, res) => {
  try {
    const { name, position, number, club, age, photo, team } = req.body;

    const player = await Player.findByIdAndUpdate(
      req.params.id,
      { name, position, number, club, age, photo, team },
      { new: true, runValidators: true }
    ).populate('team', 'name code logo');

    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json(player);
  } catch (error) {
    console.error('❌ Error al actualizar jugador:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/players/:id', async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id);
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json({ message: 'Jugador eliminado exitosamente', player });
  } catch (error) {
    console.error('❌ Error al eliminar jugador:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MATCHES
// ============================================
app.post('/api/matches', async (req, res) => {
  try {
    const { homeTeam, awayTeam, matchDate, stadium, group, phase, status, matchOrder } = req.body;

    if (!homeTeam || !awayTeam || !matchDate) {
      return res.status(400).json({ error: 'homeTeam, awayTeam y matchDate son obligatorios' });
    }
    if (String(homeTeam) === String(awayTeam)) {
      return res.status(400).json({ error: 'homeTeam y awayTeam no pueden ser el mismo' });
    }

    const newMatch = await Match.create({
      homeTeam,
      awayTeam,
      matchDate,
      stadium,
      group,
      phase: phase || 'Group Stage',
      status: status || 'Scheduled',
      matchOrder: matchOrder ?? null,
    });

    const populated = await Match.findById(newMatch._id)
      .populate('homeTeam', 'name code logo')
      .populate('awayTeam', 'name code logo');

    res.status(201).json(populated);
  } catch (error) {
    console.error('❌ Error al crear partido:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const { group, phase, status } = req.query;
    const filter = {};
    if (group) filter.group = String(group).toUpperCase();
    if (phase) filter.phase = String(phase);
    if (status) filter.status = String(status);

    const matches = await Match.find(filter)
      .populate('homeTeam', 'name code logo')
      .populate('awayTeam', 'name code logo')
      .sort({ matchDate: 1 });

    res.json({ count: matches.length, matches });
  } catch (error) {
    console.error('❌ Error al obtener partidos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/matches/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('homeTeam', 'name code logo')
      .populate('awayTeam', 'name code logo');

    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    res.json(match);
  } catch (error) {
    console.error('❌ Error al obtener partido:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/matches/:id', async (req, res) => {
  try {
    const { homeScore, awayScore, status, stadium, matchDate, group, phase, matchOrder } = req.body;

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { homeScore, awayScore, status, stadium, matchDate, group, phase, matchOrder },
      { new: true, runValidators: true }
    )
      .populate('homeTeam', 'name code logo')
      .populate('awayTeam', 'name code logo');

    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

    res.json(match);
  } catch (error) {
    console.error('❌ Error al actualizar partido:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/matches/:id', async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

    await MatchPrediction.deleteMany({ match: match._id });
    await KnockoutPrediction.updateMany({ match: match._id }, { $set: { match: null } });

    res.json({ message: 'Partido eliminado exitosamente', match });
  } catch (error) {
    console.error('❌ Error al eliminar partido:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATS + POINTS SYSTEM
// ============================================
app.get('/api/stats', async (req, res) => {
  try {
    const totalTeams = await Team.countDocuments();
    const totalPlayers = await Player.countDocuments();
    const totalMatches = await Match.countDocuments();

    const teamsByConfederation = await Team.aggregate([
      { $group: { _id: '$confederation', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const playersByPosition = await Player.aggregate([
      { $group: { _id: '$position', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ totalTeams, totalPlayers, totalMatches, teamsByConfederation, playersByPosition });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/points-system', (req, res) => {
  res.json({
    groups: { firstPlace: 5, secondPlace: 3, thirdPlace: 2, perfectGroupBonus: 5 },
    matches: { correctWinner: 3, correctScore: 5, correctDraw: 3 },
    tournament: { champion: 10, runnerUp: 5, topScorer: 5, bestPlayer: 3, bestGoalkeeper: 3 },
    knockout: { round32: 1, round16: 2, quarters: 3, semis: 5, thirdPlace: 3, final: 10 },
  });
});

// ============================================
// PREDICTIONS — MATCH
// ============================================
app.post('/api/predictions/match', ensureAuthenticated, async (req, res) => {
  try {
    const { matchId, homeGoalsPred, awayGoalsPred, winnerPred } = req.body;
    if (!matchId || !winnerPred)
      return res.status(400).json({ error: 'matchId y winnerPred son obligatorios' });

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    if (match.status === 'Finished') {
      return res.status(400).json({ error: 'El partido ya finalizó, no se puede editar la predicción' });
    }

    const prediction = await MatchPrediction.findOneAndUpdate(
      { user: req.user._id, match: matchId },
      { homeGoalsPred, awayGoalsPred, winnerPred },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json(prediction);
  } catch (error) {
    console.error('❌ Error al guardar predicción de partido:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/predictions/match', ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await MatchPrediction.find({ user: req.user._id })
      .populate({
        path: 'match',
        populate: [
          { path: 'homeTeam', select: 'name code logo' },
          { path: 'awayTeam', select: 'name code logo' },
        ],
      })
      .sort({ createdAt: -1 });

    res.json({ count: predictions.length, predictions });
  } catch (error) {
    console.error('❌ Error al obtener predicciones de partidos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/predictions/match/:matchId', ensureAuthenticated, async (req, res) => {
  try {
    const pred = await MatchPrediction.findOneAndDelete({
      user: req.user._id,
      match: req.params.matchId,
    });
    if (!pred) return res.status(404).json({ error: 'Predicción no encontrada' });

    await recalcUserTotals(req.user._id);

    res.json({ message: 'Predicción eliminada', prediction: pred });
  } catch (error) {
    console.error('❌ Error al eliminar predicción:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREDICTIONS — GROUP (single)
// ============================================
app.post('/api/predictions/group', ensureAuthenticated, async (req, res) => {
  try {
    const { group, firstPlaceTeam, secondPlaceTeam, thirdPlaceTeam } = req.body;
    if (!group || !firstPlaceTeam || !secondPlaceTeam) {
      return res.status(400).json({ error: 'group, firstPlaceTeam y secondPlaceTeam son obligatorios' });
    }

    const prediction = await GroupPrediction.findOneAndUpdate(
      { user: req.user._id, group: String(group).toUpperCase() },
      { firstPlaceTeam, secondPlaceTeam, thirdPlaceTeam: thirdPlaceTeam || null },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json(prediction);
  } catch (error) {
    console.error('❌ Error al guardar predicción de grupo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/predictions/group', ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await GroupPrediction.find({ user: req.user._id })
      .populate('firstPlaceTeam', 'name code logo')
      .populate('secondPlaceTeam', 'name code logo')
      .populate('thirdPlaceTeam', 'name code logo')
      .sort({ group: 1 });

    res.json({ count: predictions.length, predictions });
  } catch (error) {
    console.error('❌ Error al obtener predicciones de grupos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/predictions/group/:group', ensureAuthenticated, async (req, res) => {
  try {
    const group = String(req.params.group).toUpperCase();
    const pred = await GroupPrediction.findOneAndDelete({ user: req.user._id, group });
    if (!pred) return res.status(404).json({ error: 'Predicción no encontrada' });

    await recalcUserTotals(req.user._id);

    res.json({ message: 'Predicción de grupo eliminada', prediction: pred });
  } catch (error) {
    console.error('❌ Error al eliminar predicción de grupo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREDICTIONS — GROUP (bulk + formatted)
// ============================================
app.post('/api/predictions/groups/bulk', ensureAuthenticated, async (req, res) => {
  try {
    const { predictions } = req.body;
    if (!predictions || typeof predictions !== 'object') {
      return res.status(400).json({ error: 'Formato de predicciones inválido' });
    }

    const savedPredictions = [];
    const errors = [];

    for (const [groupKey, groupPred] of Object.entries(predictions)) {
      try {
        const g = String(groupKey).toUpperCase();
        if (!/^[A-L]$/.test(g)) {
          errors.push({ group: g, error: 'Grupo inválido' });
          continue;
        }
        if (!groupPred.first || !groupPred.second) {
          errors.push({ group: g, error: 'Faltan 1º o 2º lugar' });
          continue;
        }

        const teamIds = [groupPred.first, groupPred.second, groupPred.third].filter(Boolean);
        const teams = await Team.find({ _id: { $in: teamIds } });
        if (teams.length < 2) {
          errors.push({ group: g, error: 'Equipos no encontrados' });
          continue;
        }

        const prediction = await GroupPrediction.findOneAndUpdate(
          { user: req.user._id, group: g },
          {
            firstPlaceTeam: groupPred.first,
            secondPlaceTeam: groupPred.second,
            thirdPlaceTeam: groupPred.third || null,
          },
          { new: true, upsert: true, runValidators: true }
        ).populate('firstPlaceTeam secondPlaceTeam thirdPlaceTeam', 'name code logo');

        savedPredictions.push(prediction);
      } catch (err) {
        errors.push({ group: groupKey, error: err.message });
      }
    }

    res.status(201).json({
      message: 'Predicciones procesadas',
      saved: savedPredictions.length,
      total: Object.keys(predictions).length,
      predictions: savedPredictions,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ Error al guardar predicciones masivas:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/predictions/groups/my-predictions', ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await GroupPrediction.find({ user: req.user._id })
      .populate('firstPlaceTeam', 'name code logo')
      .populate('secondPlaceTeam', 'name code logo')
      .populate('thirdPlaceTeam', 'name code logo')
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
    console.error('❌ Error al obtener predicciones (formatted):', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/predictions/groups/calculate-points', ensureAuthenticated, async (req, res) => {
  try {
    const { group, actualStandings } = req.body;
    if (!group || !actualStandings) {
      return res.status(400).json({ error: 'group y actualStandings son obligatorios' });
    }

    const g = String(group).toUpperCase();

    const prediction = await GroupPrediction.findOne({ user: req.user._id, group: g });
    if (!prediction) return res.status(404).json({ error: 'No hay predicción para este grupo' });

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

    const oldPoints = prediction.pointsAwarded || 0;
    prediction.pointsAwarded = points;
    await prediction.save();

    const user = await User.findById(req.user._id);
    user.totalPoints = (user.totalPoints || 0) - oldPoints + points;
    await user.save();

    res.json({
      group: g,
      pointsEarned: points,
      previousPoints: oldPoints,
      totalPoints: user.totalPoints,
      details,
    });
  } catch (error) {
    console.error('❌ Error al calcular puntos de grupo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREDICTIONS — TOURNAMENT
// ============================================
app.post('/api/predictions/tournament', ensureAuthenticated, async (req, res) => {
  try {
    const { championTeam, runnerUpTeam, topScorerPlayer, bestPlayer, bestGoalkeeper } = req.body;

    const prediction = await TournamentPrediction.findOneAndUpdate(
      { user: req.user._id },
      { championTeam, runnerUpTeam, topScorerPlayer, bestPlayer, bestGoalkeeper },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json(prediction);
  } catch (error) {
    console.error('❌ Error al guardar predicción de torneo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/predictions/tournament', ensureAuthenticated, async (req, res) => {
  try {
    const prediction = await TournamentPrediction.findOne({ user: req.user._id })
      .populate('championTeam', 'name code logo')
      .populate('runnerUpTeam', 'name code logo')
      .populate('topScorerPlayer', 'name team')
      .populate('bestPlayer', 'name team')
      .populate('bestGoalkeeper', 'name team');

    res.json(prediction || null);
  } catch (error) {
    console.error('❌ Error al obtener predicción de torneo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/predictions/tournament', ensureAuthenticated, async (req, res) => {
  try {
    const pred = await TournamentPrediction.findOneAndDelete({ user: req.user._id });
    await recalcUserTotals(req.user._id);
    res.json({ message: 'Predicción de torneo eliminada', prediction: pred || null });
  } catch (error) {
    console.error('❌ Error eliminando predicción torneo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREDICTIONS — KNOCKOUT
// ============================================
app.post('/api/predictions/knockout', ensureAuthenticated, async (req, res) => {
  try {
    const {
      stage,
      matchOrder,
      matchId,
      homeTeam,
      awayTeam,
      predictedWinnerTeam,
      predictedScoreHome,
      predictedScoreAway,
    } = req.body;

    if (!stage || !matchOrder || !predictedWinnerTeam) {
      return res.status(400).json({ error: 'stage, matchOrder y predictedWinnerTeam son obligatorios' });
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
      { new: true, upsert: true, runValidators: true }
    ).populate('predictedWinnerTeam homeTeam awayTeam match', 'name code logo phase matchOrder');

    res.status(201).json(prediction);
  } catch (error) {
    console.error('❌ Error al guardar predicción knockout:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/predictions/knockout', ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await KnockoutPrediction.find({ user: req.user._id })
      .populate('predictedWinnerTeam homeTeam awayTeam', 'name code logo')
      .populate({
        path: 'match',
        populate: [
          { path: 'homeTeam', select: 'name code logo' },
          { path: 'awayTeam', select: 'name code logo' },
        ],
      })
      .sort({ stage: 1, matchOrder: 1 });

    res.json({ count: predictions.length, predictions });
  } catch (error) {
    console.error('❌ Error al obtener predicciones knockout:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/predictions/knockout', ensureAuthenticated, async (req, res) => {
  try {
    const result = await KnockoutPrediction.deleteMany({ user: req.user._id });
    await recalcUserTotals(req.user._id);
    res.json({ message: 'Predicciones knockout eliminadas', deleted: result.deletedCount });
  } catch (error) {
    console.error('❌ Error eliminando knockout:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/predictions/knockout/results', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;

    const preds = await KnockoutPrediction.find({ user: userId })
      .populate('predictedWinnerTeam', 'name code')
      .populate('match')
      .sort({ stage: 1, matchOrder: 1 });

    const played = await Match.find({
      phase: { $in: ['Round of 32', 'Round of 16', 'Quarter Finals', 'Semi Finals', 'Third Place', 'Final'] },
      status: 'Finished',
    }).populate('homeTeam awayTeam', 'name code');

    const realById = new Map();
    for (const m of played) {
      let winnerId = null;
      let winnerName = 'Empate';
      if (m.homeScore > m.awayScore) {
        winnerId = String(m.homeTeam._id);
        winnerName = m.homeTeam.name;
      } else if (m.awayScore > m.homeScore) {
        winnerId = String(m.awayTeam._id);
        winnerName = m.awayTeam.name;
      }
      realById.set(String(m._id), { winnerId, winnerName, phase: m.phase });
    }

    const phasePoints = {
      'Round of 32': 1,
      'Round of 16': 2,
      'Quarter Finals': 3,
      'Semi Finals': 5,
      'Third Place': 3,
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
    console.error('❌ Error comparando knockout:', error.message);
    res.status(500).json({ error: error.message });
  }
});
// ============================================
// SEED: Partidos iniciales (idempotente)
// ============================================

// Placeholders para playoffs (nombres estables)
const PLACEHOLDER_TEAMS = [
  { name: "UEFA playoff path 1 winner", code: "U1W", group: null, confederation: "UEFA" },
  { name: "UEFA playoff path 2 winner", code: "U2W", group: null, confederation: "UEFA" },
  { name: "UEFA playoff path 3 winner", code: "U3W", group: null, confederation: "UEFA" },
  { name: "FIFA playoff winner 1", code: "F1W", group: null, confederation: null },
  { name: "FIFA playoff winner 2", code: "F2W", group: null, confederation: null },
];

// Semilla de partidos (primera jornada). Ajusta horas si quieres.
const OFFICIAL_MATCHES_SEED = [
  { phase: "Group Stage", group: "A", status: "Scheduled", matchDate: "2026-06-11T15:00:00-05:00", stadium: "Mexico City", homeName: "Mexico", awayName: "South Africa" },
  { phase: "Group Stage", group: "A", status: "Scheduled", matchDate: "2026-06-11T20:00:00-05:00", stadium: "Zapopan", homeName: "South Korea", awayName: "UEFA playoff path 2 winner" },

  { phase: "Group Stage", group: "B", status: "Scheduled", matchDate: "2026-06-12T15:00:00-05:00", stadium: "Toronto", homeName: "Canada", awayName: "UEFA playoff path 1 winner" },
  { phase: "Group Stage", group: "D", status: "Scheduled", matchDate: "2026-06-12T18:00:00-07:00", stadium: "Inglewood, CA", homeName: "United States", awayName: "Paraguay" },

  { phase: "Group Stage", group: "B", status: "Scheduled", matchDate: "2026-06-13T12:00:00-07:00", stadium: "Santa Clara, CA", homeName: "Qatar", awayName: "Switzerland" },
  { phase: "Group Stage", group: "C", status: "Scheduled", matchDate: "2026-06-13T18:00:00-04:00", stadium: "East Rutherford, NJ", homeName: "Brazil", awayName: "Morocco" },
  { phase: "Group Stage", group: "C", status: "Scheduled", matchDate: "2026-06-13T21:00:00-04:00", stadium: "Foxborough, MA", homeName: "Haiti", awayName: "Scotland" },
  { phase: "Group Stage", group: "D", status: "Scheduled", matchDate: "2026-06-13T21:00:00-07:00", stadium: "Vancouver", homeName: "Australia", awayName: "UEFA playoff path 3 winner" },

  { phase: "Group Stage", group: "E", status: "Scheduled", matchDate: "2026-06-14T12:00:00-05:00", stadium: "Houston", homeName: "Germany", awayName: "Curaçao" },
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

function makeMatchKey(m) {
  const dateKey = new Date(m.matchDate).toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
  return `${m.phase}|${m.group || ""}|${m.homeName}|${m.awayName}|${dateKey}`;
}

async function ensureTeamByName(name) {
  // Intenta encontrar por name; si no existe, crea placeholders por code si coincide en PLACEHOLDER_TEAMS.
  const t = PLACEHOLDER_TEAMS.find(x => x.name === name);
  const payload = t
    ? { name: t.name, code: t.code, group: null, confederation: t.confederation ?? null, logo: null, fifaRanking: null }
    : { name, code: (name.slice(0, 3).toUpperCase()), group: null, confederation: null, logo: null, fifaRanking: null };

  // IMPORTANTE: si vas a crear por "code", asegúrate de que no choque.
  // Para equipos reales, ya deberían existir en tu seed de equipos.
  const existing = await Team.findOne({ name });
  if (existing) return existing;

  // Si es placeholder, upsert por code para evitar duplicados
  if (t) {
    return await Team.findOneAndUpdate(
      { code: payload.code },
      { $set: payload },
      { upsert: true, new: true, runValidators: true }
    );
  }

  // Si no es placeholder, asumimos que ya existe en DB (si no existe, lo creamos sin group)
  // Si te preocupa choque de codes, cambia esto para que NO cree equipo real automáticamente.
  try {
    return await Team.create(payload);
  } catch {
    // fallback: buscar por code si ya existe
    return await Team.findOne({ $or: [{ name }, { code: payload.code }] });
  }
}

async function seedInitialMatches() {
  try {
    // 1) Asegurar placeholders
    for (const t of PLACEHOLDER_TEAMS) {
      await Team.findOneAndUpdate(
        { code: t.code },
        { $set: { ...t, logo: null, fifaRanking: null } },
        { upsert: true, new: true, runValidators: true }
      );
    }

    let inserted = 0;

    for (const m of OFFICIAL_MATCHES_SEED) {
      const homeTeam = (await Team.findOne({ name: m.homeName })) || (await ensureTeamByName(m.homeName));
      const awayTeam = (await Team.findOne({ name: m.awayName })) || (await ensureTeamByName(m.awayName));

      if (!homeTeam || !awayTeam) {
        console.log("⚠️ No se pudo resolver equipos para:", m.homeName, "vs", m.awayName);
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

    console.log(`✅ Seed partidos: OK. Insertados nuevos: ${inserted}`);
  } catch (e) {
    console.error("❌ Error seedeando partidos:", e);
  }
}

// ============================================
// SUMMARY
// ============================================
app.get('/api/predictions/summary', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const groupPredictions = await GroupPrediction.find({ user: req.user._id });
    const matchPredictions = await MatchPrediction.find({ user: req.user._id });
    const tournamentPrediction = await TournamentPrediction.findOne({ user: req.user._id }).populate(
      'championTeam runnerUpTeam',
      'name code logo'
    );

    const groupsCompleted = groupPredictions.filter((p) => p.firstPlaceTeam && p.secondPlaceTeam).length;

    const groupPointsEarned = groupPredictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);
    const matchPointsEarned = matchPredictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);

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
        tournament: tournamentPrediction
          ? { champion: tournamentPrediction.championTeam?.name, runnerUp: tournamentPrediction.runnerUpTeam?.name }
          : null,
      },
    });
  } catch (error) {
    console.error('❌ Error al obtener resumen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LEADERBOARD (global + my-position)
// ============================================
app.get('/api/leaderboard/my-position', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const betterUsers = await User.countDocuments({
      $or: [
        { totalPoints: { $gt: user.totalPoints } },
        { totalPoints: user.totalPoints, correctScores: { $gt: user.correctScores } },
        {
          totalPoints: user.totalPoints,
          correctScores: user.correctScores,
          correctMatches: { $gt: user.correctMatches },
        },
      ],
    });

    const position = betterUsers + 1;
    const totalUsers = await User.countDocuments({ totalPoints: { $gt: 0 } });

    res.json({
      position,
      totalUsers,
      totalPoints: user.totalPoints,
      correctMatches: user.correctMatches,
      correctScores: user.correctScores,
      percentile: totalUsers > 0 ? Math.round((1 - position / totalUsers) * 100) : 0,
    });
  } catch (error) {
    console.error('❌ Error al obtener posición:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const skip = (page - 1) * limit;

    const users = await User.find({})
      .sort({ totalPoints: -1, correctScores: -1, correctMatches: -1 })
      .skip(skip)
      .limit(limit)
      .select('username profilePic totalPoints correctMatches correctScores');

    const totalUsers = await User.countDocuments({});

    const leaderboard = users.map((u, i) => ({
      position: skip + i + 1,
      username: u.username,
      profilePic: u.profilePic,
      totalPoints: u.totalPoints,
      correctMatches: u.correctMatches,
      correctScores: u.correctScores,
    }));

    res.json({
      leaderboard,
      page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    });
  } catch (error) {
    console.error('❌ Error obteniendo leaderboard:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN
// ============================================
app.get('/api/admin/check', ensureAuthenticated, (req, res) => {
  res.json({
    isAdmin: isAdmin(req.user),
    email: req.user.email,
    username: req.user.username,
  });
});

app.put('/api/admin/matches/:id', requireAdmin, async (req, res) => {
  try {
    const { homeScore, awayScore, status } = req.body;

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { homeScore, awayScore, status },
      { new: true, runValidators: true }
    )
      .populate('homeTeam', 'name code logo')
      .populate('awayTeam', 'name code logo');

    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

    if (match.status === 'Finished' && match.homeScore != null && match.awayScore != null) {
      await calculateMatchPointsForAllUsers(match._id);
    }

    res.json(match);
  } catch (error) {
    console.error('❌ Error admin actualizando partido:', error.message);
    res.status(500).json({ error: error.message });
  }
});

async function calculateMatchPointsForAllUsers(matchId) {
  const match = await Match.findById(matchId);
  if (!match || match.status !== 'Finished') return;

  const preds = await MatchPrediction.find({ match: match._id });
  const actualWinner = computeActualWinner(match);

  for (const pred of preds) {
    const isCorrectWinner = pred.winnerPred === actualWinner;
    const isCorrectScore =
      isCorrectWinner && pred.homeGoalsPred === match.homeScore && pred.awayGoalsPred === match.awayScore;

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

app.post('/api/admin/recalculate-group-points', requireAdmin, async (req, res) => {
  try {
    const { groupResults } = req.body;
    if (!groupResults || typeof groupResults !== 'object') {
      return res.status(400).json({ error: 'groupResults inválido' });
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

        results.push({
          userId: prediction.user,
          group: g,
          newPoints: points,
        });
      }
    }

    const touched = [...new Set(results.map((r) => String(r.userId)))];
    for (const uid of touched) await recalcUserTotals(uid);

    res.json({ message: 'Puntos de grupos recalculados', updated: results.length, results });
  } catch (error) {
    console.error('❌ Error recalculando puntos grupos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/calculate-all-points', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('_id');
    for (const u of users) {
      await recalcUserTotals(u._id);
    }
    res.json({ message: 'Puntos recalculados exitosamente', usersUpdated: users.length });
  } catch (error) {
    console.error('❌ Error en calculate-all-points:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 404
// ============================================
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.path, method: req.method });
});

// ============================================
// ERROR HANDLER GLOBAL (una sola vez)
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.stack || err);
  res.status(500).json({
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? String(err.message || err) : undefined,
  });
});

// ============================================
// START
// ============================================
app.listen(PORT, () => {
  console.log('============================================');
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log('============================================');
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await mongoose.connection.close();
  console.log('🟢 Conexión a MongoDB cerrada');
  process.exit(0);
});
