require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500, // each IP can make 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later."
  }
});
app.use(globalLimiter);

// Auth limiter (strict, only for signin/signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // only 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login/signup attempts. Please wait 15 minutes and try again."
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Add virtual for health profile
UserSchema.virtual('healthProfile', {
  ref: 'HealthProfile',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Enable virtuals in toJSON and toObject
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });
const User = mongoose.model('User', UserSchema);

// Health Profile Schema
const HealthProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
  height: { type: Number, required: true }, // in cm
  weight: { type: Number, required: true }, // in kg
  targetWeight: { type: Number },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  conditions: [{ type: String }],
  dietPreference: { type: String, enum: ['Vegetarian', 'Vegan', 'Non-vegetarian', 'Pescatarian', 'Keto', 'Paleo', 'Other'] },
  healthGoal: { type: String, enum: ['Weight Loss', 'Weight Gain', 'Maintain Weight', 'Muscle Building', 'Improve Fitness', 'Manage Condition'] },
  dailyCalorieTarget: { type: Number },
  bmi: { type: Number },
  smokingHabit: { type: String, enum: ['Non-smoker', 'Occasional', 'Regular', 'Former smoker'] },
  alcoholConsumption: { type: String, enum: ['Non-drinker', 'Occasional', 'Regular', 'Former drinker'] },
  emergencyContact: {
    name: { type: String },
    phone: { type: String }
  },
  allergies: [{ type: String }],
  medications: [{
    name: { type: String },
    dosage: { type: String },
    frequency: { type: String }
  }],
  activityLevel: { type: String, enum: ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extremely Active'] },
  sleepHours: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Calculate BMI before saving
HealthProfileSchema.pre('save', function (next) {
  if (this.height && this.weight) {
    const heightInMeters = this.height / 100;
    this.bmi = parseFloat((this.weight / (heightInMeters * heightInMeters)).toFixed(1));
  }
  this.updatedAt = Date.now();
  next();
});

const HealthProfile = mongoose.model('HealthProfile', HealthProfileSchema);

// User Note Schema (Multi-Note support)
const UserNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'New Note' },
  content: { type: String, default: '' },
  color: { type: String, default: '#fef3c7' },
  fontSize: { type: Number, default: 14 },
  isBold: { type: Boolean, default: false },
  isItalic: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});
const UserNote = mongoose.model('UserNote', UserNoteSchema);

// Community Query Schema (Member-to-Admin)
const CommunityQuerySchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupPost' },
  type: { type: String, enum: ['query', 'report', 'reach_out'], default: 'query' },
  message: { type: String, required: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});
const CommunityQuery = mongoose.model('CommunityQuery', CommunityQuerySchema);

// Seeding function for realistic communities
const seedCommunities = async () => {
  try {
    const count = await Group.countDocuments();
    if (count > 0) return; // Already seeded

    const officialAdmin = await User.findOne({ email: 'admin@healthfit.com' }) || await User.findOne();
    if (!officialAdmin) return;

    const initialGroups = [
      {
        groupName: "Diabetes Management Hub",
        description: "Official channel for daily tips on glucose monitoring, insulin management, and diabetic-friendly nutrition. Led by certified endocrinologists.",
        category: "chronic_diseases",
        targetConditions: ["Diabetes Type 1", "Diabetes Type 2", "Prediabetes"],
        severityLevel: "high",
        privacy: "public",
        creator: officialAdmin._id,
        membersCount: 1250
      },
      {
        groupName: "Cardiac Warriors",
        description: "Focusing on heart health, hypertension management, and post-surgery recovery tips. Stay updated with the latest in cardiovascular care.",
        category: "chronic_diseases",
        targetConditions: ["Hypertension", "Heart Disease", "Arrhythmia"],
        severityLevel: "critical",
        privacy: "public",
        creator: officialAdmin._id,
        membersCount: 840
      },
      {
        groupName: "Mental Wellness Circle",
        description: "A safe broadcast channel for mindfulness techniques, stress management, and official mental health resources.",
        category: "mental_health",
        targetConditions: ["Anxiety", "Depression", "Stress"],
        severityLevel: "medium",
        privacy: "public",
        creator: officialAdmin._id,
        membersCount: 2100
      },
      {
        groupName: "Keto & Low Carb Masters",
        description: "Daily recipes, nutritional science, and official guidance on maintaining a healthy ketogenic lifestyle.",
        category: "diet_nutrition",
        targetConditions: ["Weight Management", "Obesity"],
        severityLevel: "low",
        privacy: "public",
        creator: officialAdmin._id,
        membersCount: 3500
      },
      {
        groupName: "Thyroid Health Support",
        description: "Official expert guidance on Hypothyroidism, Hyperthyroidism, and Hashimoto's. Daily medication reminders and lifestyle adjustments.",
        category: "chronic_diseases",
        targetConditions: ["Hypothyroidism", "Hyperthyroidism"],
        severityLevel: "medium",
        privacy: "public",
        creator: officialAdmin._id,
        membersCount: 450
      },
      {
        groupName: "PCOS Wellness Hub",
        description: "Certified guidance on managing PCOS symptoms through nutrition, exercise, and hormonal balance tips.",
        category: "family_health",
        targetConditions: ["PCOS", "Hormonal Imbalance"],
        severityLevel: "medium",
        privacy: "public",
        creator: officialAdmin._id,
        membersCount: 1100
      },
      {
        groupName: "Senior Longevity Circle",
        description: "Focusing on healthy aging, joint health, and cognitive wellness for seniors. Expert-led health broadcasts.",
        category: "preventive_care",
        targetConditions: ["Aging", "Arthritis", "Cognitive Health"],
        severityLevel: "medium",
        privacy: "public",
        creator: officialAdmin._id,
        membersCount: 920
      }
    ];

    // Clear existing groups first to remove dummy data
    await Group.deleteMany({});
    
    await Group.insertMany(initialGroups);
    console.log('âœ… Realistic communities seeded successfully');
  } catch (err) {
    console.error('âŒ Seeding error:', err);
  }
};

// Call seeding logic on startup
setTimeout(seedCommunities, 5000);

// Group Post Schema
const GroupPostSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});
const GroupPost = mongoose.model('GroupPost', GroupPostSchema);

// Group Schema
// Group Schema
const GroupSchema = new mongoose.Schema({
  groupName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: [
      'chronic_diseases',
      'mental_health',
      'fitness_goals',
      'diet_nutrition',
      'age_groups',
      'gender_specific',
      'recovery_support',
      'preventive_care',
      'family_health',
      'other'
    ]
  },
  targetConditions: [{
    type: String,
    trim: true
  }],
  severityLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  privacy: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  requireApproval: {
    type: Boolean,
    default: false
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member', 'pending'],
      default: 'member'
    }
  }],
  membersCount: {
    type: Number,
    default: 0
  },
  maxMembers: {
    type: Number,
    min: 1,
    max: 10000
  },
  minAge: {
    type: Number,
    min: 0,
    max: 120
  },
  maxAge: {
    type: Number,
    min: 0,
    max: 120
  },
  allowedGenders: [{
    type: String,
    enum: ['Male', 'Female', 'Other']
  }],
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
GroupSchema.index({ category: 1, privacy: 1, isActive: 1 });
GroupSchema.index({ targetConditions: 1, isActive: 1 });
GroupSchema.index({ creator: 1 });
GroupSchema.index({ 'members.user': 1 });
GroupSchema.index({ groupName: 'text', description: 'text' });

const Group = mongoose.model('Group', GroupSchema);

// Family Schema
const FamilySchema = new mongoose.Schema({
  familyName: { type: String, required: true },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'child', 'elder'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  }],
  description: { type: String },
  familyType: {
    type: String,
    enum: ['immediate', 'extended', 'friends', 'health_group', 'other'],
    default: 'immediate'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
FamilySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Family = mongoose.model('Family', FamilySchema);

// Family Request Schema
const FamilyRequestSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  family: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
FamilyRequestSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const FamilyRequest = mongoose.model('FamilyRequest', FamilyRequestSchema);
const SupplementSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: { type: String },
  type: {
    type: String,
    enum: ['Vitamin', 'Mineral', 'Herbal', 'Amino Acid', 'Enzyme', 'Probiotic', 'Other'],
    required: true
  },
  dosageUnit: { type: String, required: true }, // mg, mcg, IU, etc.
  servingSize: { type: Number, required: true },
  ingredients: [{
    name: { type: String },
    amount: { type: Number },
    unit: { type: String }
  }],
  description: { type: String },
  potentialBenefits: [{ type: String }],
  potentialSideEffects: [{ type: String }],
  interactions: [{
    substance: { type: String },
    interactionType: {
      type: String,
      enum: ['Mild', 'Moderate', 'Severe']
    },
    description: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

const Supplement = mongoose.model('Supplement', SupplementSchema);

// User Supplement Schema
const UserSupplementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  supplementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplement'
  },
  customSupplement: {
    name: { type: String },
    brand: { type: String },
    type: { type: String },
    dosageUnit: { type: String },
    servingSize: { type: Number }
  },
  dosage: { type: Number, required: true },
  frequency: {
    type: String,
    enum: ['Once Daily', 'Twice Daily', 'Three Times Daily', 'As Needed'],
    required: true
  },
  specificTimes: [{ type: String }], // e.g., ["08:00", "12:00", "20:00"]
  withFood: { type: Boolean, default: false },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  reason: { type: String },
  healthProfessional: {
    name: { type: String },
    type: { type: String } // Doctor, Nutritionist, etc.
  },
  cost: {
    price: { type: Number },
    currency: { type: String, default: 'USD' },
    quantity: { type: Number }, // number of units in package
    refillReminder: { type: Boolean, default: false },
    refillThreshold: { type: Number } // days before running out
  },
  status: {
    type: String,
    enum: ['Active', 'Paused', 'Completed', 'Discontinued'],
    default: 'Active'
  },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSupplementSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});
