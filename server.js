
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
// CONFIGURACIÓN BASE
// ============================================
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/mundial2026';
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:4321';

// ============================================
// MIDDLEWARES
// ============================================
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || CLIENT_URL, // p.ej. http://localhost:4321
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Sesiones para Passport (desarrollo: memoria)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mundial2026_super_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // true solo si usas HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================
// CONEXIÓN A MONGODB
// ============================================
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('🟢 MongoDB Conectada exitosamente'))
  .catch((err) => {
    console.error('🔴 Error al conectar MongoDB:', err.message);
    process.exit(1);
  });

// ============================================
// MODELOS
// ============================================

// 1. MODELO DE EQUIPO
const TeamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del equipo es obligatorio'],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'El código del equipo es obligatorio'],
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    group: {
      type: String,
      uppercase: true,
      match: /^[A-L]$/,
      default: null,
    },
    logo: {
      type: String,
      default: null,
    },
    confederation: {
      type: String,
      enum: ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'],
      default: null,
    },
    fifaRanking: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

TeamSchema.index({ name: 1 });
TeamSchema.index({ code: 1 });
TeamSchema.index({ group: 1 });

const Team = mongoose.model('Team', TeamSchema);

// 2. MODELO DE JUGADOR
const PlayerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del jugador es obligatorio'],
      trim: true,
    },
    position: {
      type: String,
      enum: ['GK', 'DF', 'MF', 'FW', 'Unknown'],
      default: 'Unknown',
    },
    number: {
      type: Number,
      min: 1,
      max: 99,
      default: null,
    },
    club: {
      type: String,
      trim: true,
      default: 'Unknown',
    },
    age: {
      type: Number,
      min: 16,
      max: 50,
      default: null,
    },
    photo: {
      type: String,
      default: null,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'El jugador debe estar asignado a un equipo'],
    },
  },
  {
    timestamps: true,
  }
);

PlayerSchema.index({ team: 1 });
PlayerSchema.index({ position: 1 });

const Player = mongoose.model('Player', PlayerSchema);

// 3. MODELO DE PARTIDO
const MatchSchema = new mongoose.Schema(
  {
    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    homeScore: {
      type: Number,
      default: null,
    },
    awayScore: {
      type: Number,
      default: null,
    },
    matchDate: {
      type: Date,
      required: true,
    },
    stadium: {
      type: String,
      default: null,
    },
    group: {
      type: String,
      uppercase: true,
      default: null,
    },
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
  {
    timestamps: true,
  }
);

const Match = mongoose.model('Match', MatchSchema);

// 4. MODELO DE USUARIO (GOOGLE OAUTH + GAMIFICACIÓN)
const UserSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    profilePic: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Online', 'Offline'],
      default: 'Online',
    },

    // 🎯 Gamificación
    totalPoints: { type: Number, default: 0 },
    correctMatches: { type: Number, default: 0 },
    correctScores: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', UserSchema);

// 5. MODELO DE PREDICCIÓN POR PARTIDO
const MatchPredictionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    homeGoalsPred: { type: Number, min: 0, default: 0 },
    awayGoalsPred: { type: Number, min: 0, default: 0 },
    winnerPred: {
      type: String,
      enum: ['HOME', 'AWAY', 'DRAW'],
      required: true,
    },
    pointsAwarded: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MatchPredictionSchema.index({ user: 1, match: 1 }, { unique: true });

const MatchPrediction = mongoose.model(
  'MatchPrediction',
  MatchPredictionSchema
);

// 6. MODELO DE PREDICCIÓN DE GRUPOS
const GroupPredictionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    group: {
      type: String,
      required: true,
      uppercase: true,
      match: /^[A-L]$/,
    },
    firstPlaceTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    secondPlaceTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    thirdPlaceTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

GroupPredictionSchema.index({ user: 1, group: 1 }, { unique: true });

const GroupPrediction = mongoose.model(
  'GroupPrediction',
  GroupPredictionSchema
);

// 7. MODELO DE PREDICCIONES DE TORNEO (campeón, goleador, etc.)
const TournamentPredictionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      required: true,
    },

    championTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    runnerUpTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },

    topScorerPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
    bestPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
    bestGoalkeeper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },

    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const TournamentPrediction = mongoose.model(
  'TournamentPrediction',
  TournamentPredictionSchema
);
// 8. MODELO DE PREDICCIONES DE FASE ELIMINATORIA (Octavos → Final)
const KnockoutPredictionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stage: {
      type: String,
      enum: [
        'Round of 16',
        'Quarter Finals',
        'Semi Finals',
        'Third Place',
        'Final',
      ],
      required: true,
    },
    matchOrder: {
      type: Number,
      required: true,
      min: 1,
    },

    // Información opcional del cruce (para mostrar en frontend)
    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },

    // Predicción principal
    predictedWinnerTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },

    // Opcional: marcador que el usuario imagina
    predictedScoreHome: {
      type: Number,
      min: 0,
      default: null,
    },
    predictedScoreAway: {
      type: Number,
      min: 0,
      default: null,
    },

    // Puntos otorgados cuando el partido real termina
    pointsAwarded: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Un usuario no puede tener dos predicciones para el mismo partido de una fase
