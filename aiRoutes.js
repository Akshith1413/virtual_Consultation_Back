/**
 * AI Routes — All AI-powered healthcare API endpoints
 * Mounted at /api/ai/*
 */

const aiEngine = require('./aiEngine');
const medicalKB = require('./medicalKnowledge');

module.exports = (app, mongoose, authenticate, HealthProfile, HealthMetric, UserSupplement, Supplement, WaterIntakeLog, Group) => {

  // ─── AI CHAT HISTORY SCHEMA ─────────────────────────────────────
  const AIChatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messages: [{
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      metadata: {
        entities: { type: mongoose.Schema.Types.Mixed },
        sentiment: { type: mongoose.Schema.Types.Mixed }
      }
    }],
    sessionStarted: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now }
  });
  AIChatSchema.index({ userId: 1, lastActivity: -1 });
  const AIChat = mongoose.model('AIChat', AIChatSchema);

  // ─── HEALTH ANALYSIS CACHE SCHEMA ──────────────────────────────
  const HealthAnalysisSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['risk', 'insights', 'nutrition', 'mood'], required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    generatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 6 * 60 * 60 * 1000) } // 6 hour cache
  });
  HealthAnalysisSchema.index({ userId: 1, type: 1, expiresAt: 1 });
  const HealthAnalysis = mongoose.model('HealthAnalysis', HealthAnalysisSchema);

  // ═══════════════════════════════════════════════════════════════
  // 1. AI HEALTH CHAT ASSISTANT
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/ai/chat', authenticate, async (req, res) => {
    try {
      const { message, sessionId } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Message is required' });
      }

      // Get user's health profile for context
      const healthProfile = await HealthProfile.findOne({ userId: req.user._id });

      // Generate AI response
      const context = { healthProfile: healthProfile || {} };
      const aiResponse = await aiEngine.generateHealthResponse(context, message);

      // Extract entities from user message for metadata
      const entities = await aiEngine.extractMedicalEntities(message);

      // Save to chat history
      let chatSession;
      if (sessionId) {
        chatSession = await AIChat.findById(sessionId);
      }
      if (!chatSession) {
        chatSession = new AIChat({ userId: req.user._id, messages: [] });
      }

      chatSession.messages.push({
        role: 'user',
        content: message,
        metadata: { entities }
      });
      chatSession.messages.push({
        role: 'assistant',
        content: aiResponse,
        metadata: {}
      });
      chatSession.lastActivity = new Date();
      await chatSession.save();

      // Add disclaimer
      const disclaimer = '\n\n---\n⚠️ *AI-generated health information. Not a substitute for professional medical advice.*';

      res.json({
        success: true,
        response: aiResponse + disclaimer,
        sessionId: chatSession._id,
        entities,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('AI Chat error:', err);
      res.status(500).json({ success: false, message: 'AI service temporarily unavailable. Please try again.' });
    }
  });

  // Get chat history
  app.get('/api/ai/chat/history', authenticate, async (req, res) => {
    try {
      const { sessionId } = req.query;
      let query = { userId: req.user._id };
      if (sessionId) query._id = sessionId;

      const sessions = await AIChat.find(query)
        .sort({ lastActivity: -1 })
        .limit(10);

      res.json({ success: true, sessions });
    } catch (err) {
      console.error('Chat history error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Clear chat history
  app.delete('/api/ai/chat/history', authenticate, async (req, res) => {
    try {
      await AIChat.deleteMany({ userId: req.user._id });
      res.json({ success: true, message: 'Chat history cleared' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. SYMPTOM CHECKER + MEDICAL NER
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/ai/symptom-check', authenticate, async (req, res) => {
    try {
      const { symptoms: symptomText } = req.body;
      if (!symptomText || !symptomText.trim()) {
        return res.status(400).json({ success: false, message: 'Symptom description is required' });
      }

      // Extract medical entities
      const entities = await aiEngine.extractMedicalEntities(symptomText);

      // Use extracted symptoms + fallback
      const allSymptoms = [
        ...entities.symptoms,
        ...aiEngine.extractEntitiesFallback(symptomText).symptoms
      ];
      const uniqueSymptoms = [...new Set(allSymptoms)];

      // Match to conditions
      const conditions = medicalKB.matchSymptoms(uniqueSymptoms);

      // Route to specialty
      const recommendedSpecialty = medicalKB.routeToSpecialty(uniqueSymptoms);

      // Determine overall urgency
      let overallUrgency = 'low';
      if (conditions.length > 0) {
        const urgencyOrder = ['low', 'medium', 'high', 'emergency'];
        overallUrgency = conditions.reduce((max, c) => {
          return urgencyOrder.indexOf(c.urgency) > urgencyOrder.indexOf(max) ? c.urgency : max;
        }, 'low');
      }

      res.json({
        success: true,
        extractedEntities: {
          symptoms: uniqueSymptoms,
          diseases: entities.diseases || [],
          medications: entities.medications || [],
          anatomy: entities.anatomy || []
        },
        possibleConditions: conditions,
        recommendedSpecialty,
        urgency: {
          level: overallUrgency,
          ...medicalKB.URGENCY_LEVELS[overallUrgency]
        },
        disclaimer: 'This AI analysis is for informational purposes only. It does not constitute medical advice. Please consult a healthcare professional for proper diagnosis and treatment.',
        analyzedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Symptom check error:', err);
      res.status(500).json({ success: false, message: 'Analysis service temporarily unavailable' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. HEALTH RISK PREDICTOR
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/ai/health-risk', authenticate, async (req, res) => {
    try {
      // Check cache first
      const cached = await HealthAnalysis.findOne({
        userId: req.user._id,
        type: 'risk',
        expiresAt: { $gt: new Date() }
      });
      if (cached) {
        return res.json({ success: true, ...cached.result, cached: true });
      }

      // Get health profile and recent metrics
      const healthProfile = await HealthProfile.findOne({ userId: req.user._id });
      if (!healthProfile) {
        return res.status(404).json({
          success: false,
          message: 'Please create a health profile first to get AI risk assessment'
        });
      }

      const recentMetrics = await HealthMetric.find({
        userId: req.user._id,
        recordedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).sort({ recordedAt: -1 });

      // Calculate risk
      const riskAssessment = aiEngine.calculateHealthRisk(healthProfile, recentMetrics);

      // Generate recommendations
      const recommendations = [];
      Object.entries(riskAssessment.categories).forEach(([key, risk]) => {
        if (risk.level === 'high' || risk.level === 'critical') {
          recommendations.push({
            area: risk.label,
            level: risk.level,
            message: `Your ${risk.label.toLowerCase()} risk is ${risk.level}. ${risk.factors.join('. ')}. Consider consulting a specialist.`
          });
        } else if (risk.level === 'moderate') {
          recommendations.push({
            area: risk.label,
            level: risk.level,
            message: `Your ${risk.label.toLowerCase()} risk is moderate. ${risk.factors.join('. ')}. Preventive measures recommended.`
          });
        }
      });

      const result = {
        ...riskAssessment,
        recommendations,
        disclaimer: 'Risk scores are algorithmic estimates based on your health data and WHO guidelines. They are not clinical diagnoses.'
      };

      // Cache result
      await HealthAnalysis.findOneAndUpdate(
        { userId: req.user._id, type: 'risk' },
        { result, generatedAt: new Date(), expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) },
        { upsert: true }
      );

      res.json({ success: true, ...result, cached: false });
    } catch (err) {
      console.error('Health risk error:', err);
      res.status(500).json({ success: false, message: 'Risk assessment service error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. SMART SUPPLEMENT INTERACTIONS
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/ai/supplement-interactions', authenticate, async (req, res) => {
    try {
      const { supplement1, supplement2 } = req.body;

      if (supplement1 && supplement2) {
        // Check specific pair
        const interactions = medicalKB.findInteractions(supplement1, supplement2);
        return res.json({
          success: true,
          pair: [supplement1, supplement2],
          interactions,
          hasInteraction: interactions.length > 0,
          disclaimer: 'Always consult your pharmacist or doctor about supplement interactions.'
        });
      }

      // Check all user's supplements against each other
      const userSupplements = await UserSupplement.find({
        userId: req.user._id,
        status: 'Active'
      }).populate('supplementId');

      const allInteractions = [];

      for (let i = 0; i < userSupplements.length; i++) {
        for (let j = i + 1; j < userSupplements.length; j++) {
          const name1 = userSupplements[i].customSupplement?.name || userSupplements[i].supplementId?.name || '';
          const name2 = userSupplements[j].customSupplement?.name || userSupplements[j].supplementId?.name || '';

          if (name1 && name2) {
            const interactions = medicalKB.findInteractions(name1, name2);
            if (interactions.length > 0) {
              allInteractions.push({
                supplements: [name1, name2],
                interactions
              });
            }
          }
        }
      }

      // Also check against medications from health profile
      const healthProfile = await HealthProfile.findOne({ userId: req.user._id });
      if (healthProfile?.medications?.length > 0) {
        for (const supp of userSupplements) {
          const suppName = supp.customSupplement?.name || supp.supplementId?.name || '';
          for (const med of healthProfile.medications) {
            if (suppName && med.name) {
              const interactions = medicalKB.findInteractions(suppName, med.name);
              if (interactions.length > 0) {
                allInteractions.push({
                  supplements: [suppName, `${med.name} (medication)`],
                  interactions
                });
              }
            }
          }
        }
      }

      res.json({
        success: true,
        totalSupplements: userSupplements.length,
        interactionsFound: allInteractions.length,
        interactions: allInteractions,
        disclaimer: 'This is an AI-powered screening tool. Always verify interactions with your pharmacist or healthcare provider.'
      });
    } catch (err) {
      console.error('Supplement interaction error:', err);
      res.status(500).json({ success: false, message: 'Interaction check service error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. AI NUTRITION ANALYZER
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/ai/analyze-nutrition', authenticate, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, message: 'Food description is required' });
      }

      const analysis = await aiEngine.analyzeNutritionText(text);

      // Get user's daily goals
      const healthProfile = await HealthProfile.findOne({ userId: req.user._id });
      const dailyTarget = healthProfile?.dailyCalorieTarget || 2000;

      res.json({
        success: true,
        inputText: text,
        foods: analysis.detectedFoods,
        totalNutrition: analysis.estimatedNutrition,
        percentOfDailyTarget: {
          calories: Math.round((analysis.estimatedNutrition.calories / dailyTarget) * 100)
        },
        suggestions: analysis.suggestions,
        disclaimer: 'Nutrition estimates are approximate. Use a food scale for precise tracking.',
        analyzedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Nutrition analysis error:', err);
      res.status(500).json({ success: false, message: 'Nutrition analysis service error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. MENTAL HEALTH MOOD ANALYZER
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/ai/mood-analysis', authenticate, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, message: 'Journal entry text is required' });
      }

      // Analyze sentiment
      const sentiment = await aiEngine.analyzeSentiment(text);

      // Get historical mood data
      const recentMoods = await HealthMetric.find({
        userId: req.user._id,
        type: 'Mood'
      }).sort({ recordedAt: -1 }).limit(14);

      // Mood pattern analysis
      let moodTrend = 'stable';
      if (recentMoods.length >= 5) {
        const recentAvg = recentMoods.slice(0, 3).reduce((s, m) => s + m.value, 0) / Math.min(3, recentMoods.length);
        const olderAvg = recentMoods.slice(-3).reduce((s, m) => s + m.value, 0) / Math.min(3, recentMoods.length);
        if (recentAvg - olderAvg > 0.5) moodTrend = 'improving';
        else if (recentAvg - olderAvg < -0.5) moodTrend = 'declining';
      }

      // Generate supportive response
      let supportMessage = '';
      if (sentiment.dominant === 'negative' && sentiment.confidence > 60) {
        supportMessage = '💙 It sounds like you\'re going through a tough time. Remember, it\'s okay to feel this way. Consider talking to someone you trust, getting some exercise, or practicing mindfulness. If feelings persist, a mental health professional can help.';
      } else if (sentiment.dominant === 'positive') {
        supportMessage = '🌟 Great to see positive vibes! Keep doing what brings you joy. Maintaining these positive patterns supports your overall health.';
      } else {
        supportMessage = '😊 It\'s a balanced day. Remember to check in with yourself regularly and do something that brings you peace today.';
      }

      res.json({
        success: true,
        sentiment,
        moodTrend,
        recentMoodAverage: recentMoods.length > 0
          ? Math.round((recentMoods.reduce((s, m) => s + m.value, 0) / recentMoods.length) * 10) / 10
          : null,
        supportMessage,
        suggestions: [
          sentiment.dominant === 'negative' ? 'Consider a short walk or exercise session' : null,
          sentiment.dominant === 'negative' ? 'Try the 4-7-8 breathing technique' : null,
          moodTrend === 'declining' ? 'Your mood trend is declining — consider talking to a counselor' : null,
          'Keep journaling — it\'s scientifically proven to improve mental health',
          'Track your mood daily for better insights'
        ].filter(Boolean),
        disclaimer: 'AI sentiment analysis is approximate. For mental health concerns, please consult a qualified professional.',
        analyzedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Mood analysis error:', err);
      res.status(500).json({ success: false, message: 'Mood analysis service error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. AI HEALTH INSIGHTS ENGINE
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/ai/health-insights', authenticate, async (req, res) => {
    try {
      // Check cache
      const cached = await HealthAnalysis.findOne({
        userId: req.user._id,
        type: 'insights',
        expiresAt: { $gt: new Date() }
      });
      if (cached) {
        return res.json({ success: true, ...cached.result, cached: true });
      }

      // Get all health data
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      const [metrics, waterData, healthProfile] = await Promise.all([
        HealthMetric.find({ userId: req.user._id, recordedAt: { $gte: thirtyDaysAgo } }).sort({ recordedAt: -1 }),
        WaterIntakeLog.find({ userId: req.user._id, timestamp: { $gte: thirtyDaysAgo } }),
        HealthProfile.findOne({ userId: req.user._id })
      ]);

      // Generate correlations and insights
      const result = aiEngine.correlateHealthData(metrics, waterData);

      // Add profile-based insights
      if (healthProfile) {
        const bmiCategory = medicalKB.getBMICategory(healthProfile.bmi);
        result.insights.unshift({
          type: 'bmi',
          icon: '⚖️',
          title: 'BMI Status',
          description: `Your BMI is **${healthProfile.bmi}** (${bmiCategory.label}).`,
          recommendation: bmiCategory.risks[0],
          confidence: 100,
          metrics: ['Weight']
        });
      }

      result.disclaimer = 'AI-generated insights based on your tracked data. Consult healthcare professionals for clinical guidance.';

      // Cache
      await HealthAnalysis.findOneAndUpdate(
        { userId: req.user._id, type: 'insights' },
        { result, generatedAt: new Date(), expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000) },
        { upsert: true }
      );

      res.json({ success: true, ...result, cached: false });
    } catch (err) {
      console.error('Health insights error:', err);
      res.status(500).json({ success: false, message: 'Insights service error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. SMART APPOINTMENT PRE-SCREENING
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/ai/appointment-prescreen', authenticate, async (req, res) => {
    try {
      const { concern } = req.body;
      if (!concern || !concern.trim()) {
        return res.status(400).json({ success: false, message: 'Please describe your health concern' });
      }

      // Extract entities
      const entities = await aiEngine.extractMedicalEntities(concern);
      const fallbackEntities = aiEngine.extractEntitiesFallback(concern);
      const allSymptoms = [...new Set([...entities.symptoms, ...fallbackEntities.symptoms])];

      // Match conditions
      const conditions = medicalKB.matchSymptoms(allSymptoms);

      // Route to specialty
      const specialty = medicalKB.routeToSpecialty(allSymptoms);

      // Determine urgency
      let urgency = 'low';
      if (conditions.length > 0) {
        const urgencyOrder = ['low', 'medium', 'high', 'emergency'];
        urgency = conditions.reduce((max, c) => {
          return urgencyOrder.indexOf(c.urgency) > urgencyOrder.indexOf(max) ? c.urgency : max;
        }, 'low');
      }

      // Generate pre-visit tips
      const tips = [
        'Bring a list of all current medications and supplements',
        'Note when symptoms started and any triggers',
        'Prepare questions you want to ask the doctor',
        'Bring your insurance information and ID'
      ];
      if (urgency === 'emergency') {
        tips.unshift('⚠️ Based on your symptoms, consider seeking immediate medical attention');
      }

      res.json({
        success: true,
        detectedSymptoms: allSymptoms,
        possibleConditions: conditions.slice(0, 3),
        recommendedSpecialty: specialty,
        urgency: {
          level: urgency,
          ...medicalKB.URGENCY_LEVELS[urgency]
        },
        preVisitTips: tips,
        suggestedAppointmentType: urgency === 'emergency' ? 'Emergency' :
          urgency === 'high' ? 'Consultation' : 'Regular Checkup',
        disclaimer: 'AI pre-screening is for preparation purposes only. It is not a diagnosis.'
      });
    } catch (err) {
      console.error('Pre-screening error:', err);
      res.status(500).json({ success: false, message: 'Pre-screening service error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. AI BODY INSIGHTS (per organ)
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/ai/body-insights/:organ', authenticate, async (req, res) => {
    try {
      const { organ } = req.params;
      const healthProfile = await HealthProfile.findOne({ userId: req.user._id });

      if (!healthProfile) {
        return res.status(404).json({
          success: false,
          message: 'Please create a health profile first for personalized organ insights'
        });
      }

      const organRisk = medicalKB.calculateOrganRisk(organ, healthProfile);
      if (!organRisk) {
        return res.status(404).json({
          success: false,
          message: `Organ "${organ}" not found. Available: ${Object.keys(medicalKB.ORGAN_RISK_FACTORS).join(', ')}`
        });
      }

      // Get relevant metrics
      const recentMetrics = await HealthMetric.find({
        userId: req.user._id,
        type: { $in: organRisk.relatedMetrics },
        recordedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).sort({ recordedAt: -1 }).limit(10);

      res.json({
        success: true,
        ...organRisk,
        recentMetrics: recentMetrics.map(m => ({
          type: m.type,
          value: m.value,
          date: m.recordedAt
        })),
        disclaimer: 'Organ risk assessments are algorithmic estimates, not clinical evaluations. Consult a specialist for comprehensive assessment.'
      });
    } catch (err) {
      console.error('Body insights error:', err);
      res.status(500).json({ success: false, message: 'Body insights service error' });
    }
  });

  // Get all organs overview
  app.get('/api/ai/body-insights', authenticate, async (req, res) => {
    try {
      const healthProfile = await HealthProfile.findOne({ userId: req.user._id });
      if (!healthProfile) {
        return res.status(404).json({ success: false, message: 'Health profile required' });
      }

      const organs = Object.keys(medicalKB.ORGAN_RISK_FACTORS);
      const overview = organs.map(organ => {
        const risk = medicalKB.calculateOrganRisk(organ, healthProfile);
        return {
          organ,
          name: risk.organ,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel
        };
      });

      res.json({ success: true, organs: overview });
    } catch (err) {
      console.error('Body overview error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. AI GROUP RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/ai/group-recommendations', authenticate, async (req, res) => {
    try {
      const healthProfile = await HealthProfile.findOne({ userId: req.user._id });

      // Get all public active groups user isn't in
      const publicGroups = await Group.find({
        privacy: 'public',
        isActive: true,
        'members.user': { $ne: req.user._id },
        creator: { $ne: req.user._id }
      }).populate('creator', 'username').limit(50);

      if (!healthProfile) {
        // Return general popular groups
        return res.json({
          success: true,
          recommendations: publicGroups.slice(0, 10).map(g => ({
            group: g,
            matchScore: 50,
            matchReasons: ['Public health community']
          })),
          method: 'general'
        });
      }

      // Score each group based on profile match
      const scored = publicGroups.map(group => {
        let score = 0;
        const reasons = [];

        // Condition matching
        if (healthProfile.conditions && group.targetConditions) {
          const conditionMatches = healthProfile.conditions.filter(c =>
            group.targetConditions.some(tc =>
              tc.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(tc.toLowerCase())
            )
          );
          if (conditionMatches.length > 0) {
            score += conditionMatches.length * 30;
            reasons.push(`Matches your condition: ${conditionMatches.join(', ')}`);
          }
        }

        // Health goal matching
        if (healthProfile.healthGoal) {
          const goalKeywords = healthProfile.healthGoal.toLowerCase().split(' ');
          const descLower = (group.description || '').toLowerCase();
          const nameMatch = goalKeywords.some(kw => (group.groupName || '').toLowerCase().includes(kw));
          const descMatch = goalKeywords.some(kw => descLower.includes(kw));
          if (nameMatch || descMatch) {
            score += 20;
            reasons.push(`Aligns with your goal: ${healthProfile.healthGoal}`);
          }
        }

        // Category matching based on conditions
        if (group.category === 'fitness_goals' && ['Weight Loss', 'Weight Gain', 'Muscle Building', 'Improve Fitness'].includes(healthProfile.healthGoal)) {
          score += 15;
          reasons.push('Fitness-focused group matching your goals');
        }
        if (group.category === 'diet_nutrition' && healthProfile.dietPreference) {
          score += 10;
          reasons.push('Nutrition-focused community');
        }
        if (group.category === 'mental_health' && healthProfile.conditions?.some(c => /anxiety|depression|stress/i.test(c))) {
          score += 25;
          reasons.push('Mental health support matching your needs');
        }

        // Age match
        if (healthProfile.age) {
          if ((!group.minAge || healthProfile.age >= group.minAge) &&
            (!group.maxAge || healthProfile.age <= group.maxAge)) {
            score += 5;
          }
        }

        // Popularity bonus
        if (group.membersCount > 10) score += 5;

        return {
          group,
          matchScore: Math.min(score, 100),
          matchReasons: reasons.length > 0 ? reasons : ['General health community']
        };
      });

      // Sort by score and return top matches
      scored.sort((a, b) => b.matchScore - a.matchScore);

      res.json({
        success: true,
        recommendations: scored.slice(0, 10),
        method: 'ai_profile_matching',
        profileUsed: {
          conditions: healthProfile.conditions || [],
          healthGoal: healthProfile.healthGoal,
          dietPreference: healthProfile.dietPreference
        }
      });
    } catch (err) {
      console.error('Group recommendations error:', err);
      res.status(500).json({ success: false, message: 'Recommendations service error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // AI STATUS ENDPOINT
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/ai/status', authenticate, async (req, res) => {
    try {
      const hasHFKey = !!process.env.HUGGINGFACE_API_KEY;
      const hasProfile = !!(await HealthProfile.findOne({ userId: req.user._id }));

      res.json({
        success: true,
        status: 'operational',
        features: {
          chat: true,
          symptomChecker: true,
          healthRisk: hasProfile,
          supplementInteractions: true,
          nutritionAnalyzer: true,
          moodAnalysis: true,
          healthInsights: hasProfile,
          appointmentPrescreen: true,
          bodyInsights: hasProfile,
          groupRecommendations: true
        },
        huggingFaceEnabled: hasHFKey,
        profileComplete: hasProfile,
        message: hasProfile
          ? 'All AI features are available for you!'
          : 'Complete your health profile to unlock personalized AI features (risk assessment, body insights, weekly reports).'
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
};
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