UserSupplementSchema.index({ userId: 1, status: 1 });
const UserSupplement = mongoose.model('UserSupplement', UserSupplementSchema);

// Supplement Intake Schema
const SupplementIntakeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userSupplementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSupplement',
    required: true
  },
  takenAt: { type: Date, required: true },
  dosageTaken: { type: Number, required: true },
  wasTaken: { type: Boolean, default: true },
  skippedReason: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});
SupplementIntakeSchema.index({ userId: 1, takenAt: -1 });

const SupplementIntake = mongoose.model('SupplementIntake', SupplementIntakeSchema);

// Health Metric Schema
const HealthMetricSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['Energy', 'Mood', 'Sleep', 'Pain', 'Stress', 'Weight', 'Water', 'Activity', 'Custom'],
    required: true
  },
  customType: { type: String },
  value: { type: Number, required: true }, // 1-10 scale or actual measurement
  unit: { type: String },
  notes: { type: String },
  recordedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  // Enhanced fields for realistic tracking
  sleepData: {
    bedtime: { type: String },    // "23:30"
    wakeTime: { type: String },   // "07:00"
    quality: { type: Number, min: 1, max: 5 }
  },
  energyData: {
    timeOfDay: { type: String, enum: ['morning', 'afternoon', 'evening'] }
  },
  moodData: {
    emoji: { type: String },
    journal: { type: String }
  }
});
HealthMetricSchema.index({ userId: 1, recordedAt: -1 });
const HealthMetric = mongoose.model('HealthMetric', HealthMetricSchema);

// Water Intake Log Schema - Granular per-glass tracking
const WaterIntakeLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: { type: Number, required: true }, // in ml
  drinkType: {
    type: String,
    enum: ['water', 'tea', 'coffee', 'juice', 'smoothie', 'other'],
    default: 'water'
  },
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
WaterIntakeLogSchema.index({ userId: 1, timestamp: -1 });
const WaterIntakeLog = mongoose.model('WaterIntakeLog', WaterIntakeLogSchema);

// Reminder Dismissal Schema
const ReminderDismissalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reminderType: {
    type: String,
    enum: ['weight', 'water', 'sleep', 'mood', 'energy'],
    required: true
  },
  dismissedAt: { type: Date, default: Date.now }
});
ReminderDismissalSchema.index({ userId: 1, reminderType: 1 });
const ReminderDismissal = mongoose.model('ReminderDismissal', ReminderDismissalSchema);

// Interaction Warning Schema
const InteractionWarningSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  supplementsInvolved: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSupplement'
  }],
  severity: {
    type: String,
    enum: ['Mild', 'Moderate', 'Severe'],
    required: true
  },
  description: { type: String, required: true },
  recommendation: { type: String },
  acknowledged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const InteractionWarning = mongoose.model('InteractionWarning', InteractionWarningSchema);

// User Session Schema â€” tracks every login for contextual greetings
const UserSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loginTimestamp: { type: Date, default: Date.now },
  device: { type: String, default: 'web' }
});
UserSessionSchema.index({ userId: 1, loginTimestamp: -1 });
const UserSession = mongoose.model('UserSession', UserSessionSchema);

// Meal Log Schema â€” quick meal check-ins
const MealLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
  skipped: { type: Boolean, default: false },
  loggedAt: { type: Date, default: Date.now }
});
MealLogSchema.index({ userId: 1, loggedAt: -1 });
const MealLog = mongoose.model('MealLog', MealLogSchema);

// Hydration Profile Schema â€” bottle size, daily goal, reminder prefs
const HydrationProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bottleSizeMl: { type: Number, default: 500 },
  dailyGoalMl: { type: Number, default: 3000 },
  reminderIntervalMin: { type: Number, default: 45 },
  wakeTime: { type: String, default: '07:00' },
  sleepTime: { type: String, default: '23:00' },
  updatedAt: { type: Date, default: Date.now }
});
const HydrationProfile = mongoose.model('HydrationProfile', HydrationProfileSchema);



// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Input Validation Middleware
const validateInputs = (method) => {
  switch (method) {
    case 'signup': {
      return [
        body('username').not().isEmpty().trim().escape(),
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 })
      ]
    }
    case 'signin': {
      return [
        body('email').isEmail().normalizeEmail(),
        body('password').exists()
      ]
    }
    case 'updatePassword': {
      return [
        body('currentPassword').exists(),
        body('newPassword').isLength({ min: 6 })
      ]
    }
    case 'updateProfile': {
      return [
        body('username').optional().not().isEmpty().trim().escape(),
        body('email').optional().isEmail().normalizeEmail()
      ]
    }
  }
}

// Auth Middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '365d' });
}