KnockoutPredictionSchema.index(
  { user: 1, stage: 1, matchOrder: 1 },
  { unique: true }
);

const KnockoutPrediction = mongoose.model(
  'KnockoutPrediction',
  KnockoutPredictionSchema
);
// ============================================
// RUTAS - ESTADÍSTICAS GENERALES
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

    res.json({
      totalTeams,
      totalPlayers,
      totalMatches,
      teamsByConfederation,
      playersByPosition,
    });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 🔁 NUEVAS RUTAS DE PREDICCIONES 
// ============================================

// Guardar múltiples predicciones de grupos
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
        if (!/^[A-L]$/.test(groupKey)) {
          errors.push({ group: groupKey, error: 'Grupo inválido' });
          continue;
        }

        if (!groupPred.first || !groupPred.second) {
          errors.push({ group: groupKey, error: 'Faltan 1º o 2º lugar' });
          continue;
        }

        const teams = await Team.find({
          _id: { $in: [groupPred.first, groupPred.second, groupPred.third].filter(Boolean) }
        });

        if (teams.length < 2) {
          errors.push({ group: groupKey, error: 'Equipos no encontrados' });
          continue;
        }

        const prediction = await GroupPrediction.findOneAndUpdate(
          { user: req.user._id, group: groupKey },
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
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ Error al guardar predicciones masivas:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Obtener mis predicciones de grupos (por códigos)
app.get('/api/predictions/groups/my-predictions', ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await GroupPrediction.find({ user: req.user._id })
      .populate('firstPlaceTeam', 'name code logo')
      .populate('secondPlaceTeam', 'name code logo')
      .populate('thirdPlaceTeam', 'name code logo')
      .sort({ group: 1 });

    const formattedPredictions = {};
    for (const pred of predictions) {
      formattedPredictions[pred.group] = {
        first: pred.firstPlaceTeam?.code || null,
        second: pred.secondPlaceTeam?.code || null,
        third: pred.thirdPlaceTeam?.code || null,
        firstTeam: pred.firstPlaceTeam,
        secondTeam: pred.secondPlaceTeam,
        thirdTeam: pred.thirdPlaceTeam,
        points: pred.pointsAwarded,
      };
    }

    res.json({
      userId: req.user._id,
      predictions: formattedPredictions,
    });
  } catch (error) {
    console.error('❌ Error al obtener predicciones:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Calcular puntos para un grupo
app.post('/api/predictions/groups/calculate-points', ensureAuthenticated, async (req, res) => {
  try {
    const { group, actualStandings } = req.body;
    if (!group || !actualStandings) {
      return res.status(400).json({ error: 'Grupo y posiciones reales son obligatorias' });
    }

    const prediction = await GroupPrediction.findOne({
      user: req.user._id,
      group: group.toUpperCase(),
    });

    if (!prediction) {
      return res.status(404).json({ error: 'No hay predicción para este grupo' });
    }

    let points = 0;
    const details = {};

    if (prediction.firstPlaceTeam?.toString() === actualStandings.first) {
      points += 5;
      details.firstPlace = { correct: true, points: 5 };
    } else {
      details.firstPlace = { correct: false, points: 0 };
    }

    if (prediction.secondPlaceTeam?.toString() === actualStandings.second) {
      points += 3;
      details.secondPlace = { correct: true, points: 3 };
    } else {
      details.secondPlace = { correct: false, points: 0 };
    }

    if (prediction.thirdPlaceTeam?.toString() === actualStandings.third) {
      points += 2;
      details.thirdPlace = { correct: true, points: 2 };
    } else {
      details.thirdPlace = { correct: false, points: 0 };
    }

    if (points === 10) {
      points += 5;
      details.perfectBonus = { earned: true, points: 5 };
    }

    prediction.pointsAwarded = points;
    await prediction.save();

    const user = await User.findById(req.user._id);
    user.totalPoints += points;
    await user.save();

    res.json({
      group,
      pointsEarned: points,
      totalPoints: user.totalPoints,
      details,
    });
  } catch (error) {
    console.error('❌ Error al calcular puntos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Resumen de predicciones
app.get('/api/predictions/summary', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const groupPredictions = await GroupPrediction.find({ user: req.user._id })
      .populate('firstPlaceTeam secondPlaceTeam thirdPlaceTeam', 'name code logo');
    
    const matchPredictions = await MatchPrediction.find({ user: req.user._id })
      .populate('match');
    
    const tournamentPrediction = await TournamentPrediction.findOne({ user: req.user._id })
      .populate('championTeam runnerUpTeam', 'name code logo');

    const groupsCompleted = groupPredictions.filter(
      p => p.firstPlaceTeam && p.secondPlaceTeam && p.thirdPlaceTeam
    ).length;
    
    const groupPointsEarned = groupPredictions.reduce(
      (sum, p) => sum + (p.pointsAwarded || 0), 0
    );
    
    const matchPointsEarned = matchPredictions.reduce(
      (sum, p) => sum + (p.pointsAwarded || 0), 0
    );

    res.json({
      user: {
        username: user.username,
        totalPoints: user.totalPoints,
        correctMatches: user.correctMatches,
        correctScores: user.correctScores,
      },
      predictions: {
        groups: {
          total: 12,
          completed: groupsCompleted,
          pointsEarned: groupPointsEarned,
        },
        matches: {
          total: matchPredictions.length,
          pointsEarned: matchPointsEarned,
        },
        tournament: tournamentPrediction ? {
          champion: tournamentPrediction.championTeam?.name,
          runnerUp: tournamentPrediction.runnerUpTeam?.name,
        } : null,
      },
    });
  } catch (error) {
    console.error('❌ Error al obtener resumen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Ranking personal
app.get('/api/leaderboard/my-position', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const betterUsers = await User.countDocuments({
      $or: [
        { totalPoints: { $gt: user.totalPoints } },
        {
          totalPoints: user.totalPoints,
          correctScores: { $gt: user.correctScores }
        },
        {
          totalPoints: user.totalPoints,
          correctScores: user.correctScores,
          correctMatches: { $gt: user.correctMatches }
        }
      ]
    });

    const position = betterUsers + 1;
    const totalUsers = await User.countDocuments({ totalPoints: { $gt: 0 } });

    res.json({
      position,
      totalUsers,
      totalPoints: user.totalPoints,
      correctMatches: user.correctMatches,
      correctScores: user.correctScores,
      percentile: totalUsers > 0 ? Math.round((1 - (position / totalUsers)) * 100) : 0,
    });
  } catch (error) {
    console.error('❌ Error al obtener posición:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Config del sistema de puntos
app.get('/api/points-system', (req, res) => {
  res.json({
    groups: {
      firstPlace: 5,
      secondPlace: 3,
      thirdPlace: 2,
      perfectGroupBonus: 5,
    },
    matches: {
      correctWinner: 3,
      correctScore: 5,
      correctDraw: 3,
    },
    tournament: {
      champion: 10,
      runnerUp: 5,
      topScorer: 5,
      bestPlayer: 3,
      bestGoalkeeper: 3,
    },
  });
});

// Recalcular puntos de grupos (admin)
app.post('/api/admin/recalculate-group-points', ensureAuthenticated, async (req, res) => {
  try {
    const { groupResults } = req.body;

    const results = [];

    for (const [group, standings] of Object.entries(groupResults)) {
      const predictions = await GroupPrediction.find({ group: group.toUpperCase() });

      for (const prediction of predictions) {
        let points = 0;

        if (prediction.firstPlaceTeam?.toString() === standings.first) points += 5;
        if (prediction.secondPlaceTeam?.toString() === standings.second) points += 3;
        if (prediction.thirdPlaceTeam?.toString() === standings.third) points += 2;
        if (points === 10) points += 5; // Bonus grupo perfecto

        const oldPoints = prediction.pointsAwarded;
        prediction.pointsAwarded = points;
        await prediction.save();

        const user = await User.findById(prediction.user);
        user.totalPoints = user.totalPoints - oldPoints + points;
        await user.save();

        results.push({
          userId: user._id,
          username: user.username,
          group,
          oldPoints,
          newPoints: points,
        });
      }
    }

    res.json({
      message: 'Puntos recalculados exitosamente',
      updated: results.length,
      results,
    });
  } catch (error) {
    console.error('❌ Error al recalcular puntos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTA RAÍZ Y 404 (AL FINAL)
// ============================================

app.get('/', (req, res) => {
  res.json({
    message: '⚽ API Mundial 2026 - Bienvenido',
    version: '1.0.0',
    endpoints: {
      teams: '/api/teams',
      players: '/api/players',
      matches: '/api/matches',
      stats: '/api/stats',
      authGoogle: '/auth/google',
      authStatus: '/auth/status',
      profile: '/profile-data',
      predictions: {
        matches: '/api/predictions/match',
        groups: '/api/predictions/group',
        groupsBulk: '/api/predictions/groups/bulk',
        myGroupPredictions: '/api/predictions/groups/my-predictions',
        calculatePoints: '/api/predictions/groups/calculate-points',
        tournament: '/api/predictions/tournament',
        summary: '/api/predictions/summary',
      },
      leaderboard: {
        myPosition: '/api/leaderboard/my-position',
      },
      pointsSystem: '/api/points-system',
    },
  });
});



// MANEJO DE ERRORES GLOBAL
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    details:
      process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================
// 🔐 CONFIGURACIÓN PASSPORT GOOGLE
// ============================================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:4000/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({
          $or: [
            { googleId: profile.id },
            { email: profile.emails?.[0]?.value },
          ],
        });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            username: profile.displayName,
            email: profile.emails?.[0]?.value,
            profilePic: profile._json?.picture,
            bio: '',
            status: 'Online',
          });
        } else if (!user.googleId) {
          user.googleId = profile.id;
          user.profilePic = user.profilePic || profile._json?.picture;
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
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: 'No autorizado. Inicia sesión.' });
}

// ============================================
// 💬 RUTAS DE AUTENTICACIÓN GOOGLE
// ============================================

// Inicia el flujo OAuth
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback que Google llama
app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${CLIENT_URL}/perfil`,
  }),
  (req, res) => {
    // Si todo va bien, redirigimos al frontend
    res.redirect(`${CLIENT_URL}/perfil`);
  }
);

// Estado de autenticación
app.get('/auth/status', (req, res) => {
  if (!req.user) {
    return res.json({ loggedIn: false, user: null });
  }

  const { _id, username, email, profilePic, status, totalPoints } = req.user;
  res.json({
    loggedIn: true,
    user: { _id, username, email, profilePic, status, totalPoints },
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: 'Error cerrando sesión' });
    req.session.destroy(() => res.sendStatus(200));
  });
});

// Datos de perfil del usuario autenticado
app.get('/profile-data', async (req, res) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user._id).select(
        'username email profilePic bio status totalPoints correctMatches correctScores createdAt'
      );
      if (!user)
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      return res.json(user);
    }

    // Si no hay sesión activa
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
  } catch (err) {
    console.error('❌ Error en /profile-data:', err);
    res.status(500).json({ message: 'Error obteniendo datos de perfil.' });
  }
});

// ============================================
// RUTAS - EQUIPOS
// ============================================

app.post('/api/teams', async (req, res) => {
  try {
    const { name, code, group, logo, confederation, fifaRanking } = req.body;

    if (!name || !code) {
      return res
        .status(400)
        .json({ error: 'El nombre y código del equipo son obligatorios' });
    }

    const team = await Team.findOneAndUpdate(
      { name },
      { code, group, logo, confederation, fifaRanking },
      { new: true, upsert: true, runValidators: true }
    );

    console.log(`✅ Equipo ${name} creado/actualizado con ID: ${team._id}`);
    res.status(201).json(team);
  } catch (error) {
    console.error('❌ Error al crear equipo:', error.message);
    res.status(500).json({
      error: 'Error al crear el equipo',
      details: error.message,
    });
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const { group, confederation } = req.query;

    const filter = {};
    if (group) filter.group = group.toUpperCase();
    if (confederation) filter.confederation = confederation.toUpperCase();

    const teams = await Team.find(filter).sort({ name: 1 });
    res.json({
      count: teams.length,
      teams,
    });
  } catch (error) {
    console.error('❌ Error al obtener equipos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    res.json(team);
  } catch (error) {
    console.error('❌ Error al obtener equipo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teams/:id', async (req, res) => {
  try {
    const { code, group, logo, confederation, fifaRanking } = req.body;

    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { code, group, logo, confederation, fifaRanking },
      { new: true, runValidators: true }
    );

    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

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

    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    res.json({
      message: 'Equipo eliminado exitosamente',
      team,
    });
  } catch (error) {
    console.error('❌ Error al eliminar equipo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - JUGADORES
// ============================================

app.post('/api/players', async (req, res) => {
  try {
    const { name, position, number, club, age, photo, teamId } = req.body;

    if (!name || !teamId) {
      return res.status(400).json({
        error: 'El nombre del jugador y el equipo son obligatorios',
      });
    }

    const teamExists = await Team.findById(teamId);
    if (!teamExists) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const newPlayer = new Player({
      name,
      position: position || 'Unknown',
      number,
      club: club || 'Unknown',
      age,
      photo,
      team: teamId,
    });

    await newPlayer.save();

    console.log(`✅ Jugador ${name} agregado al equipo ${teamExists.name}`);
    res.status(201).json(newPlayer);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: 'Este jugador ya existe en el equipo' });
    }
    console.error('❌ Error al crear jugador:', error.message);
    res.status(500).json({
      error: 'Error al crear el jugador',
      details: error.message,
    });
  }
});

app.get('/api/players', async (req, res) => {
  try {
    const { position, teamId } = req.query;

    const filter = {};
    if (position) filter.position = position.toUpperCase();
    if (teamId) filter.team = teamId;

    const players = await Player.find(filter)
      .populate('team', 'name code logo')
      .sort({ name: 1 });

    res.json({
      count: players.length,
      players,
    });
  } catch (error) {
    console.error('❌ Error al obtener jugadores:', error.message);
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

    res.json({
      count: players.length,
      players,
    });
  } catch (error) {
    console.error('❌ Error al obtener jugadores del equipo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/players/:id', async (req, res) => {
  try {
    const { name, position, number, club, age, photo } = req.body;

    const player = await Player.findByIdAndUpdate(
      req.params.id,
      { name, position, number, club, age, photo },
      { new: true, runValidators: true }
    ).populate('team', 'name code');

    if (!player) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    res.json(player);
  } catch (error) {
    console.error('❌ Error al actualizar jugador:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/players/:id', async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id);

    if (!player) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    res.json({
      message: 'Jugador eliminado exitosamente',
      player,
    });
  } catch (error) {
    console.error('❌ Error al eliminar jugador:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - PARTIDOS
// ============================================

app.post('/api/matches', async (req, res) => {
  try {
    const { homeTeam, awayTeam, matchDate, stadium, group, phase } = req.body;

    if (!homeTeam || !awayTeam || !matchDate) {
      return res.status(400).json({
        error: 'Los equipos y la fecha son obligatorios',
      });
    }

    const newMatch = new Match({
      homeTeam,
      awayTeam,
      matchDate,
      stadium,
      group,
      phase: phase || 'Group Stage',
    });

    await newMatch.save();

    const populatedMatch = await Match.findById(newMatch._id)
      .populate('homeTeam', 'name code logo')
      .populate('awayTeam', 'name code logo');

    res.status(201).json(populatedMatch);
  } catch (error) {
    console.error('❌ Error al crear partido:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const { group, phase, status } = req.query;

    const filter = {};
    if (group) filter.group = group.toUpperCase();
    if (phase) filter.phase = phase;
    if (status) filter.status = status;

    const matches = await Match.find(filter)
      .populate('homeTeam', 'name code logo')
      .populate('awayTeam', 'name code logo')
      .sort({ matchDate: 1 });

    res.json({
      count: matches.length,
      matches,
    });
  } catch (error) {
    console.error('❌ Error al obtener partidos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/matches/:id', async (req, res) => {
  try {
    const { homeScore, awayScore, status } = req.body;

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { homeScore, awayScore, status },
      { new: true, runValidators: true }
    )
      .populate('homeTeam', 'name code logo')
      .populate('awayTeam', 'name code logo');

    if (!match) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    res.json(match);
  } catch (error) {
    console.error('❌ Error al actualizar partido:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - PREDICCIONES DE PARTIDOS
// ============================================

app.post('/api/predictions/match', ensureAuthenticated, async (req, res) => {
  try {
    const { matchId, homeGoalsPred, awayGoalsPred, winnerPred } = req.body;

    if (!matchId || !winnerPred) {
      return res
        .status(400)
        .json({ error: 'matchId y winnerPred son obligatorios' });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

    if (match.status === 'Finished') {
      return res.status(400).json({
        error: 'El partido ya finalizó, no se puede editar la predicción',
      });
    }

    const prediction = await MatchPrediction.findOneAndUpdate(
      { user: req.user._id, match: matchId },
      {
        homeGoalsPred,
        awayGoalsPred,
        winnerPred,
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json(prediction);
  } catch (error) {
    console.error(
      '❌ Error al guardar predicción de partido:',
      error.message
    );
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/predictions/match', ensureAuthenticated, async (req, res) => {
  try {
    const predictions = await MatchPrediction.find({ user: req.user._id })
      .populate('match')
      .populate('match.homeTeam', 'name code logo')
      .populate('match.awayTeam', 'name code logo');

    res.json({
      count: predictions.length,
      predictions,
    });
  } catch (error) {
    console.error(
      '❌ Error al obtener predicciones de partidos:',
      error.message
    );
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - PREDICCIONES DE GRUPOS
// ============================================

app.post('/api/predictions/group', ensureAuthenticated, async (req, res) => {
  try {
    const { group, firstPlaceTeam, secondPlaceTeam, thirdPlaceTeam } = req.body;

    if (!group || !firstPlaceTeam || !secondPlaceTeam) {
      return res.status(400).json({
        error: 'Grupo, 1º y 2º lugar son obligatorios',
      });
    }

    const prediction = await GroupPrediction.findOneAndUpdate(
      { user: req.user._id, group: group.toUpperCase() },
      {
        firstPlaceTeam,
        secondPlaceTeam,
        thirdPlaceTeam: thirdPlaceTeam || null,
      },
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
      .populate('thirdPlaceTeam', 'name code logo');

    res.json({
      count: predictions.length,
      predictions,
    });
  } catch (error) {
    console.error(
      '❌ Error al obtener predicciones de grupos:',
      error.message
    );
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - PREDICCIONES DE TORNEO
// ============================================

app.post(
  '/api/predictions/tournament',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const {
        championTeam,
        runnerUpTeam,
        topScorerPlayer,
        bestPlayer,
        bestGoalkeeper,
      } = req.body;

      const prediction = await TournamentPrediction.findOneAndUpdate(
        { user: req.user._id },
        {
          championTeam,
          runnerUpTeam,
          topScorerPlayer,
          bestPlayer,
          bestGoalkeeper,
        },
        { new: true, upsert: true, runValidators: true }
      );

      res.status(201).json(prediction);
    } catch (error) {
      console.error(
        '❌ Error al guardar predicción de torneo:',
        error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

app.get(
  '/api/predictions/tournament',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const prediction = await TournamentPrediction.findOne({
        user: req.user._id,
      })
        .populate('championTeam', 'name code logo')
        .populate('runnerUpTeam', 'name code logo')
        .populate('topScorerPlayer', 'name team')
        .populate('bestPlayer', 'name team')
        .populate('bestGoalkeeper', 'name team');

      res.json(prediction || null);
    } catch (error) {
      console.error(
        '❌ Error al obtener predicción de torneo:',
        error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================
// RUTAS - ESTADÍSTICAS GENERALES
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

    res.json({
      totalTeams,
      totalPlayers,
      totalMatches,
      teamsByConfederation,
      playersByPosition,
    });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NUEVAS RUTAS DE PREDICCIONES / RANKING / PUNTOS
// ============================================

// Guardar múltiples predicciones de grupos a la vez (bulk)
app.post(
  '/api/predictions/groups/bulk',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { predictions } = req.body;
      // predictions = { "A": { first: "teamId1", second: "teamId2", third: "teamId3" }, ... }

      if (!predictions || typeof predictions !== 'object') {
        return res
          .status(400)
          .json({ error: 'Formato de predicciones inválido' });
      }

      const savedPredictions = [];
      const errors = [];

      // Procesar cada grupo
      for (const [groupKey, groupPred] of Object.entries(predictions)) {
        try {
          // Validar que el grupo esté entre A-L
          if (!/^[A-L]$/.test(groupKey)) {
            errors.push({ group: groupKey, error: 'Grupo inválido' });
            continue;
          }

          // Validar que tenga al menos 1º y 2º
          if (!groupPred.first || !groupPred.second) {
            errors.push({
              group: groupKey,
              error: 'Faltan 1º o 2º lugar',
            });
            continue;
          }

          // Verificar que los equipos existan
          const teams = await Team.find({
            _id: {
              $in: [
                groupPred.first,
                groupPred.second,
                groupPred.third,
              ].filter(Boolean),
            },
          });

          if (teams.length < 2) {
            errors.push({
              group: groupKey,
              error: 'Equipos no encontrados',
            });
            continue;
          }

          // Guardar o actualizar predicción
          const prediction = await GroupPrediction.findOneAndUpdate(
            { user: req.user._id, group: groupKey },
            {
              firstPlaceTeam: groupPred.first,
              secondPlaceTeam: groupPred.second,
              thirdPlaceTeam: groupPred.third || null,
            },
            { new: true, upsert: true, runValidators: true }
          ).populate(
            'firstPlaceTeam secondPlaceTeam thirdPlaceTeam',
            'name code logo'
          );

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
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error(
        '❌ Error al guardar predicciones masivas:',
        error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

// Obtener mis predicciones de grupos (por códigos de equipo, para el frontend)
app.get(
  '/api/predictions/groups/my-predictions',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const predictions = await GroupPrediction.find({
        user: req.user._id,
      })
        .populate('firstPlaceTeam', 'name code logo')
        .populate('secondPlaceTeam', 'name code logo')
        .populate('thirdPlaceTeam', 'name code logo')
        .sort({ group: 1 });

      // Transformar al formato que espera el frontend
      const formattedPredictions = {};

      for (const pred of predictions) {
        formattedPredictions[pred.group] = {
          first: pred.firstPlaceTeam?.code || null,
          second: pred.secondPlaceTeam?.code || null,
          third: pred.thirdPlaceTeam?.code || null,
          firstTeam: pred.firstPlaceTeam,
          secondTeam: pred.secondPlaceTeam,
          thirdTeam: pred.thirdPlaceTeam,
          points: pred.pointsAwarded,
        };
      }

      res.json({
        userId: req.user._id,
        predictions: formattedPredictions,
      });
    } catch (error) {
      console.error('❌ Error al obtener predicciones:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// Calcular puntos cuando un grupo finaliza (para un usuario)
app.post(
  '/api/predictions/groups/calculate-points',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { group, actualStandings } = req.body;
      // actualStandings = { first: "teamId", second: "teamId", third: "teamId" }

      if (!group || !actualStandings) {
        return res.status(400).json({
          error: 'Grupo y posiciones reales son obligatorias',
        });
      }

      // Buscar predicción del usuario
      const prediction = await GroupPrediction.findOne({
        user: req.user._id,
        group: group.toUpperCase(),
      });

      if (!prediction) {
        return res
          .status(404)
          .json({ error: 'No hay predicción para este grupo' });
      }

      // Sistema de puntos
      let points = 0;
      const details = {};

      // 1º lugar correcto: 5 puntos
      if (
        prediction.firstPlaceTeam?.toString() ===
        actualStandings.first
      ) {
        points += 5;
        details.firstPlace = { correct: true, points: 5 };
      } else {
        details.firstPlace = { correct: false, points: 0 };
      }

      // 2º lugar correcto: 3 puntos
      if (
        prediction.secondPlaceTeam?.toString() ===
        actualStandings.second
      ) {
        points += 3;
        details.secondPlace = { correct: true, points: 3 };
      } else {
        details.secondPlace = { correct: false, points: 0 };
      }

      // 3º lugar correcto: 2 puntos
      if (
        prediction.thirdPlaceTeam?.toString() ===
        actualStandings.third
      ) {
        points += 2;
        details.thirdPlace = { correct: true, points: 2 };
      } else {
        details.thirdPlace = { correct: false, points: 0 };
      }

      // Bonus: Grupo perfecto +5 puntos
      if (points === 10) {
        // 5 + 3 + 2 = 10
        points += 5;
        details.perfectBonus = { earned: true, points: 5 };
      }

      // Actualizar puntos en la predicción
      prediction.pointsAwarded = points;
      await prediction.save();

      // Actualizar puntos totales del usuario
      const user = await User.findById(req.user._id);
      user.totalPoints += points;
      await user.save();

      res.json({
        group,
        pointsEarned: points,
        totalPoints: user.totalPoints,
        details,
      });
    } catch (error) {
      console.error('❌ Error al calcular puntos:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// Resumen de predicciones del usuario
app.get(
  '/api/predictions/summary',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      const groupPredictions = await GroupPrediction.find({
        user: req.user._id,
      }).populate(
        'firstPlaceTeam secondPlaceTeam thirdPlaceTeam',
        'name code logo'
      );

      const matchPredictions = await MatchPrediction.find({
        user: req.user._id,
      }).populate('match');

      const tournamentPrediction =
        await TournamentPrediction.findOne({
          user: req.user._id,
        }).populate('championTeam runnerUpTeam', 'name code logo');

      // Estadísticas
      const groupsCompleted = groupPredictions.filter(
        (p) => p.firstPlaceTeam && p.secondPlaceTeam && p.thirdPlaceTeam
      ).length;

      const groupPointsEarned = groupPredictions.reduce(
        (sum, p) => sum + (p.pointsAwarded || 0),
        0
      );

      const matchPointsEarned = matchPredictions.reduce(
        (sum, p) => sum + (p.pointsAwarded || 0),
        0
      );

      res.json({
        user: {
          username: user.username,
          totalPoints: user.totalPoints,
          correctMatches: user.correctMatches,
          correctScores: user.correctScores,
        },
        predictions: {
          groups: {
            total: 12, // Siempre 12 grupos oficiales
            completed: groupsCompleted,
            pointsEarned: groupPointsEarned,
          },
          matches: {
            total: matchPredictions.length,
            pointsEarned: matchPointsEarned,
          },
          tournament: tournamentPrediction
            ? {
                champion: tournamentPrediction.championTeam?.name,
                runnerUp: tournamentPrediction.runnerUpTeam?.name,
              }
            : null,
        },
      });
    } catch (error) {
      console.error('❌ Error al obtener resumen:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// Obtener mi posición en el ranking
app.get(
  '/api/leaderboard/my-position',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      // Contar cuántos usuarios tienen más puntos
      const betterUsers = await User.countDocuments({
        $or: [
          { totalPoints: { $gt: user.totalPoints } },
          {
            totalPoints: user.totalPoints,
            correctScores: { $gt: user.correctScores },
          },
          {
            totalPoints: user.totalPoints,
            correctScores: user.correctScores,
            correctMatches: { $gt: user.correctMatches },
          },
        ],
      });

      const position = betterUsers + 1;
      const totalUsers = await User.countDocuments({
        totalPoints: { $gt: 0 },
      });

      res.json({
        position,
        totalUsers,
        totalPoints: user.totalPoints,
        correctMatches: user.correctMatches,
        correctScores: user.correctScores,
        percentile:
          totalUsers > 0
            ? Math.round((1 - position / totalUsers) * 100)
            : 0,
      });
    } catch (error) {
      console.error(
        '❌ Error al obtener posición:',
        error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

// Obtener configuración del sistema de puntos
app.get('/api/points-system', (req, res) => {
  res.json({
    groups: {
      firstPlace: 5,
      secondPlace: 3,
      thirdPlace: 2,
      perfectGroupBonus: 5,
    },
    matches: {
      correctWinner: 3,
      correctScore: 5,
      correctDraw: 3,
    },
    tournament: {
      champion: 10,
      runnerUp: 5,
      topScorer: 5,
      bestPlayer: 3,
      bestGoalkeeper: 3,
    },
  });
});

// Recalcular puntos de grupos (administrativo, para múltiples usuarios)
app.post(
  '/api/admin/recalculate-group-points',
  ensureAuthenticated,
  async (req, res) => {
    try {
      // TODO: Agregar verificación de rol admin (ej: if (req.user.role !== 'admin') ...)

      const { groupResults } = req.body;
      // groupResults = { "A": { first: "teamId", second: "teamId", third: "teamId" }, ... }

      const results = [];

      for (const [group, standings] of Object.entries(groupResults)) {
        const predictions = await GroupPrediction.find({
          group: group.toUpperCase(),
        });

        for (const prediction of predictions) {
          let points = 0;

          if (
            prediction.firstPlaceTeam?.toString() ===
            standings.first
          )
            points += 5;
          if (
            prediction.secondPlaceTeam?.toString() ===
            standings.second
          )
            points += 3;
          if (
            prediction.thirdPlaceTeam?.toString() ===
            standings.third
          )
            points += 2;
          if (points === 10) points += 5; // Bonus grupo perfecto

          const oldPoints = prediction.pointsAwarded;
          prediction.pointsAwarded = points;
          await prediction.save();

          // Actualizar puntos del usuario
          const user = await User.findById(prediction.user);
          user.totalPoints = user.totalPoints - oldPoints + points;
          await user.save();

          results.push({
            userId: user._id,
            username: user.username,
            group,
            oldPoints,
            newPoints: points,
          });
        }
      }

      res.json({
        message: 'Puntos recalculados exitosamente',
        updated: results.length,
        results,
      });
    } catch (error) {
      console.error(
        '❌ Error al recalcular puntos:',
        error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================
// RUTA RAÍZ (INFORMATIONAL)
// ============================================

app.get('/', (req, res) => {
  res.json({
    message: '⚽ API Mundial 2026 - Bienvenido',
    version: '1.0.0',
    endpoints: {
      teams: '/api/teams',
      players: '/api/players',
      matches: '/api/matches',
      stats: '/api/stats',
      authGoogle: '/auth/google',
      authStatus: '/auth/status',
      profile: '/profile-data',
      predictions: {
        matches: '/api/predictions/match',
        groups: '/api/predictions/group',
        groupsBulk: '/api/predictions/groups/bulk',
        myGroupPredictions: '/api/predictions/groups/my-predictions',
        calculatePoints:
          '/api/predictions/groups/calculate-points',
        tournament: '/api/predictions/tournament',
        summary: '/api/predictions/summary',
      },
      leaderboard: {
        myPosition: '/api/leaderboard/my-position',
      },
      pointsSystem: '/api/points-system',
    },
  });
});

// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    details:
      process.env.NODE_ENV === 'development'
        ? err.message
        : undefined,
  });
});

// ============================================
// INICIO DEL SERVIDOR
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