// Signup Route
app.post('/api/signup', authLimiter, validateInputs('signup'), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { username, email, password } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({ token, userId: user._id, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Signin Route
app.post('/api/signin', authLimiter, validateInputs('signin'), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({ token, userId: user._id, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Health Profile
app.get('/api/health-profile', authenticate, async (req, res) => {
  try {
    const healthProfile = await HealthProfile.findOne({ userId: req.user._id });

    if (!healthProfile) {
      return res.status(404).json({ message: 'Health profile not found' });
    }

    res.json(healthProfile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create/Update Health Profile
app.post('/api/health-profile', authenticate, [
  body('age').isInt({ min: 1, max: 120 }),
  body('gender').isIn(['Male', 'Female', 'Other']),
  body('height').isFloat({ min: 50, max: 250 }),
  body('weight').isFloat({ min: 2, max: 300 }),
  body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  body('dietPreference').optional().isIn(['Vegetarian', 'Vegan', 'Non-vegetarian', 'Pescatarian', 'Keto', 'Paleo', 'Other']),
  body('healthGoal').optional().isIn(['Weight Loss', 'Weight Gain', 'Maintain Weight', 'Muscle Building', 'Improve Fitness', 'Manage Condition']),
  body('dailyCalorieTarget').optional().isInt({ min: 500, max: 10000 }),
  body('smokingHabit').optional().isIn(['Non-smoker', 'Occasional', 'Regular', 'Former smoker']),
  body('alcoholConsumption').optional().isIn(['Non-drinker', 'Occasional', 'Regular', 'Former drinker']),
  body('activityLevel').optional().isIn(['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extremely Active']),
  body('sleepHours').optional().isFloat({ min: 0, max: 24 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      age, gender, height, weight, targetWeight, bloodGroup,
      conditions, dietPreference, healthGoal, dailyCalorieTarget,
      smokingHabit, alcoholConsumption, emergencyContact,
      allergies, medications, activityLevel, sleepHours
    } = req.body;

    let healthProfile = await HealthProfile.findOne({ userId: req.user._id });

    if (healthProfile) {
      // Update existing profile
      healthProfile = await HealthProfile.findOneAndUpdate(
        { userId: req.user._id },
        {
          age, gender, height, weight, targetWeight, bloodGroup,
          conditions, dietPreference, healthGoal, dailyCalorieTarget,
          smokingHabit, alcoholConsumption, emergencyContact,
          allergies, medications, activityLevel, sleepHours
        },
        { new: true, runValidators: true }
      );
    } else {
      // Create new profile
      healthProfile = new HealthProfile({
        userId: req.user._id,
        user: req.user._id,
        email: req.user.email,
        username: req.user.username,
        age, gender, height, weight, targetWeight, bloodGroup,
        conditions, dietPreference, healthGoal, dailyCalorieTarget,
        smokingHabit, alcoholConsumption, emergencyContact,
        allergies, medications, activityLevel, sleepHours
      });
      await healthProfile.save();
    }

    res.json({ message: 'Health profile saved successfully', healthProfile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Password Route
app.put('/api/update-password', authenticate, validateInputs('updatePassword'), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Profile Route
app.put('/api/update-profile', authenticate, validateInputs('updateProfile'), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email } = req.body;
    const user = req.user;

    // Check if new email is already taken
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Check if new username is already taken
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username already in use' });
      }
    }

    // Update fields
    if (username) user.username = username;
    if (email) user.email = email;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===================
// NOTES ROUTES
// ===================

// GET /api/notes
app.get('/api/notes', authenticate, async (req, res) => {
  try {
    const notes = await UserNote.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/notes (Create or Update)
app.post('/api/notes', authenticate, async (req, res) => {
  try {
    const { id, title, content, color, fontSize, isBold, isItalic } = req.body;
    let userNote;
    
    if (id) {
      userNote = await UserNote.findOne({ _id: id, userId: req.user._id });
      if (userNote) {
        userNote.title = title || userNote.title;
        userNote.content = content !== undefined ? content : userNote.content;
        userNote.color = color || userNote.color;
        userNote.fontSize = fontSize || userNote.fontSize;
        userNote.isBold = isBold !== undefined ? isBold : userNote.isBold;
        userNote.isItalic = isItalic !== undefined ? isItalic : userNote.isItalic;
        userNote.updatedAt = Date.now();
        await userNote.save();
      }
    } else {
      userNote = new UserNote({ 
        userId: req.user._id, 
        title: title || 'New Note', 
        content: content || '', 
        color: color || '#fef3c7',
        fontSize: fontSize || 14,
        isBold: isBold || false,
        isItalic: isItalic || false
      });
      await userNote.save();
    }
    
    res.json(userNote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/notes/:id
app.delete('/api/notes/:id', authenticate, async (req, res) => {
  try {
    await UserNote.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===================
// GROUP ROUTES
// ===================

// GET /api/groups/:id/posts
app.get('/api/groups/:id/posts', authenticate, async (req, res) => {
  try {
    const posts = await GroupPost.find({ groupId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/groups/:id/posts (Enforce Admin/Creator Only)
app.post('/api/groups/:id/posts', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only creator or admin can post broadcast tips
    const isCreator = group.creator.toString() === req.user._id.toString();
    if (!isCreator) {
      return res.status(403).json({ message: 'Only community admins can post daily tips.' });
    }

    const newPost = new GroupPost({
      groupId: req.params.id,
      authorId: req.user._id,
      authorName: req.user.username,
      content
    });

    await newPost.save();
    res.json(newPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/groups/:id/queries (For members to reach out)
app.post('/api/groups/:id/queries', authenticate, async (req, res) => {
  try {
    const { message, type, postId } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const newQuery = new CommunityQuery({
      groupId: req.params.id,
      userId: req.user._id,
      postId,
      type: type || 'query',
      message
    });

    await newQuery.save();
    res.json({ message: 'Your inquiry has been sent to the community admin. They will reach out soon.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/groups/posts/:postId/like
app.post('/api/groups/posts/:postId/like', authenticate, async (req, res) => {
  try {
    const post = await GroupPost.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(req.user._id);
    if (likeIndex === -1) {
      post.likes.push(req.user._id);
    } else {
      post.likes.splice(likeIndex, 1);
    }

    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /groups - Get all groups (public + user's private groups)
app.get('/api/groups', authenticate, async (req, res) => {
  try {
    const publicGroups = await Group.find({
      privacy: 'public',
      isActive: true
    }).populate('creator', 'username email')
      .populate('members.user', 'username email')
      .populate('moderators', 'username email')
      .sort({ createdAt: -1 });

    const userPrivateGroups = await Group.find({
      $or: [
        { creator: req.user.id },
        { 'members.user': req.user.id }
      ],
      privacy: 'private',
      isActive: true
    }).populate('creator', 'username email')
      .populate('members.user', 'username email')
      .populate('moderators', 'username email')
      .sort({ createdAt: -1 });

    const allGroups = [...publicGroups, ...userPrivateGroups];

    res.json(allGroups);
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /groups/my - Get user's groups (created + joined)
app.get('/api/groups/my', authenticate, async (req, res) => {
  try {
    const groups = await Group.find({
      $or: [
        { creator: req.user.id },
        { 'members.user': req.user.id }
      ],
      isActive: true
    }).populate('creator', 'username email')
      .populate('members.user', 'username email')
      .populate('moderators', 'username email')
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (err) {
    console.error('Get my groups error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /groups/discover - Discover groups by condition/category
app.get('/api/groups/discover', authenticate, async (req, res) => {
  try {
    const { condition, category, search } = req.query;
    let query = { privacy: 'public', isActive: true };

    if (condition) {
      query.targetConditions = { $in: [condition] };
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { groupName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { targetConditions: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const groups = await Group.find(query)
      .populate('creator', 'username email')
      .populate('members.user', 'username email')
      .limit(50)
      .sort({ membersCount: -1, createdAt: -1 });

    res.json(groups);
  } catch (err) {
    console.error('Discover groups error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /groups/suggested - Get suggested groups based on user's health profile
app.get('/api/groups/suggested', authenticate, async (req, res) => {
  try {
    const healthProfile = await HealthProfile.findOne({ user: req.user.id });

    if (!healthProfile) {
      return res.json([]);
    }

    const userConditions = healthProfile.conditions || [];
    const userAge = healthProfile.age;
    const userGender = healthProfile.gender;

    let query = {
      privacy: 'public',
      isActive: true,
      'members.user': { $ne: req.user.id },
      creator: { $ne: req.user.id }
    };

    // Find groups matching user's conditions
    if (userConditions.length > 0) {
      query.targetConditions = { $in: userConditions };
    }

    const conditionGroups = await Group.find(query)
      .populate('creator', 'username email')
      .populate('members.user', 'username email')
      .limit(10)
      .sort({ membersCount: -1 });

    // Find age-appropriate groups
    let ageGroups = [];
    if (userAge) {
      const ageQuery = {
        ...query,
        $and: [
          { $or: [{ minAge: { $lte: userAge } }, { minAge: { $exists: false } }] },
          { $or: [{ maxAge: { $gte: userAge } }, { maxAge: { $exists: false } }] }
        ]
      };
      delete ageQuery.targetConditions;

      ageGroups = await Group.find(ageQuery)
        .populate('creator', 'username email')
        .populate('members.user', 'username email')
        .limit(5)
        .sort({ membersCount: -1 });
    }

    // Combine and deduplicate
    const allSuggested = [...conditionGroups, ...ageGroups];
    const uniqueGroups = allSuggested.filter((group, index, self) =>
      index === self.findIndex(g => g._id.toString() === group._id.toString())
    );

    res.json(uniqueGroups.slice(0, 15));
  } catch (err) {
    console.error('Get suggested groups error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /groups - Create a new group
app.post('/api/groups', authenticate, async (req, res) => {
  try {
    const {
      groupName,
      description,
      category,
      targetConditions,
      severityLevel,
      privacy,
      requireApproval,
      maxMembers,
      minAge,
      maxAge,
      allowedGenders
    } = req.body;

    // Validation
    if (!groupName || !description || !category) {
      return res.status(400).json({
        message: 'Group name, description, and category are required'
      });
    }

    // Check if group name already exists
    const existingGroup = await Group.findOne({
      groupName: { $regex: new RegExp(`^${groupName}$`, 'i') },
      isActive: true
    });

    if (existingGroup) {
      return res.status(400).json({
        message: 'A group with this name already exists'
      });
    }

    const newGroup = new Group({
      groupName,
      description,
      category,
      targetConditions: targetConditions || [],
      severityLevel,
      privacy: privacy || 'public',
      requireApproval: requireApproval || false,
      maxMembers: maxMembers || null,
      minAge: minAge || null,
      maxAge: maxAge || null,
      allowedGenders: allowedGenders || [],
      creator: req.user.id,
      moderators: [req.user.id],
      members: [{
        user: req.user.id,
        joinedAt: new Date(),
        role: 'admin'
      }],
      membersCount: 1
    });

    await newGroup.save();

    const populatedGroup = await Group.findById(newGroup._id)
      .populate('creator', 'username email')
      .populate('members.user', 'username email')
      .populate('moderators', 'username email');

    res.status(201).json(populatedGroup);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /groups/:id - Get group details
app.get('/api/groups/:id', authenticate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'username email')
      .populate('members.user', 'username email')
      .populate('moderators', 'username email');

    if (!group || !group.isActive) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user has access to private group
    if (group.privacy === 'private') {
      const isMember = group.members.some(m => m.user._id.toString() === req.user.id);
      const isCreator = group.creator._id.toString() === req.user.id;

      if (!isMember && !isCreator) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(group);
  } catch (err) {
    console.error('Get group details error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /groups/:id/join - Join a group
app.post('/api/groups/:id/join', authenticate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group || !group.isActive) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if already a member
    const isAlreadyMember = group.members.some(m => m.user.toString() === req.user.id);
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    // Check member limit
    if (group.maxMembers && group.membersCount >= group.maxMembers) {
      return res.status(400).json({ message: 'Group has reached maximum capacity' });
    }

    // Check age and gender restrictions
    const healthProfile = await HealthProfile.findOne({ user: req.user.id });
    if (healthProfile) {
      if (group.minAge && healthProfile.age < group.minAge) {
        return res.status(400).json({ message: 'You do not meet the minimum age requirement' });
      }
      if (group.maxAge && healthProfile.age > group.maxAge) {
        return res.status(400).json({ message: 'You exceed the maximum age limit' });
      }
      if (group.allowedGenders.length > 0 && !group.allowedGenders.includes(healthProfile.gender)) {
        return res.status(400).json({ message: 'This group has gender restrictions' });
      }
    }

    const memberRole = group.requireApproval ? 'pending' : 'member';

    group.members.push({
      user: req.user.id,
      joinedAt: new Date(),
      role: memberRole
    });

    if (!group.requireApproval) {
      group.membersCount += 1;
    }

    await group.save();

    const updatedGroup = await Group.findById(group._id)
      .populate('creator', 'username email')
      .populate('members.user', 'username email')
      .populate('moderators', 'username email');

    res.json({
      message: group.requireApproval ? 'Join request sent for approval' : 'Successfully joined the group',
      group: updatedGroup
    });
  } catch (err) {
    console.error('Join group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /groups/:id/leave - Leave a group
app.post('/api/groups/:id/leave', authenticate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is the creator
    if (group.creator.toString() === req.user.id) {
      return res.status(400).json({ message: 'Group creator cannot leave. Please transfer ownership or delete the group.' });
    }

    // Remove user from members
    const memberIndex = group.members.findIndex(m => m.user.toString() === req.user.id);
    if (memberIndex === -1) {
      return res.status(400).json({ message: 'You are not a member of this group' });
    }

    group.members.splice(memberIndex, 1);
    group.membersCount = Math.max(0, group.membersCount - 1);

    // Remove from moderators if applicable
    group.moderators = group.moderators.filter(m => m.toString() !== req.user.id);

    await group.save();

    res.json({ message: 'Successfully left the group' });
  } catch (err) {
    console.error('Leave group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /groups/:id/approve-member - Approve pending member (moderator/admin only)
app.post('/api/groups/:id/approve-member', authenticate, async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is moderator or creator
    const isCreator = group.creator.toString() === req.user.id;
    const isModerator = group.moderators.includes(req.user.id);

    if (!isCreator && !isModerator) {
      return res.status(403).json({ message: 'Only moderators can approve members' });
    }

    // Find and update member
    const member = group.members.find(m => m.user.toString() === userId && m.role === 'pending');
    if (!member) {
      return res.status(404).json({ message: 'Pending member not found' });
    }

    member.role = 'member';
    group.membersCount += 1;

    await group.save();

    const updatedGroup = await Group.findById(group._id)
      .populate('creator', 'username email')
      .populate('members.user', 'username email')
      .populate('moderators', 'username email');

    res.json({ message: 'Member approved successfully', group: updatedGroup });
  } catch (err) {
    console.error('Approve member error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /groups/:id - Delete group (creator only)
app.delete('/api/groups/:id', authenticate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is the creator
    if (group.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the group creator can delete the group' });
    }

    group.isActive = false;
    group.deletedAt = new Date();
    await group.save();

    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===================
// FAMILY ROUTES
// ===================

// Get user's family
app.get('/api/family', authenticate, async (req, res) => {
  try {
    const family = await Family.findOne({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id, 'members.status': 'accepted' }
      ]
    }).populate('owner', 'username email')
      .populate('members.user', 'username email');

    if (!family) {
      return res.status(404).json({ message: 'No family found' });
    }

    res.json(family);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new family
app.post('/api/family', authenticate, [
  body('familyName').not().isEmpty().trim().escape(),
  body('familyType').optional().isIn(['immediate', 'extended', 'friends', 'health_group', 'other']),
  body('description').optional().trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { familyName, familyType, description } = req.body;

    // Create new family
    const family = new Family({
      familyName,
      familyType: familyType || 'immediate',
      description,
      owner: req.user._id,
      members: [{
        user: req.user._id,
        role: 'owner',
        status: 'accepted'
      }]
    });

    await family.save();

    // Populate the data before sending response
    await family.populate('owner', 'username email');
    await family.populate('members.user', 'username email');

    res.status(201).json({ message: 'Family created successfully', family });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete family (only for owner)
app.delete('/api/family/:familyId', authenticate, async (req, res) => {
  try {
    const { familyId } = req.params;

    const family = await Family.findOne({
      _id: familyId,
      owner: req.user._id
    });

    if (!family) {
      return res.status(404).json({ message: 'Family not found or you are not the owner' });
    }

    await Family.findByIdAndDelete(familyId);

    // Also delete all related requests
    await FamilyRequest.deleteMany({ family: familyId });

    res.json({ message: 'Family deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get family health dashboard
app.get('/api/family/:familyId/health-dashboard', authenticate, async (req, res) => {
  try {
    const { familyId } = req.params;

    // Get family and verify user is a member
    const family = await Family.findOne({
      _id: familyId,
      'members.user': req.user._id,
      'members.status': 'accepted'
    }).populate({
      path: 'members.user',
      select: 'username email',
      populate: {
        path: 'healthProfile',
        model: 'HealthProfile',
        select: 'age gender height weight bloodGroup conditions allergies medications activityLevel'
      }
    });

    if (!family) {
      return res.status(404).json({ message: 'Family not found or access denied' });
    }

    // Filter only accepted members with health profiles
    const familyMembers = family.members
      .filter(member => member.status === 'accepted')
      .map(member => ({
        _id: member.user._id,
        username: member.user.username,
        email: member.user.email,
        role: member.role,
        healthProfile: member.user.healthProfile || null
      }));

    res.json({
      familyName: family.familyName,
      members: familyMembers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send family invitation
app.post('/api/family/:familyId/invite', authenticate, [
  body('email').isEmail().normalizeEmail(),
  body('message').optional().trim().escape(),
  body('role').optional().isIn(['admin', 'member', 'child', 'elder'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, message, role } = req.body;
    const { familyId } = req.params;

    // Check if family exists and user is a member with appropriate permissions
    const family = await Family.findOne({
      _id: familyId,
      'members.user': req.user._id,
      'members.status': 'accepted',
      $or: [
        { 'members.role': 'owner' },
        { 'members.role': 'admin' }
      ]
    });

    if (!family) {
      return res.status(403).json({ message: 'You do not have permission to invite members to this family' });
    }

    // Find the user to invite
    const userToInvite = await User.findOne({ email });
    if (!userToInvite) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    // Check if user is already in the family
    const alreadyMember = family.members.some(
      member => member.user.toString() === userToInvite._id.toString()
    );

    if (alreadyMember) {
      return res.status(400).json({ message: 'User is already in this family' });
    }

    // Check if there's already a pending request
    const existingRequest = await FamilyRequest.findOne({
      fromUser: req.user._id,
      toUser: userToInvite._id,
      family: familyId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Invitation already sent to this user' });
    }

    // Create invitation
    const familyRequest = new FamilyRequest({
      fromUser: req.user._id,
      toUser: userToInvite._id,
      family: familyId,
      role: role || 'member',
      message: message || `${req.user.username} invited you to join their family`
    });

    await familyRequest.save();

    // Populate data for response
    await familyRequest.populate('fromUser', 'username email');
    await familyRequest.populate('toUser', 'username email');
    await familyRequest.populate('family');

    res.status(201).json({ message: 'Invitation sent successfully', request: familyRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send family invitation (alternative endpoint)
app.post('/api/family/invite', authenticate, [
  body('email').isEmail().normalizeEmail(),
  body('familyId').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, familyId, message } = req.body;

    // Check if family exists and user is the owner
    const family = await Family.findOne({
      _id: familyId,
      owner: req.user._id
    });

    if (!family) {
      return res.status(404).json({ message: 'Family not found or you are not the owner' });
    }

    // Find the user to invite
    const userToInvite = await User.findOne({ email });
    if (!userToInvite) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    // Check if user is already in the family
    const alreadyMember = family.members.some(
      member => member.user.toString() === userToInvite._id.toString() && member.status === 'accepted'
    );

    if (alreadyMember) {
      return res.status(400).json({ message: 'User is already a family member' });
    }

    // Check if there's already a pending request
    const existingRequest = await FamilyRequest.findOne({
      fromUser: req.user._id,
      toUser: userToInvite._id,
      family: familyId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Invitation already sent to this user' });
    }

    // Create invitation
    const familyRequest = new FamilyRequest({
      fromUser: req.user._id,
      toUser: userToInvite._id,
      family: familyId,
      message: message || `${req.user.username} invited you to join their family`
    });

    await familyRequest.save();

    // Populate data for response
    await familyRequest.populate('fromUser', 'username email');
    await familyRequest.populate('toUser', 'username email');
    await familyRequest.populate('family');

    res.status(201).json({ message: 'Invitation sent successfully', request: familyRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending family requests
app.get('/api/family/requests', authenticate, async (req, res) => {
  try {
    const requests = await FamilyRequest.find({
      toUser: req.user._id,
      status: 'pending'
    })
      .populate('fromUser', 'username email')
      .populate('family', 'familyName familyType')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Respond to family request
app.post('/api/family/requests/:requestId/respond', authenticate, [
  body('response').isIn(['accepted', 'rejected'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { response } = req.body;
    const { requestId } = req.params;

    const familyRequest = await FamilyRequest.findOne({
      _id: requestId,
      toUser: req.user._id,
      status: 'pending'
    }).populate('family');

    if (!familyRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (response === 'accepted') {
      // Add user to family
      const family = await Family.findById(familyRequest.family._id);
      family.members.push({
        user: req.user._id,
        role: familyRequest.role,
        status: 'accepted'
      });
      await family.save();
    }

    // Update request status
    familyRequest.status = response;
    await familyRequest.save();

    res.json({ message: `Request ${response} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave family
app.post('/api/family/:familyId/leave', authenticate, async (req, res) => {
  try {
    const { familyId } = req.params;

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ message: 'Family not found' });
    }

    // Check if user is the owner
    if (family.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Owners cannot leave their family. Transfer ownership or delete the family instead.' });
    }

    // Remove user from family members
    family.members = family.members.filter(
      member => member.user.toString() !== req.user._id.toString()
    );

    await family.save();
    res.json({ message: 'Left family successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove family member (only for owners/admins)
app.delete('/api/family/:familyId/members/:memberId', authenticate, async (req, res) => {
  try {
    const { familyId, memberId } = req.params;

    const family = await Family.findOne({
      _id: familyId,
      'members.user': req.user._id,
      'members.status': 'accepted',
      $or: [
        { 'members.role': 'owner' },
        { 'members.role': 'admin' }
      ]
    });

    if (!family) {
      return res.status(403).json({ message: 'You do not have permission to remove members' });
    }

    // Check if trying to remove owner
    if (family.owner.toString() === memberId) {
      return res.status(400).json({ message: 'Cannot remove the family owner' });
    }

    // Check if trying to remove yourself
    if (memberId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Use the leave family option instead' });
    }

    // Remove member
    family.members = family.members.filter(
      member => member.user.toString() !== memberId
    );

    await family.save();
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get family health dashboard (alternative endpoint)
app.get('/api/family/health-dashboard', authenticate, async (req, res) => {
  try {
    // Get user's family
    const family = await Family.findOne({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id, 'members.status': 'accepted' }
      ]
    }).populate({
      path: 'members.user',
      select: 'username email',
      populate: {
        path: 'healthProfile',
        model: 'HealthProfile',
        select: 'age gender height weight bloodGroup conditions allergies'
      }
    });

    if (!family) {
      return res.status(404).json({ message: 'No family found' });
    }

    // Filter only accepted members with health profiles
    const familyMembers = family.members
      .filter(member => member.status === 'accepted')
      .map(member => ({
        _id: member.user._id,
        username: member.user.username,
        email: member.user.email,
        role: member.role,
        healthProfile: member.user.healthProfile || null
      }));

    res.json({
      familyName: family.familyName,
      members: familyMembers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove family member (alternative endpoint)
app.delete('/api/family/members/:memberId', authenticate, async (req, res) => {
  try {
    const { memberId } = req.params;

    const family = await Family.findOne({
      owner: req.user._id
    });

    if (!family) {
      return res.status(404).json({ message: 'You are not the owner of any family' });
    }

    // Check if member exists
    const memberIndex = family.members.findIndex(
      member => member.user.toString() === memberId && member.status === 'accepted'
    );

    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Cannot remove yourself if you're the owner
    if (memberId === req.user._id.toString() && family.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'As the owner, you cannot remove yourself. Transfer ownership first.' });
    }

    // Remove member
    family.members.splice(memberIndex, 1);
    await family.save();

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all user's families (both owned and joined)
app.get('/api/families', authenticate, async (req, res) => {
  try {
    const families = await Family.find({
      'members.user': req.user._id,
      'members.status': 'accepted'
    })
      .populate('owner', 'username email')
      .populate('members.user', 'username email')
      .sort({ createdAt: -1 });

    res.json(families);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get family by ID
app.get('/api/family/:id', authenticate, async (req, res) => {
  try {
    const family = await Family.findOne({
      _id: req.params.id,
      'members.user': req.user._id,
      'members.status': 'accepted'
    })
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    if (!family) {
      return res.status(404).json({ message: 'Family not found or access denied' });
    }

    res.json(family);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Account Route
app.delete('/api/delete-account', authenticate, async (req, res) => {
  try {
    const user = req.user;
    await User.findByIdAndDelete(user._id);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected Route Example
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/supplements', authenticate, async (req, res) => {
  try {
    const { search, type, page = 1, limit = 20 } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (type) {
      query.type = type;
    }

    const supplements = await Supplement.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 });

    const total = await Supplement.countDocuments(query);

    res.json({
      supplements,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's supplements
app.get('/api/user-supplements', authenticate, async (req, res) => {
  try {
    const userSupplements = await UserSupplement.find({ userId: req.user.id })
      .populate('supplementId')
      .sort({ createdAt: -1 });

    res.json(userSupplements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a supplement to user's regimen
app.post('/api/user-supplements', authenticate, async (req, res) => {
  try {
    const {
      supplementId,
      customSupplement,
      dosage,
      frequency,
      specificTimes,
      withFood,
      startDate,
      endDate,
      reason,
      healthProfessional,
      cost,
      notes
    } = req.body;

    // Check if supplement exists if not custom
    if (supplementId) {
      const supplement = await Supplement.findById(supplementId);
      if (!supplement) {
        return res.status(404).json({ message: 'Supplement not found' });
      }
    }

    const userSupplement = new UserSupplement({
      userId: req.user.id,
      supplementId,
      customSupplement,
      dosage,
      frequency,
      specificTimes,
      withFood,
      startDate,
      endDate,
      reason,
      healthProfessional,
      cost,
      notes
    });

    await userSupplement.save();

    // Check for interactions
    await checkInteractions(req.user.id, userSupplement._id);

    res.status(201).json(userSupplement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update user supplement
app.put('/api/user-supplements/:id', authenticate, async (req, res) => {
  try {
    const userSupplement = await UserSupplement.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!userSupplement) {
      return res.status(404).json({ message: 'Supplement not found' });
    }

    Object.keys(req.body).forEach(key => {
      userSupplement[key] = req.body[key];
    });

    await userSupplement.save();

    // Check for interactions after update
    await checkInteractions(req.user.id, userSupplement._id);

    res.json(userSupplement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete user supplement
app.delete('/api/user-supplements/:id', authenticate, async (req, res) => {
  try {
    const userSupplement = await UserSupplement.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!userSupplement) {
      return res.status(404).json({ message: 'Supplement not found' });
    }

    // Delete all intake records for this supplement
    await SupplementIntake.deleteMany({ userSupplementId: req.params.id });

    res.json({ message: 'Supplement removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Get intake records (alternative to intake-history)
// Update the intake history endpoint to properly populate supplement names
app.get('/api/intake', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, userSupplementId, limit = 100 } = req.query;
    let query = { userId: req.user._id };

    if (startDate && endDate) {
      query.takenAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (userSupplementId) {
      query.userSupplementId = userSupplementId;
    }

    const intakeHistory = await SupplementIntake.find(query)
      .populate({
        path: 'userSupplementId',
        populate: {
          path: 'supplementId',
          model: 'Supplement'
        }
      })
      .sort({ takenAt: -1 })
      .limit(parseInt(limit));

    // Process the data to include supplement name for easy frontend display
    const processedHistory = intakeHistory.map(intake => {
      const userSupplement = intake.userSupplementId;
      let supplementName = 'Unknown Supplement';

      if (userSupplement) {
        if (userSupplement.customSupplement && userSupplement.customSupplement.name) {
          supplementName = userSupplement.customSupplement.name;
        } else if (userSupplement.supplementId && userSupplement.supplementId.name) {
          supplementName = userSupplement.supplementId.name;
        }
      }

      return {
        ...intake.toObject(),
        supplement: supplementName,
        dosageTaken: intake.dosageTaken || (userSupplement ? userSupplement.dosage : 0),
        unit: userSupplement ?
          (userSupplement.customSupplement ? userSupplement.customSupplement.dosageUnit :
            userSupplement.supplementId ? userSupplement.supplementId.dosageUnit : 'units') : 'units'
      };
    });

    res.json(processedHistory);
  } catch (error) {
    console.error('Intake history error:', error);
    res.status(500).json({ message: error.message });
  }
});
// Record supplement intake
app.post('/api/intake', authenticate, async (req, res) => {
  try {
    const { userSupplementId, takenAt, dosageTaken, wasTaken, skippedReason, notes } = req.body;

    const userSupplement = await UserSupplement.findOne({
      _id: userSupplementId,
      userId: req.user.id
    });

    if (!userSupplement) {
      return res.status(404).json({ message: 'Supplement not found' });
    }

    const intake = new SupplementIntake({
      userId: req.user.id,
      userSupplementId,
      takenAt: takenAt || new Date(),
      dosageTaken: dosageTaken || userSupplement.dosage,
      wasTaken,
      skippedReason,
      notes
    });

    await intake.save();
    res.status(201).json(intake);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get intake history
app.get('/api/intake-history', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, userSupplementId } = req.query;
    let query = { userId: req.user.id };

    if (startDate && endDate) {
      query.takenAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (userSupplementId) {
      query.userSupplementId = userSupplementId;
    }

    const intakeHistory = await SupplementIntake.find(query)
      .populate('userSupplementId')
      .sort({ takenAt: -1 });

    res.json(intakeHistory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Adherence reports endpoint (add this if not exists)
// Update the adherence reports endpoint
app.get('/api/adherence-reports', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate || new Date().setDate(new Date().getDate() - 30));
    const end = new Date(endDate || new Date());

    const userSupplements = await UserSupplement.find({
      userId: req.user._id,
      status: 'Active'
    }).populate('supplementId');

    const reports = await Promise.all(userSupplements.map(async (supp) => {
      try {
        // Calculate expected intakes based on frequency and date range
        const daysInPeriod = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const dosesPerDay = getDosesPerDay(supp.frequency);
        const expectedIntakes = daysInPeriod * dosesPerDay;

        // Get actual intakes for this supplement
        const actualIntakes = await SupplementIntake.countDocuments({
          userId: req.user._id,
          userSupplementId: supp._id,
          takenAt: { $gte: start, $lte: end },
          wasTaken: true
        });

        const adherenceRate = expectedIntakes > 0
          ? Math.round((actualIntakes / expectedIntakes) * 100)
          : 100;

        const supplementName = supp.customSupplement?.name ||
          supp.supplementId?.name ||
          'Unknown Supplement';

        return {
          supplement: supplementName,
          supplementId: supp._id,
          expectedIntakes: expectedIntakes,
          actualIntakes: actualIntakes,
          adherenceRate: adherenceRate,
          missedIntakes: Math.max(0, expectedIntakes - actualIntakes)
        };
      } catch (error) {
        console.error(`Error calculating adherence for supplement ${supp._id}:`, error);
        return {
          supplement: 'Error calculating',
          expectedIntakes: 0,
          actualIntakes: 0,
          adherenceRate: 0,
          missedIntakes: 0
        };
      }
    }));

    res.json(reports);
  } catch (error) {
    console.error('Adherence reports error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get cost tracking reports

// Cost reports endpoint (add this if not exists)
app.get('/api/cost-reports', authenticate, async (req, res) => {
  try {
    const userSupplements = await UserSupplement.find({ userId: req.user._id })
      .populate('supplementId');

    const supplements = userSupplements.map(supp => {
      const supplementName = supp.customSupplement?.name || supp.supplementId?.name;
      const cost = supp.cost || {};
      const costPerServing = cost.price && cost.quantity ? cost.price / cost.quantity : 0;
      const dosesPerDay = getDosesPerDay(supp.frequency); // Use the same helper function
      const dailyCost = costPerServing * dosesPerDay;

      return {
        name: supplementName,
        cost: cost.price || 0,
        currency: cost.currency || 'USD',
        quantity: cost.quantity || 0,
        dailyCost: dailyCost,
        monthlyCost: dailyCost * 30,
        yearlyCost: dailyCost * 365
      };
    });

    const totalDailyCost = supplements.reduce((sum, report) => sum + report.dailyCost, 0);
    const totalMonthlyCost = supplements.reduce((sum, report) => sum + report.monthlyCost, 0);
    const totalYearlyCost = supplements.reduce((sum, report) => sum + report.yearlyCost, 0);

    res.json({
      supplements: supplements,
      totals: {
        daily: totalDailyCost,
        monthly: totalMonthlyCost,
        yearly: totalYearlyCost
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get effectiveness tracking
app.get('/api/effectiveness', authenticate, async (req, res) => {
  try {
    const { supplementId, startDate, endDate } = req.query;
    const start = new Date(startDate || new Date().setMonth(new Date().getMonth() - 1));
    const end = new Date(endDate || new Date());

    // Get health metrics for the period
    const healthMetrics = await HealthMetric.find({
      userId: req.user.id,
      recordedAt: { $gte: start, $lte: end }
    }).sort({ recordedAt: 1 });

    // Get supplement start date if specific supplement is requested
    let supplementStartDate = null;
    if (supplementId) {
      const userSupplement = await UserSupplement.findOne({
        _id: supplementId,
        userId: req.user.id
      });
      supplementStartDate = userSupplement?.startDate;
    }

    res.json({
      healthMetrics,
      supplementStartDate
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/intake-timeline - Get intake counts by date for analytics - FIXED VERSION
app.get('/api/intake-timeline', authenticate, async (req, res) => {
  try {
    const { days = 14 } = req.query;

    console.log('Received intake-timeline request for days:', days);

    // Calculate date range - LAST N DAYS
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setDate(start.getDate() - parseInt(days));
    start.setHours(0, 0, 0, 0);

    console.log(`Date range: ${start.toISOString()} to ${end.toISOString()}`);

    // FIXED AGGREGATION - Count unique supplement intakes per day
    const intakeTimeline = await SupplementIntake.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user._id),
          wasTaken: true,
          takenAt: {
            $gte: start,
            $lte: end
          }
        }
      },
      {
        // Group by date AND supplement to count unique supplements taken each day
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$takenAt",
                timezone: "UTC"
              }
            },
            userSupplementId: "$userSupplementId"
          },
          firstIntake: { $first: "$$ROOT" }
        }
      },
      {
        // Now group by date only to count unique supplements per day
        $group: {
          _id: "$_id.date",
          count: { $sum: 1 },
          intakes: {
            $push: {
              supplementId: "$firstIntake.userSupplementId",
              takenAt: "$firstIntake.takenAt",
              dosageTaken: "$firstIntake.dosageTaken"
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
          intakes: 1
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    console.log('Aggregation result count:', intakeTimeline.length);
    console.log('Sample aggregated data:', intakeTimeline.slice(0, 3));

    // Create complete timeline for the period
    const completeTimeline = [];
    const currentDate = new Date(start);

    // Create map for existing data
    const intakeMap = {};
    intakeTimeline.forEach(item => {
      intakeMap[item.date] = item;
    });

    // Generate all dates in the range
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const existingData = intakeMap[dateKey];

      // Format for display (M/D)
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();
      const displayDate = `${month}/${day}`;

      completeTimeline.push({
        date: dateKey,
        count: existingData ? existingData.count : 0,
        intakes: existingData ? existingData.intakes : [],
        displayDate: displayDate,
        fullDate: currentDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('Complete timeline length:', completeTimeline.length);
    console.log('Timeline counts:', completeTimeline.map(day => ({
      date: day.date,
      count: day.count
    })));

    res.json({
      success: true,
      timeline: completeTimeline,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        days: parseInt(days)
      }
    });

  } catch (error) {
    console.error('Intake timeline error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
// Get interaction warnings
app.get('/api/interactions', authenticate, async (req, res) => {
  try {
    const warnings = await InteractionWarning.find({
      userId: req.user.id,
      acknowledged: false
    }).populate('supplementsInvolved');

    res.json(warnings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Acknowledge interaction warning
app.put('/api/interactions/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const warning = await InteractionWarning.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { acknowledged: true },
      { new: true }
    );

    if (!warning) {
      return res.status(404).json({ message: 'Warning not found' });
    }

    res.json(warning);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Add health metric routes
app.post('/api/health-metrics', authenticate, async (req, res) => {
  try {
    const { type, customType, value, unit, notes, recordedAt } = req.body;

    const healthMetric = new HealthMetric({
      userId: req.user._id,
      type,
      customType,
      value,
      unit,
      notes,
      recordedAt: recordedAt || new Date()
    });

    await healthMetric.save();
    res.status(201).json(healthMetric);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/health-metrics', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    let query = { userId: req.user._id };

    if (startDate && endDate) {
      query.recordedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (type) {
      query.type = type;
    }

    const metrics = await HealthMetric.find(query).sort({ recordedAt: -1 });
    res.json(metrics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===================
// WATER INTAKE ROUTES
// ===================

// POST /api/water-intake - Log a glass/sip
app.post('/api/water-intake', authenticate, async (req, res) => {
  try {
    const { amount, drinkType } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number (in ml)' });
    }
    const intake = new WaterIntakeLog({
      userId: req.user._id,
      amount,
      drinkType: drinkType || 'water',
      timestamp: new Date()
    });
    await intake.save();
    res.status(201).json(intake);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/water-intake/today - Get today's water intake
app.get('/api/water-intake/today', authenticate, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const entries = await WaterIntakeLog.find({
      userId: req.user._id,
      timestamp: { $gte: todayStart, $lte: todayEnd }
    }).sort({ timestamp: 1 });

    const totalMl = entries.reduce((sum, e) => sum + e.amount, 0);
    res.json({ entries, totalMl, goalMl: 3000 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/water-intake/history - Daily totals for last 30 days
app.get('/api/water-intake/history', authenticate, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyTotals = await WaterIntakeLog.aggregate([
      { $match: { userId: req.user._id, timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          totalMl: { $sum: '$amount' },
          count: { $sum: 1 },
          drinks: { $push: { drinkType: '$drinkType', amount: '$amount' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(dailyTotals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/water-intake/streak - Consecutive days meeting goal
app.get('/api/water-intake/streak', authenticate, async (req, res) => {
  try {
    const goalMl = 3000;
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const dailyTotals = await WaterIntakeLog.aggregate([
      { $match: { userId: req.user._id, timestamp: { $gte: sixtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          totalMl: { $sum: '$amount' }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayData = dailyTotals.find(d => d._id === dateStr);
      if (dayData && dayData.totalMl >= goalMl) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    res.json({ streak, goalMl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===================
// WEIGHT HISTORY ROUTES
// ===================

// GET /api/weight-history - All weight entries
app.get('/api/weight-history', authenticate, async (req, res) => {
  try {
    const weightEntries = await HealthMetric.find({
      userId: req.user._id,
      type: 'Weight'
    }).sort({ recordedAt: 1 });

    const profile = await HealthProfile.findOne({ userId: req.user._id });
    res.json({
      entries: weightEntries,
      currentWeight: profile?.weight || null,
      targetWeight: profile?.targetWeight || null,
      startWeight: weightEntries.length > 0 ? weightEntries[0].value : profile?.weight || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/weight-history/milestones - Weight milestones
app.get('/api/weight-history/milestones', authenticate, async (req, res) => {
  try {
    const entries = await HealthMetric.find({
      userId: req.user._id,
      type: 'Weight'
    }).sort({ recordedAt: 1 });

    const profile = await HealthProfile.findOne({ userId: req.user._id });
    const milestones = [];

    if (entries.length === 0) {
      return res.json({ milestones: [] });
    }

    const startWeight = entries[0].value;
    const lowestWeight = Math.min(...entries.map(e => e.value));
    const highestWeight = Math.max(...entries.map(e => e.value));
    const currentWeight = entries[entries.length - 1].value;
    const totalChange = currentWeight - startWeight;

    milestones.push({ type: 'first_entry', label: 'First Weight Logged', value: startWeight, date: entries[0].recordedAt });

    if (Math.abs(totalChange) >= 1) {
      milestones.push({ type: 'first_kg', label: `First 1kg ${totalChange < 0 ? 'Lost' : 'Gained'}`, value: Math.abs(totalChange).toFixed(1), date: entries[entries.length - 1].recordedAt });
    }
    if (Math.abs(totalChange) >= 5) {
      milestones.push({ type: 'five_kg', label: `5kg ${totalChange < 0 ? 'Lost' : 'Gained'}!`, value: Math.abs(totalChange).toFixed(1), date: entries[entries.length - 1].recordedAt });
    }

    milestones.push({ type: 'lowest', label: 'Lowest Weight', value: lowestWeight, date: entries.find(e => e.value === lowestWeight)?.recordedAt });

    if (entries.length >= 7) {
      // Calculate weekly trend
      const recent7 = entries.slice(-7);
      const avgRecent = recent7.reduce((s, e) => s + e.value, 0) / recent7.length;
      const weeklyChange = (avgRecent - entries.slice(-14, -7).reduce((s, e) => s + e.value, 0) / Math.max(entries.slice(-14, -7).length, 1));
      milestones.push({ type: 'trend', label: 'Weekly Trend', value: `${weeklyChange > 0 ? '+' : ''}${weeklyChange.toFixed(2)} kg/week` });
    }

    res.json({ milestones, summary: { startWeight, currentWeight, lowestWeight, highestWeight, totalChange: totalChange.toFixed(1), totalEntries: entries.length } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/weight-history/can-log - Check if user can log weight (7-day gate)
app.get('/api/weight-history/can-log', authenticate, async (req, res) => {
  try {
    const lastEntry = await HealthMetric.findOne({
      userId: req.user._id,
      type: 'Weight'
    }).sort({ recordedAt: -1 });

    if (!lastEntry) {
      return res.json({ canLog: true, lastLoggedAt: null, nextLogAt: null });
    }

    const lastDate = new Date(lastEntry.recordedAt);
    const nextLogDate = new Date(lastDate);
    nextLogDate.setDate(nextLogDate.getDate() + 7);
    const canLog = new Date() >= nextLogDate;

    res.json({
      canLog,
      lastLoggedAt: lastEntry.recordedAt,
      nextLogAt: nextLogDate,
      lastValue: lastEntry.value
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===================
// SMART REMINDER ROUTES
// ===================

// GET /api/check-reminders - Returns which reminders to show
app.get('/api/check-reminders', authenticate, async (req, res) => {
  try {
    const reminders = [];
    const now = new Date();

    // Check weight - every 7 days
    const lastWeight = await HealthMetric.findOne({ userId: req.user._id, type: 'Weight' }).sort({ recordedAt: -1 });
    const lastWeightDismissal = await ReminderDismissal.findOne({ userId: req.user._id, reminderType: 'weight' }).sort({ dismissedAt: -1 });
    const weightDaysSince = lastWeight ? Math.floor((now - new Date(lastWeight.recordedAt)) / (1000 * 60 * 60 * 24)) : 999;
    const weightDismissedToday = lastWeightDismissal && (now - new Date(lastWeightDismissal.dismissedAt)) < 24 * 60 * 60 * 1000;
    if (weightDaysSince >= 7 && !weightDismissedToday) {
      reminders.push({ type: 'weight', priority: 1, message: `It's been ${weightDaysSince} days! Time to check your weight ðŸŽ¯`, daysSince: weightDaysSince, icon: 'scale' });
    }

    // Check water - daily (if not logged today)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayWater = await WaterIntakeLog.findOne({ userId: req.user._id, timestamp: { $gte: todayStart } });
    const waterDismissedToday = await ReminderDismissal.findOne({ userId: req.user._id, reminderType: 'water', dismissedAt: { $gte: todayStart } });
    if (!todayWater && !waterDismissedToday) {
      reminders.push({ type: 'water', priority: 2, message: "You haven't logged any water today! ðŸ’§", icon: 'droplet' });
    }

    // Check sleep - every 3 days
    const lastSleep = await HealthMetric.findOne({ userId: req.user._id, type: 'Sleep' }).sort({ recordedAt: -1 });
    const sleepDaysSince = lastSleep ? Math.floor((now - new Date(lastSleep.recordedAt)) / (1000 * 60 * 60 * 24)) : 999;
    const sleepDismissedToday = await ReminderDismissal.findOne({ userId: req.user._id, reminderType: 'sleep', dismissedAt: { $gte: todayStart } });
    if (sleepDaysSince >= 3 && !sleepDismissedToday) {
      reminders.push({ type: 'sleep', priority: 3, message: `How's your sleep? Last logged ${sleepDaysSince} days ago ðŸŒ™`, daysSince: sleepDaysSince, icon: 'moon' });
    }

    // Check mood - daily
    const lastMood = await HealthMetric.findOne({ userId: req.user._id, type: 'Mood' }).sort({ recordedAt: -1 });
    const moodLoggedToday = lastMood && new Date(lastMood.recordedAt) >= todayStart;
    const moodDismissedToday = await ReminderDismissal.findOne({ userId: req.user._id, reminderType: 'mood', dismissedAt: { $gte: todayStart } });
    if (!moodLoggedToday && !moodDismissedToday) {
      reminders.push({ type: 'mood', priority: 4, message: "How are you feeling today? ðŸ˜Š", icon: 'smile' });
    }

    // Sort by priority
    reminders.sort((a, b) => a.priority - b.priority);
    res.json(reminders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/dismiss-reminder - Dismiss a reminder
app.post('/api/dismiss-reminder', authenticate, async (req, res) => {
  try {
    const { reminderType } = req.body;
    if (!reminderType) {
      return res.status(400).json({ message: 'reminderType is required' });
    }
    const dismissal = new ReminderDismissal({
      userId: req.user._id,
      reminderType,
      dismissedAt: new Date()
    });
    await dismissal.save();
    res.json({ message: 'Reminder dismissed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

const validateSupplement = [
  body('name').not().isEmpty().trim(),
  body('type').isIn(['Vitamin', 'Mineral', 'Herbal', 'Amino Acid', 'Enzyme', 'Probiotic', 'Other']),
  body('dosageUnit').not().isEmpty(),
  body('servingSize').isNumeric()
];
// Add custom supplement to database
app.post('/api/custom-supplement', authenticate, validateSupplement, async (req, res) => {
  try {
    const {
      name,
      brand,
      type,
      dosageUnit,
      servingSize,
      ingredients,
      description,
      potentialBenefits,
      potentialSideEffects,
      interactions
    } = req.body;

    const supplement = new Supplement({
      name,
      brand,
      type,
      dosageUnit,
      servingSize,
      ingredients,
      description,
      potentialBenefits,
      potentialSideEffects,
      interactions
    });

    await supplement.save();
    res.status(201).json(supplement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Helper function to check for interactions
async function checkInteractions(userId, newSupplementId) {
  try {
    // Get all active supplements for user
    const userSupplements = await UserSupplement.find({
      userId,
      status: 'Active'
    }).populate('supplementId');

    const newSupplement = await UserSupplement.findById(newSupplementId)
      .populate('supplementId');

    if (!newSupplement) return;

    const newSupplementName = newSupplement.customSupplement?.name ||
      newSupplement.supplementId?.name;

    // Check each existing supplement against the new one
    for (const existingSupp of userSupplements) {
      if (existingSupp._id.toString() === newSupplementId.toString()) continue;

      const existingSuppName = existingSupp.customSupplement?.name ||
        existingSupp.supplementId?.name;

      // In a real implementation, you would query a drug interaction database API
      // For this example, we'll simulate finding interactions
      const interaction = await findInteractionInDatabase(
        newSupplementName,
        existingSuppName
      );

      if (interaction) {
        // Create interaction warning
        const warning = new InteractionWarning({
          userId,
          supplementsInvolved: [newSupplementId, existingSupp._id],
          severity: interaction.severity,
          description: `Interaction between ${newSupplementName} and ${existingSuppName}: ${interaction.description}`,
          recommendation: interaction.recommendation
        });

        await warning.save();
      }
    }
  } catch (error) {
    console.error('Error checking interactions:', error);
  }
}

// Helper function to simulate interaction database lookup
async function findInteractionInDatabase(supplement1, supplement2) {
  // This would typically query an external API or comprehensive database
  // For demonstration, we'll return a simulated interaction for certain combinations

  const interactionMap = {
    'Vitamin K-Warfarin': {
      severity: 'Severe',
      description: 'Vitamin K can decrease the effectiveness of Warfarin',
      recommendation: 'Monitor INR closely and consult your doctor'
    },
    'Calcium-Iron': {
      severity: 'Moderate',
      description: 'Calcium can interfere with iron absorption',
      recommendation: 'Take these supplements at least 2 hours apart'
    },
    'St. John\'s Wort-Birth Control': {
      severity: 'Severe',
      description: 'St. John\'s Wort may decrease the effectiveness of birth control pills',
      recommendation: 'Use alternative contraception methods and consult your doctor'
    }
  };

  const key1 = `${supplement1}-${supplement2}`;
  const key2 = `${supplement2}-${supplement1}`;

  return interactionMap[key1] || interactionMap[key2] || null;
}

// Helper function to calculate expected intakes
function calculateExpectedIntakes(supplement, startDate, endDate) {
  const expectedIntakes = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const times = supplement.specificTimes || getDefaultTimes(supplement.frequency);

    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);
      const intakeTime = new Date(currentDate);
      intakeTime.setHours(hours, minutes, 0, 0);

      if (intakeTime >= startDate && intakeTime <= endDate) {
        expectedIntakes.push(intakeTime);
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return expectedIntakes;
}

// Helper function to get default times based on frequency
function getDefaultTimes(frequency) {
  switch (frequency) {
    case 'Once Daily':
      return ['08:00'];
    case 'Twice Daily':
      return ['08:00', '20:00'];
    case 'Three Times Daily':
      return ['08:00', '12:00', '20:00'];
    default:
      return ['08:00'];
  }
}

// Helper function to calculate daily cost
function calculateDailyCost(price, quantity, dosage, frequency) {
  const dosesPerDay = getDosesPerDay(frequency);
  const servingsPerPackage = quantity / dosage;
  const daysPerPackage = servingsPerPackage / dosesPerDay;

  return price / daysPerPackage;
}

// Helper function to get doses per day based on frequency
function getDosesPerDay(frequency) {
  switch (frequency) {
    case 'Once Daily': return 1;
    case 'Twice Daily': return 2;
    case 'Three Times Daily': return 3;
    case 'As Needed': return 1; // Default to 1 for calculation
    default: return 1;
  }
}
// ===================
// SESSION & CONTEXT ROUTES (LifePulse)
// ===================

// POST /api/sessions/checkin â€” log a session when user opens dashboard
app.post('/api/sessions/checkin', authenticate, async (req, res) => {
  try {
    const session = new UserSession({ userId: req.user._id, loginTimestamp: new Date(), device: req.body.device || 'web' });
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/sessions/context â€” returns contextual data for LifePulse
app.get('/api/sessions/context', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const hour = now.getHours();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    // Last session (excluding current)
    const lastSession = await UserSession.findOne({ userId: req.user._id }).sort({ loginTimestamp: -1 }).skip(1);
    const hoursSinceLastVisit = lastSession ? Math.round((now - new Date(lastSession.loginTimestamp)) / (1000 * 60 * 60)) : null;

    // Today's meals
    const todayMeals = await MealLog.find({ userId: req.user._id, loggedAt: { $gte: todayStart } });
    const mealsLogged = {};
    todayMeals.forEach(m => { mealsLogged[m.mealType] = { skipped: m.skipped, loggedAt: m.loggedAt }; });

    // Determine greeting type and expected meal
    let greetingType, expectedMeal, greetingEmoji, mealQuestion;
    if (hour >= 5 && hour < 11) {
      greetingType = 'morning';
      greetingEmoji = 'â˜€ï¸';
      expectedMeal = 'breakfast';
      mealQuestion = 'Had your breakfast yet?';
    } else if (hour >= 11 && hour < 14) {
      greetingType = 'midday';
      greetingEmoji = 'ðŸ½ï¸';
      expectedMeal = 'lunch';
      mealQuestion = 'Lunch time! Did you eat?';
    } else if (hour >= 14 && hour < 17) {
      greetingType = 'afternoon';
      greetingEmoji = 'â˜•';
      expectedMeal = null;
      mealQuestion = 'Staying hydrated this afternoon?';
    } else if (hour >= 17 && hour < 21) {
      greetingType = 'evening';
      greetingEmoji = 'ðŸŒ†';
      expectedMeal = 'dinner';
      mealQuestion = 'Had your dinner?';
    } else {
      greetingType = 'night';
      greetingEmoji = 'ðŸŒ™';
      expectedMeal = null;
      mealQuestion = 'Time to wind down and rest!';
    }

    // Water status today
    const todayWater = await WaterIntakeLog.find({ userId: req.user._id, timestamp: { $gte: todayStart } });
    const waterTotalMl = todayWater.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      greetingType,
      greetingEmoji,
      expectedMeal,
      mealQuestion,
      mealAlreadyLogged: expectedMeal ? !!mealsLogged[expectedMeal] : true,
      mealsLogged,
      hoursSinceLastVisit,
      waterTotalMl,
      currentHour: hour
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/meals/log â€” quick-log a meal
app.post('/api/meals/log', authenticate, async (req, res) => {
  try {
    const { mealType, skipped } = req.body;
    if (!mealType) return res.status(400).json({ message: 'mealType is required' });
    const meal = new MealLog({ userId: req.user._id, mealType, skipped: skipped || false });
    await meal.save();
    res.status(201).json(meal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/meals/today â€” today's meal status
app.get('/api/meals/today', authenticate, async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const meals = await MealLog.find({ userId: req.user._id, loggedAt: { $gte: todayStart } });
    const status = {};
    meals.forEach(m => { status[m.mealType] = { skipped: m.skipped, loggedAt: m.loggedAt }; });
    res.json(status);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===================
// HYDRATION PROFILE ROUTES
// ===================

// PUT /api/hydration-profile â€” save/update hydration preferences
app.put('/api/hydration-profile', authenticate, async (req, res) => {
  try {
    const { bottleSizeMl, dailyGoalMl, reminderIntervalMin, wakeTime, sleepTime } = req.body;
    const profile = await HydrationProfile.findOneAndUpdate(
      { userId: req.user._id },
      { bottleSizeMl, dailyGoalMl, reminderIntervalMin, wakeTime, sleepTime, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/hydration-profile â€” get hydration settings
app.get('/api/hydration-profile', authenticate, async (req, res) => {
  try {
    let profile = await HydrationProfile.findOne({ userId: req.user._id });
    if (!profile) {
      // Calculate default goal from health profile weight (35ml per kg)
      const hp = await HealthProfile.findOne({ userId: req.user._id });
      const defaultGoal = hp?.weight ? Math.round(hp.weight * 35) : 3000;
      profile = { bottleSizeMl: 500, dailyGoalMl: defaultGoal, reminderIntervalMin: 45, wakeTime: '07:00', sleepTime: '23:00', isDefault: true };
    }
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/water-intake/smart-schedule â€” research-backed next drink time + tips
app.get('/api/water-intake/smart-schedule', authenticate, async (req, res) => {
  try {
    const profile = await HydrationProfile.findOne({ userId: req.user._id });
    const interval = profile?.reminderIntervalMin || 45;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    // Find last water intake today
    const lastIntake = await WaterIntakeLog.findOne({ userId: req.user._id, timestamp: { $gte: todayStart } }).sort({ timestamp: -1 });
    const now = new Date();
    let nextDrinkAt = null;
    let minutesUntilNext = 0;
    if (lastIntake) {
      nextDrinkAt = new Date(lastIntake.timestamp.getTime() + interval * 60 * 1000);
      minutesUntilNext = Math.max(0, Math.round((nextDrinkAt - now) / (1000 * 60)));
    } else {
      minutesUntilNext = 0; // drink now!
      nextDrinkAt = now;
    }

    // Today's total
    const todayEntries = await WaterIntakeLog.find({ userId: req.user._id, timestamp: { $gte: todayStart } });
    const totalMl = todayEntries.reduce((sum, e) => sum + e.amount, 0);
    const goalMl = profile?.dailyGoalMl || 3000;

    // Hydration science tips (rotated)
    const tips = [
      { fact: 'Drink water every 45-60 minutes for optimal hydration.', source: 'Mayo Clinic' },
      { fact: 'Your body is about 60% water. Even mild dehydration affects focus and energy.', source: 'Harvard Health' },
      { fact: 'The recommended daily intake is ~35ml per kg of body weight.', source: 'European Food Safety Authority' },
      { fact: 'Pale straw-colored urine indicates good hydration. Dark yellow means drink more!', source: 'NHS UK' },
      { fact: 'Drinking water before meals can aid digestion and reduce overeating.', source: 'NIH' },
      { fact: 'Sip regularly throughout the day instead of gulping large amounts at once.', source: 'Cleveland Clinic' },
      { fact: 'Hot weather and exercise significantly increase your water needs.', source: 'WHO' },
      { fact: 'About 20% of daily water intake comes from food, especially fruits and vegetables.', source: 'National Academies of Sciences' }
    ];
    const todayTipIndex = Math.floor(Date.now() / (1000 * 60 * 60)) % tips.length; // rotate hourly

    res.json({
      nextDrinkAt,
      minutesUntilNext,
      intervalMin: interval,
      totalMl,
      goalMl,
      bottleSizeMl: profile?.bottleSizeMl || 500,
      bottlesFinished: Math.floor(totalMl / (profile?.bottleSizeMl || 500)),
      currentBottlePercent: Math.round((totalMl % (profile?.bottleSizeMl || 500)) / (profile?.bottleSizeMl || 500) * 100),
      tip: tips[todayTipIndex]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===================
// LIFE METRICS ANALYTICS ROUTES
// ===================

// GET /api/health-metrics/sleep-summary â€” weekly sleep stats
app.get('/api/health-metrics/sleep-summary', authenticate, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sleepEntries = await HealthMetric.find({
      userId: req.user._id,
      type: 'Sleep',
      recordedAt: { $gte: sevenDaysAgo }
    }).sort({ recordedAt: -1 });

    const avgHours = sleepEntries.length > 0 ? sleepEntries.reduce((s, e) => s + e.value, 0) / sleepEntries.length : 0;
    const avgQuality = sleepEntries.filter(e => e.sleepData?.quality).length > 0
      ? sleepEntries.filter(e => e.sleepData?.quality).reduce((s, e) => s + e.sleepData.quality, 0) / sleepEntries.filter(e => e.sleepData?.quality).length
      : 0;

    res.json({
      entries: sleepEntries,
      avgHours: Math.round(avgHours * 10) / 10,
      avgQuality: Math.round(avgQuality * 10) / 10,
      totalEntries: sleepEntries.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/health-metrics/energy-pattern â€” energy across time of day
app.get('/api/health-metrics/energy-pattern', authenticate, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const energyEntries = await HealthMetric.find({
      userId: req.user._id,
      type: 'Energy',
      recordedAt: { $gte: thirtyDaysAgo }
    }).sort({ recordedAt: -1 });

    // Group by time of day
    const pattern = { morning: [], afternoon: [], evening: [] };
    energyEntries.forEach(e => {
      const tod = e.energyData?.timeOfDay;
      if (tod && pattern[tod]) pattern[tod].push(e.value);
    });

    const avg = (arr) => arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;

    res.json({
      entries: energyEntries.slice(0, 21), // last 21 entries
      pattern: {
        morning: { avg: avg(pattern.morning), count: pattern.morning.length },
        afternoon: { avg: avg(pattern.afternoon), count: pattern.afternoon.length },
        evening: { avg: avg(pattern.evening), count: pattern.evening.length }
      },
      peakTime: [['morning', avg(pattern.morning) || 0], ['afternoon', avg(pattern.afternoon) || 0], ['evening', avg(pattern.evening) || 0]]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/health-metrics/mood-calendar â€” 30-day mood heatmap
app.get('/api/health-metrics/mood-calendar', authenticate, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const moodEntries = await HealthMetric.find({
      userId: req.user._id,
      type: 'Mood',
      recordedAt: { $gte: thirtyDaysAgo }
    }).sort({ recordedAt: 1 });

    // Build calendar map
    const calendar = {};
    moodEntries.forEach(e => {
      const dateKey = new Date(e.recordedAt).toISOString().split('T')[0];
      calendar[dateKey] = {
        value: e.value,
        emoji: e.moodData?.emoji || '',
        journal: e.moodData?.journal || '',
        recordedAt: e.recordedAt
      };
    });

    res.json({
      calendar,
      totalEntries: moodEntries.length,
      avgMood: moodEntries.length > 0 ? Math.round((moodEntries.reduce((s, e) => s + e.value, 0) / moodEntries.length) * 10) / 10 : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

require('./index')(app, mongoose, authenticate);
require('./medical')(app, mongoose, authenticate);
require('./aiRoutes')(app, mongoose, authenticate, HealthProfile, HealthMetric, UserSupplement, Supplement, WaterIntakeLog, Group);
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 

// minor tweak for clarity
