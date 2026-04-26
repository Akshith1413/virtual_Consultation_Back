/**
 * AI Engine — Core AI Processing Module
 * Uses Hugging Face Inference API (free tier) + built-in algorithms
 */

const medicalKB = require('./medicalKnowledge');

const { HfInference } = require('@huggingface/inference');

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
let hf = null;
if (HF_API_KEY) {
  hf = new HfInference(HF_API_KEY);
}

// Keep exportable wrapper for legacy or manual API calls if needed
async function callHuggingFace(model, inputs, retries = 2) {
  return null; // Deprecated: Use the SDK instances directly
}

// ─── MEDICAL ENTITY EXTRACTION (NER) ─────────────────────────────
async function extractMedicalEntities(text) {
  // Try Hugging Face biomedical NER
  let hfResult = null;
  if (hf) {
    try {
      hfResult = await hf.tokenClassification({
        model: 'd4data/biomedical-ner-all',
        inputs: text
      });
    } catch (err) {
      console.warn("HF tokenClassification failed:", err.message);
    }
  }

  if (hfResult && Array.isArray(hfResult)) {
    const entities = {
      symptoms: [],
      diseases: [],
      medications: [],
      anatomy: [],
      procedures: [],
      raw: hfResult
    };

    // Merge consecutive tokens of the same entity
    let currentEntity = null;

    hfResult.forEach(token => {
      const entityType = token.entity_group || token.entity || '';
      const word = token.word || '';
      const score = token.score || 0;

      // Skip low confidence
      if (score < 0.3) return;

      // Remove ## prefix from subword tokens
      const cleanWord = word.replace(/^##/, '');

      if (entityType.includes('Sign_symptom') || entityType.includes('SYMPTOM')) {
        if (currentEntity && currentEntity.type === 'symptoms') {
          currentEntity.text += cleanWord;
        } else {
          if (currentEntity) pushEntity(entities, currentEntity);
          currentEntity = { type: 'symptoms', text: cleanWord, score };
        }
      } else if (entityType.includes('Disease') || entityType.includes('DISEASE')) {
        if (currentEntity && currentEntity.type === 'diseases') {
          currentEntity.text += cleanWord;
        } else {
          if (currentEntity) pushEntity(entities, currentEntity);
          currentEntity = { type: 'diseases', text: cleanWord, score };
        }
      } else if (entityType.includes('Medication') || entityType.includes('DRUG') || entityType.includes('CHEMICAL')) {
        if (currentEntity && currentEntity.type === 'medications') {
          currentEntity.text += cleanWord;
        } else {
          if (currentEntity) pushEntity(entities, currentEntity);
          currentEntity = { type: 'medications', text: cleanWord, score };
        }
      } else if (entityType.includes('Anatomy') || entityType.includes('BODY')) {
        if (currentEntity && currentEntity.type === 'anatomy') {
          currentEntity.text += cleanWord;
        } else {
          if (currentEntity) pushEntity(entities, currentEntity);
          currentEntity = { type: 'anatomy', text: cleanWord, score };
        }
      } else if (entityType.includes('Procedure') || entityType.includes('TREATMENT')) {
        if (currentEntity && currentEntity.type === 'procedures') {
          currentEntity.text += cleanWord;
        } else {
          if (currentEntity) pushEntity(entities, currentEntity);
          currentEntity = { type: 'procedures', text: cleanWord, score };
        }
      } else {
        if (currentEntity) pushEntity(entities, currentEntity);
        currentEntity = null;
      }
    });

    if (currentEntity) pushEntity(entities, currentEntity);

    // Deduplicate
    Object.keys(entities).forEach(key => {
      if (Array.isArray(entities[key]) && key !== 'raw') {
        entities[key] = [...new Set(entities[key].map(e => typeof e === 'string' ? e : e))];
      }
    });

    return entities;
  }

  // Fallback: rule-based extraction
  return extractEntitiesFallback(text);
}

function pushEntity(entities, entity) {
  if (entity && entity.text.trim().length > 1) {
    entities[entity.type].push(entity.text.trim());
  }
}

// Fallback NER using keyword matching
function extractEntitiesFallback(text) {
  const lowerText = text.toLowerCase();
  const entities = { symptoms: [], diseases: [], medications: [], anatomy: [], procedures: [] };

  // Common symptoms dictionary
  const symptomKeywords = [
    'headache', 'fever', 'cough', 'fatigue', 'nausea', 'vomiting', 'diarrhea',
    'pain', 'ache', 'sore throat', 'runny nose', 'congestion', 'shortness of breath',
    'dizziness', 'chest pain', 'abdominal pain', 'back pain', 'joint pain',
    'rash', 'itching', 'swelling', 'bleeding', 'bruising', 'numbness', 'tingling',
    'weakness', 'tremor', 'seizure', 'insomnia', 'anxiety', 'depression',
    'weight loss', 'weight gain', 'loss of appetite', 'excessive thirst',
    'frequent urination', 'blurred vision', 'hearing loss', 'palpitations',
    'wheezing', 'sneezing', 'chills', 'sweating', 'night sweats', 'hot flashes',
    'constipation', 'bloating', 'heartburn', 'difficulty swallowing',
    'stiff neck', 'muscle spasm', 'cramp', 'restlessness', 'confusion',
    'memory loss', 'difficulty concentrating', 'mood swings', 'irritability',
    'burning sensation', 'dry mouth', 'excessive saliva', 'hair loss',
    'skin discoloration', 'dry skin', 'oily skin', 'acne', 'blisters',
    'chronic pain', 'sharp pain', 'dull pain', 'throbbing pain', 'radiating pain',
    'muscle pain', 'bone pain', 'ear pain', 'eye pain', 'tooth pain',
    'body ache', 'malaise', 'lethargy', 'drowsiness', 'vertigo', 'fainting',
    'rapid heartbeat', 'slow heartbeat', 'irregular heartbeat',
    'cold sensitivity', 'heat sensitivity', 'sensitivity to light'
  ];

  symptomKeywords.forEach(symptom => {
    if (lowerText.includes(symptom)) {
      entities.symptoms.push(symptom);
    }
  });

  // Common anatomy
  const anatomyKeywords = [
    'head', 'neck', 'chest', 'abdomen', 'back', 'shoulder', 'arm', 'elbow',
    'wrist', 'hand', 'finger', 'hip', 'knee', 'ankle', 'foot', 'toe',
    'heart', 'lung', 'liver', 'kidney', 'stomach', 'brain', 'spine',
    'throat', 'ear', 'eye', 'nose', 'mouth', 'skin', 'muscle', 'bone', 'joint'
  ];

  anatomyKeywords.forEach(part => {
    if (lowerText.includes(part)) {
      entities.anatomy.push(part);
    }
  });

  return entities;
}

// ─── HEALTH CHAT RESPONSE GENERATION ─────────────────────────────
async function generateHealthResponse(context, question) {
  // Build a medical context prompt
  const profileContext = context.healthProfile ? buildProfileContext(context.healthProfile) : '';

  // Try Hugging Face text generation (conversational model)
  if (hf) {
    try {
      const response = await hf.chatCompletion({
        model: 'meta-llama/Llama-3.2-1B-Instruct',
        messages: [
          { role: 'system', content: `You are a helpful medical health assistant. ${profileContext}\nProvide a helpful, accurate health response. Always recommend consulting a doctor for serious concerns. Keep your responses concise.` },
          { role: 'user', content: question }
        ],
        max_tokens: 500
      });
      
      if (response && response.choices && response.choices.length > 0) {
        let textResponse = response.choices[0].message.content.trim();
        // Clean up the response
        if (textResponse && textResponse.length >= 10) {
          return textResponse;
        }
      }
    } catch(err) {
      console.warn("HF chatCompletion failed:", err.message);
    }
  }

  // Fallback to built-in responses
  return generateBuiltInResponse(question, context);
}

function buildProfileContext(profile) {
  const parts = [];
  if (profile.age) parts.push(`Age: ${profile.age}`);
  if (profile.gender) parts.push(`Gender: ${profile.gender}`);
  if (profile.bmi) parts.push(`BMI: ${profile.bmi}`);
  if (profile.conditions && profile.conditions.length > 0) parts.push(`Conditions: ${profile.conditions.join(', ')}`);
  if (profile.allergies && profile.allergies.length > 0) parts.push(`Allergies: ${profile.allergies.join(', ')}`);
  if (profile.medications && profile.medications.length > 0) parts.push(`Medications: ${profile.medications.map(m => m.name).join(', ')}`);
  if (profile.activityLevel) parts.push(`Activity: ${profile.activityLevel}`);
  if (profile.dietPreference) parts.push(`Diet: ${profile.dietPreference}`);
  return parts.length > 0 ? `Patient profile: ${parts.join(', ')}.` : '';
}

// Built-in rule-based health response generator
function generateBuiltInResponse(question, context) {
  const q = question.toLowerCase();
  const profile = context.healthProfile || {};

  // Symptom-related queries
  if (q.includes('symptom') || q.includes('feel') || q.includes('pain') || q.includes('hurt')) {
    const entities = extractEntitiesFallback(q);
    if (entities.symptoms.length > 0) {
      const conditions = medicalKB.matchSymptoms(entities.symptoms);
      if (conditions.length > 0) {
        const topMatch = conditions[0];
        return `Based on the symptoms you described (${entities.symptoms.join(', ')}), this could potentially be related to **${topMatch.condition}** (${topMatch.confidence}% match). ${topMatch.description}.\n\n**Recommended action:** ${medicalKB.URGENCY_LEVELS[topMatch.urgency]?.action || 'Consult a doctor'}\n**Suggested specialist:** ${topMatch.specialty}\n\n⚠️ *This is AI-generated information, not medical advice. Please consult a healthcare professional for proper diagnosis.*`;
      }
    }
    return `I understand you're experiencing some health concerns. Could you describe your symptoms more specifically? For example:\n- What symptoms do you have?\n- How long have they lasted?\n- How severe are they (1-10)?\n- Any other symptoms?\n\nThis will help me provide better guidance. Remember, for any serious or persistent symptoms, please consult a healthcare professional.`;
  }

  // Diet/nutrition queries
  if (q.includes('diet') || q.includes('eat') || q.includes('food') || q.includes('nutrition') || q.includes('calorie')) {
    const dietAdvice = profile.dietPreference ?
      `Based on your ${profile.dietPreference} diet preference, here are some recommendations:\n\n` : '';
    const goalAdvice = profile.healthGoal ?
      `For your goal of **${profile.healthGoal}**:\n` : '';

    return `${dietAdvice}${goalAdvice}🥗 **General Nutrition Tips:**\n- Eat a variety of colorful fruits and vegetables daily\n- Choose whole grains over refined carbs\n- Include lean proteins in every meal\n- Stay hydrated — aim for ${profile.weight ? Math.round(profile.weight * 35) : 2500}ml of water daily\n- Limit processed foods, added sugars, and excessive sodium\n${profile.bmi && profile.bmi > 25 ? '\n📉 **Weight Management:** Focus on a moderate calorie deficit (300-500 cal below maintenance) with high protein to preserve muscle.' : ''}\n\n*For personalized meal plans, consult a registered dietitian.*`;
  }

  // Sleep queries
  if (q.includes('sleep') || q.includes('insomnia') || q.includes('rest') || q.includes('tired')) {
    const sleepHours = profile.sleepHours || 'unknown';
    return `🌙 **Sleep Health Guidance:**\n\nYour current sleep: ${sleepHours !== 'unknown' ? sleepHours + ' hours/night' : 'Not tracked yet'}\n\n**Recommended:** 7–9 hours for adults\n\n**Tips for better sleep:**\n1. 📱 Avoid screens 1 hour before bedtime\n2. 🕐 Go to bed and wake up at the same time daily\n3. 🌡️ Keep your room cool (65-68°F / 18-20°C)\n4. ☕ No caffeine after 2 PM\n5. 🧘 Try relaxation techniques before bed\n6. 🏃 Exercise regularly — but not right before bed\n7. 🍽️ Avoid heavy meals 2-3 hours before sleep\n\n${sleepHours !== 'unknown' && sleepHours < 6 ? '⚠️ You\'re getting less than 6 hours — this significantly impacts immune function, cognition, and heart health.' : ''}\n\n*Persistent sleep issues? Consult your doctor about a sleep study.*`;
  }

  // Exercise queries
  if (q.includes('exercise') || q.includes('workout') || q.includes('fitness') || q.includes('active') || q.includes('gym')) {
    const activity = profile.activityLevel || 'not specified';
    return `🏋️ **Exercise Recommendations:**\n\nCurrent activity level: **${activity}**\n\n**WHO Guidelines:**\n- 150-300 min moderate OR 75-150 min vigorous activity/week\n- 2+ days of strength training per week\n- Reduce sedentary time — move every 30 minutes\n\n**Personalized tips:**\n${activity === 'Sedentary' ? '🚶 Start with daily 15-min walks, then gradually increase\n🧘 Try beginner yoga or stretching 3x/week' : ''}\n${activity === 'Lightly Active' ? '⬆️ Aim to add 2 days of 30-min moderate exercise\n💪 Start bodyweight exercises (push-ups, squats)' : ''}\n${activity === 'Moderately Active' ? '✅ Great foundation! Add interval training for variety\n🏃 Consider a running goal (5K, 10K) for motivation' : ''}\n${['Very Active', 'Extremely Active'].includes(activity) ? '💪 Excellent! Focus on recovery and injury prevention\n🥗 Ensure nutrition supports your training\n🛌 Prioritize 8+ hours of sleep for recovery' : ''}\n\n*Consult a fitness professional before starting intense new routines.*`;
  }

  // Weight queries
  if (q.includes('weight') || q.includes('bmi') || q.includes('lose') || q.includes('gain') || q.includes('fat') || q.includes('thin')) {
    const bmi = profile.bmi;
    const bmiInfo = bmi ? medicalKB.getBMICategory(bmi) : null;
    return `⚖️ **Weight & BMI Analysis:**\n\n${bmi ? `Your BMI: **${bmi}** (${bmiInfo.label})\nWeight: ${profile.weight}kg | Height: ${profile.height}cm\n${profile.targetWeight ? `Target weight: ${profile.targetWeight}kg` : ''}` : 'No BMI data available — please update your health profile.'}\n\n${bmiInfo ? `**Risk factors for ${bmiInfo.label}:**\n${bmiInfo.risks.map(r => `- ${r}`).join('\n')}` : ''}\n\n**Healthy weight management tips:**\n- Focus on sustainable changes, not crash diets\n- Aim for 0.5-1kg weight change per week max\n- Combine nutrition adjustments with regular exercise\n- Track progress weekly, not daily\n- Get adequate sleep (affects hunger hormones)\n\n*For personalized weight management plans, consult a healthcare provider.*`;
  }

  // Stress/mental health queries
  if (q.includes('stress') || q.includes('anxious') || q.includes('worried') || q.includes('mental') || q.includes('depress') || q.includes('mood')) {
    return `🧠 **Mental Health Support:**\n\nYour mental health is just as important as physical health.\n\n**Immediate stress relief:**\n1. 🫁 Deep breathing: Inhale 4 sec → Hold 7 sec → Exhale 8 sec\n2. 🧘 5-minute mindfulness meditation\n3. 🚶 Take a 10-minute walk in nature\n4. 📝 Write down 3 things you're grateful for\n\n**Long-term mental wellness:**\n- Maintain social connections\n- Exercise regularly (natural antidepressant)\n- Prioritize sleep (7-9 hours)\n- Limit screen time and news consumption\n- Set boundaries and practice self-care\n- Consider journaling or creative outlets\n\n**When to seek professional help:**\n- Persistent sadness lasting 2+ weeks\n- Difficulty functioning in daily life\n- Changes in sleep or appetite\n- Loss of interest in activities you enjoyed\n- Thoughts of self-harm\n\n📞 **Crisis resources:** If you're in crisis, please contact your local emergency services or a crisis helpline.\n\n*A qualified mental health professional can provide personalized treatment.*`;
  }

  // Supplement queries
  if (q.includes('supplement') || q.includes('vitamin') || q.includes('mineral') || q.includes('protein powder')) {
    return `💊 **Supplement Guidance:**\n\n**Essential supplements to consider:**\n1. **Vitamin D** — Most people are deficient (especially if limited sun exposure)\n2. **Omega-3 (Fish Oil)** — Heart and brain health\n3. **Magnesium** — Sleep, muscle function, stress\n4. **Vitamin B12** — Energy, especially for vegetarians/vegans\n5. **Probiotics** — Gut health\n\n**Important rules:**\n- ⚠️ Always check interactions with medications\n- 🏥 Get blood work before supplementing\n- 💊 Quality matters — choose reputable brands\n- 📋 More is NOT better — follow recommended doses\n- 🍎 Whole foods first, supplements second\n\n${profile.conditions && profile.conditions.length > 0 ? `\n**Note:** With your conditions (${profile.conditions.join(', ')}), some supplements may interact. Use the AI Interaction Checker for safety.` : ''}\n\n*Consult your doctor before starting any supplement regimen.*`;
  }

  // Default response
  return `I'm your AI Health Assistant! 👋\n\nI can help you with:\n🔍 **Symptom Analysis** — Describe your symptoms for preliminary guidance\n🥗 **Nutrition Advice** — Personalized diet recommendations\n😴 **Sleep Tips** — Improve your sleep quality\n🏋️ **Exercise Plans** — Activity recommendations for your level\n⚖️ **Weight Management** — BMI analysis and healthy weight strategies\n🧠 **Mental Health** — Stress management and wellness tips\n💊 **Supplements** — What to take and interaction warnings\n\nWhat would you like to know about? Just ask me anything health-related!\n\n⚠️ *I provide informational guidance only. For medical concerns, always consult a qualified healthcare professional.*`;
}

// ─── SENTIMENT ANALYSIS ──────────────────────────────────────────
async function analyzeSentiment(text) {
  let hfResult = null;
  if (hf) {
    try {
      hfResult = await hf.textClassification({
        model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
        inputs: text
      });
    } catch (err) {
      console.warn("HF textClassification failed:", err.message);
    }
  }

  if (hfResult && Array.isArray(hfResult) && hfResult.length > 0) {
    // Determine if it returned nested arrays or direct objects
    const sentiments = Array.isArray(hfResult[0]) ? hfResult[0] : hfResult;
    const sentimentMap = {};
    sentiments.forEach(s => {
      sentimentMap[s.label.toLowerCase()] = s.score;
    });

    const dominantSentiment = sentiments.reduce((a, b) => a.score > b.score ? a : b);

    return {
      dominant: dominantSentiment.label.toLowerCase(),
      confidence: Math.round(dominantSentiment.score * 100),
      scores: sentimentMap,
      mood: mapSentimentToMood(dominantSentiment.label.toLowerCase(), dominantSentiment.score)
    };
  }

  // Fallback
  return analyzeSentimentFallback(text);
}

function mapSentimentToMood(sentiment, score) {
  if (sentiment === 'positive') {
    return score > 0.8 ? 'Very Positive 😄' : 'Positive 🙂';
  } else if (sentiment === 'negative') {
    return score > 0.8 ? 'Concerning — Consider support 😔' : 'Slightly Negative 😐';
  }
  return 'Neutral 😊';
}

function analyzeSentimentFallback(text) {
  const positiveWords = ['happy', 'great', 'good', 'wonderful', 'excellent', 'amazing', 'love', 'enjoy', 'grateful', 'blessed', 'excited', 'cheerful', 'optimistic', 'peaceful', 'content', 'relaxed', 'energetic', 'motivated', 'hopeful', 'proud'];
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'depressed', 'anxious', 'stressed', 'worried', 'exhausted', 'miserable', 'lonely', 'hurt', 'overwhelmed', 'hopeless', 'irritable', 'insomnia', 'pain', 'suffering'];

  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;

  words.forEach(word => {
    if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
    if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
  });

  const total = positiveCount + negativeCount || 1;
  const positiveScore = positiveCount / total;
  const negativeScore = negativeCount / total;
  const neutralScore = 1 - positiveScore - negativeScore;

  let dominant = 'neutral';
  let confidence = 60;

  if (positiveScore > negativeScore && positiveScore > 0.3) {
    dominant = 'positive';
    confidence = Math.round(positiveScore * 100);
  } else if (negativeScore > positiveScore && negativeScore > 0.3) {
    dominant = 'negative';
    confidence = Math.round(negativeScore * 100);
  }

  return {
    dominant,
    confidence,
    scores: { positive: positiveScore, negative: negativeScore, neutral: Math.max(neutralScore, 0) },
    mood: mapSentimentToMood(dominant, confidence / 100)
  };
}

// ─── HEALTH RISK CALCULATION ─────────────────────────────────────
function calculateHealthRisk(healthProfile, metrics = []) {
  const profile = healthProfile || {};
  const risks = {};

  // Cardiovascular Risk
  let cardioScore = 0;
  if (profile.bmi >= 30) cardioScore += 25;
  else if (profile.bmi >= 25) cardioScore += 15;
  if (profile.smokingHabit === 'Regular') cardioScore += 30;
  else if (profile.smokingHabit === 'Occasional') cardioScore += 15;
  if (profile.age > 55) cardioScore += 20;
  else if (profile.age > 45) cardioScore += 10;
  if (profile.activityLevel === 'Sedentary') cardioScore += 15;
  if (profile.conditions?.some(c => /hypertension|high blood pressure|cholesterol/i.test(c))) cardioScore += 20;
  if (profile.alcoholConsumption === 'Regular') cardioScore += 10;
  if (profile.gender === 'Male') cardioScore += 5;
  risks.cardiovascular = {
    score: Math.min(cardioScore, 100),
    level: cardioScore < 20 ? 'low' : cardioScore < 45 ? 'moderate' : cardioScore < 70 ? 'high' : 'critical',
    label: 'Cardiovascular Risk',
    icon: '❤️',
    factors: []
  };
  if (profile.bmi >= 25) risks.cardiovascular.factors.push(`BMI: ${profile.bmi}`);
  if (profile.smokingHabit && profile.smokingHabit !== 'Non-smoker') risks.cardiovascular.factors.push(`Smoking: ${profile.smokingHabit}`);
  if (profile.activityLevel === 'Sedentary') risks.cardiovascular.factors.push('Sedentary lifestyle');

  // Metabolic Risk
  let metabolicScore = 0;
  if (profile.bmi >= 30) metabolicScore += 30;
  else if (profile.bmi >= 25) metabolicScore += 15;
  if (profile.activityLevel === 'Sedentary') metabolicScore += 20;
  if (profile.conditions?.some(c => /diabetes|pre-diabetes|insulin/i.test(c))) metabolicScore += 30;
  if (profile.dietPreference === 'Other' || !profile.dietPreference) metabolicScore += 5;
  if (profile.age > 45) metabolicScore += 10;
  risks.metabolic = {
    score: Math.min(metabolicScore, 100),
    level: metabolicScore < 20 ? 'low' : metabolicScore < 45 ? 'moderate' : metabolicScore < 70 ? 'high' : 'critical',
    label: 'Metabolic Risk',
    icon: '🔬',
    factors: []
  };
  if (profile.bmi >= 25) risks.metabolic.factors.push(`BMI: ${profile.bmi}`);
  if (profile.activityLevel === 'Sedentary') risks.metabolic.factors.push('Low activity');

  // Respiratory Risk
  let respScore = 0;
  if (profile.smokingHabit === 'Regular') respScore += 40;
  else if (profile.smokingHabit === 'Occasional') respScore += 20;
  else if (profile.smokingHabit === 'Former smoker') respScore += 10;
  if (profile.conditions?.some(c => /asthma|copd|bronchitis|respiratory/i.test(c))) respScore += 25;
  if (profile.age > 60) respScore += 15;
  risks.respiratory = {
    score: Math.min(respScore, 100),
    level: respScore < 20 ? 'low' : respScore < 45 ? 'moderate' : respScore < 70 ? 'high' : 'critical',
    label: 'Respiratory Risk',
    icon: '🫁',
    factors: []
  };
  if (profile.smokingHabit && profile.smokingHabit !== 'Non-smoker') risks.respiratory.factors.push(`Smoking: ${profile.smokingHabit}`);

  // Mental Health Risk
  let mentalScore = 0;
  const recentMoods = metrics.filter(m => m.type === 'Mood').slice(0, 7);
  if (recentMoods.length > 0) {
    const avgMood = recentMoods.reduce((s, m) => s + m.value, 0) / recentMoods.length;
    if (avgMood < 4) mentalScore += 30;
    else if (avgMood < 6) mentalScore += 15;
  }
  const recentSleep = metrics.filter(m => m.type === 'Sleep').slice(0, 7);
  if (recentSleep.length > 0) {
    const avgSleep = recentSleep.reduce((s, m) => s + m.value, 0) / recentSleep.length;
    if (avgSleep < 5) mentalScore += 25;
    else if (avgSleep < 6) mentalScore += 15;
  }
  if (profile.conditions?.some(c => /depression|anxiety|ptsd|bipolar/i.test(c))) mentalScore += 25;
  if (profile.activityLevel === 'Sedentary') mentalScore += 10;
  risks.mentalHealth = {
    score: Math.min(mentalScore, 100),
    level: mentalScore < 20 ? 'low' : mentalScore < 45 ? 'moderate' : mentalScore < 70 ? 'high' : 'critical',
    label: 'Mental Health Risk',
    icon: '🧠',
    factors: []
  };
  if (recentMoods.length > 0 && recentMoods.reduce((s, m) => s + m.value, 0) / recentMoods.length < 5) risks.mentalHealth.factors.push('Low mood scores');
  if (recentSleep.length > 0 && recentSleep.reduce((s, m) => s + m.value, 0) / recentSleep.length < 6) risks.mentalHealth.factors.push('Poor sleep');

  // Nutritional Risk
  let nutriScore = 0;
  if (!profile.dietPreference) nutriScore += 10;
  if (profile.bmi && (profile.bmi < 18.5 || profile.bmi > 30)) nutriScore += 20;
  if (profile.alcoholConsumption === 'Regular') nutriScore += 15;
  if (profile.conditions?.some(c => /anemia|deficiency|malnutrition/i.test(c))) nutriScore += 25;
  risks.nutritional = {
    score: Math.min(nutriScore, 100),
    level: nutriScore < 20 ? 'low' : nutriScore < 45 ? 'moderate' : nutriScore < 70 ? 'high' : 'critical',
    label: 'Nutritional Risk',
    icon: '🥗',
    factors: []
  };
  if (profile.bmi && profile.bmi < 18.5) risks.nutritional.factors.push('Underweight');
  if (profile.bmi && profile.bmi > 30) risks.nutritional.factors.push('Obesity');

  // Overall score
  const allScores = Object.values(risks).map(r => r.score);
  const overallScore = Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length);

  return {
    overall: {
      score: overallScore,
      level: overallScore < 20 ? 'low' : overallScore < 45 ? 'moderate' : overallScore < 70 ? 'high' : 'critical',
      label: 'Overall Health Risk'
    },
    categories: risks,
    generatedAt: new Date().toISOString()
  };
}

// ─── HEALTH DATA CORRELATION ─────────────────────────────────────
function correlateHealthData(metrics, waterData = [], weightData = []) {
  const insights = [];

  // Sleep vs Energy correlation
  const sleepEntries = metrics.filter(m => m.type === 'Sleep').slice(0, 30);
  const energyEntries = metrics.filter(m => m.type === 'Energy').slice(0, 30);

  if (sleepEntries.length >= 5 && energyEntries.length >= 5) {
    const avgSleep = sleepEntries.reduce((s, m) => s + m.value, 0) / sleepEntries.length;
    const avgEnergy = energyEntries.reduce((s, m) => s + m.value, 0) / energyEntries.length;

    // Find days with good sleep (7+) and compare energy
    const goodSleepDays = sleepEntries.filter(s => s.value >= 7);
    const poorSleepDays = sleepEntries.filter(s => s.value < 6);

    if (goodSleepDays.length > 0 && poorSleepDays.length > 0) {
      // Check if energy is higher on good sleep days
      const goodSleepDates = new Set(goodSleepDays.map(d => new Date(d.recordedAt).toDateString()));
      const poorSleepDates = new Set(poorSleepDays.map(d => new Date(d.recordedAt).toDateString()));

      const energyOnGoodSleep = energyEntries.filter(e => goodSleepDates.has(new Date(e.recordedAt).toDateString()));
      const energyOnPoorSleep = energyEntries.filter(e => poorSleepDates.has(new Date(e.recordedAt).toDateString()));

      if (energyOnGoodSleep.length > 0 && energyOnPoorSleep.length > 0) {
        const avgGoodEnergy = energyOnGoodSleep.reduce((s, m) => s + m.value, 0) / energyOnGoodSleep.length;
        const avgPoorEnergy = energyOnPoorSleep.reduce((s, m) => s + m.value, 0) / energyOnPoorSleep.length;
        const diff = Math.round(((avgGoodEnergy - avgPoorEnergy) / avgPoorEnergy) * 100);

        if (diff > 10) {
          insights.push({
            type: 'correlation',
            icon: '💤→⚡',
            title: 'Sleep-Energy Connection',
            description: `Your energy is **${diff}% higher** on days you sleep 7+ hours compared to under 6 hours.`,
            recommendation: 'Prioritize 7-8 hours of sleep for peak energy.',
            confidence: Math.min(85, 60 + goodSleepDays.length * 3),
            metrics: ['Sleep', 'Energy']
          });
        }
      }
    }

    insights.push({
      type: 'averages',
      icon: '📊',
      title: 'Your Averages',
      description: `Average sleep: **${avgSleep.toFixed(1)} hours** | Average energy: **${avgEnergy.toFixed(1)}/10**`,
      recommendation: avgSleep < 7 ? 'Try to improve sleep consistency for better energy.' : 'Great sleep habits! Keep it up.',
      confidence: 90,
      metrics: ['Sleep', 'Energy']
    });
  }

  // Mood trends
  const moodEntries = metrics.filter(m => m.type === 'Mood').slice(0, 14);
  if (moodEntries.length >= 5) {
    const avgMood = moodEntries.reduce((s, m) => s + m.value, 0) / moodEntries.length;
    const recentMood = moodEntries.slice(0, 3).reduce((s, m) => s + m.value, 0) / Math.min(3, moodEntries.length);
    const olderMood = moodEntries.slice(-3).reduce((s, m) => s + m.value, 0) / Math.min(3, moodEntries.length);
    const trend = recentMood - olderMood;

    insights.push({
      type: 'trend',
      icon: trend > 0.5 ? '📈😊' : trend < -0.5 ? '📉😟' : '➡️😊',
      title: 'Mood Trend',
      description: `Your mood is ${trend > 0.5 ? '**improving** 🎉' : trend < -0.5 ? '**declining** ⚠️' : '**stable**'}. Average: **${avgMood.toFixed(1)}/10**`,
      recommendation: trend < -0.5 ? 'Consider talking to someone, increasing activity, or practicing mindfulness.' : 'Keep doing what works for your emotional wellbeing!',
      confidence: 75,
      metrics: ['Mood']
    });
  }

  // Hydration impact
  if (waterData && waterData.length > 0 && energyEntries.length > 0) {
    insights.push({
      type: 'hydration',
      icon: '💧',
      title: 'Hydration Impact',
      description: 'Studies show proper hydration improves energy by 20-25% and cognitive performance by 14%.',
      recommendation: 'Aim for 35ml per kg of body weight daily.',
      confidence: 80,
      metrics: ['Water', 'Energy']
    });
  }

  // Weight trend
  const weightEntries = metrics.filter(m => m.type === 'Weight');
  if (weightEntries.length >= 3) {
    const recent = weightEntries[0].value;
    const oldest = weightEntries[weightEntries.length - 1].value;
    const change = recent - oldest;
    const daysSpan = Math.ceil((new Date(weightEntries[0].recordedAt) - new Date(weightEntries[weightEntries.length - 1].recordedAt)) / (1000 * 60 * 60 * 24));
    const weeklyChange = daysSpan > 0 ? (change / daysSpan * 7).toFixed(2) : 0;

    insights.push({
      type: 'weight_trend',
      icon: change < 0 ? '📉⚖️' : change > 0 ? '📈⚖️' : '➡️⚖️',
      title: 'Weight Trajectory',
      description: `${change < 0 ? 'Lost' : 'Gained'} **${Math.abs(change).toFixed(1)}kg** over ${daysSpan} days (**${weeklyChange}kg/week**).`,
      recommendation: Math.abs(parseFloat(weeklyChange)) > 1 ? 'Rate of change is fast — aim for 0.5-1kg/week for sustainability.' : 'Healthy rate of change. Keep going!',
      confidence: 85,
      metrics: ['Weight']
    });
  }

  // Add general wellness insight
  insights.push({
    type: 'wellness',
    icon: '✨',
    title: 'Daily Wellness Tip',
    description: getRandomWellnessTip(),
    recommendation: 'Small daily habits compound into significant health improvements.',
    confidence: 100,
    metrics: []
  });

  return {
    insights,
    generatedAt: new Date().toISOString(),
    dataPointsAnalyzed: metrics.length
  };
}

function getRandomWellnessTip() {
  const tips = [
    'Taking a 10-minute walk after meals can reduce blood sugar spikes by up to 22% (Stanford University).',
    'Drinking water first thing in the morning jumpstarts your metabolism by 24% for 90 minutes (JCI).',
    'Just 5 minutes of deep breathing can reduce cortisol (stress hormone) by 23% (Harvard Health).',
    'Eating slowly (20+ minutes per meal) helps you consume 15% fewer calories naturally.',
    'Exposure to morning sunlight helps set your circadian rhythm and improves sleep quality by 65%.',
    'Laughing for 15 minutes burns approximately 40 calories and boosts immune function.',
    'Standing up every 30 minutes reduces the health risks of prolonged sitting by 33%.',
    'Consuming 25-30g of fiber daily reduces cardiovascular disease risk by 30% (BMJ).',
    'Social connections are as important as exercise for longevity (Blue Zones research).',
    'Even 7 minutes of high-intensity exercise provides significant cardiovascular benefits.',
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

// ─── NUTRITION TEXT ANALYSIS ─────────────────────────────────────
async function analyzeNutritionText(text) {
  // Extract food items from natural language
  const foods = extractFoodItems(text);

  // Try HF for better extraction (Optional future integration)
  // Merge any food-related entities from HF (if available)

  return {
    detectedFoods: foods,
    estimatedNutrition: estimateNutrition(foods),
    suggestions: generateNutritionSuggestions(foods)
  };
}

function extractFoodItems(text) {
  const lowerText = text.toLowerCase();

  const foodDatabase = {
    // Proteins
    'egg': { calories: 78, protein: 6, carbs: 0.6, fat: 5, serving: '1 large' },
    'scrambled egg': { calories: 91, protein: 6, carbs: 1, fat: 7, serving: '1 large' },
    'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6, serving: '100g' },
    'chicken': { calories: 239, protein: 27, carbs: 0, fat: 14, serving: '100g' },
    'salmon': { calories: 208, protein: 20, carbs: 0, fat: 13, serving: '100g' },
    'fish': { calories: 206, protein: 22, carbs: 0, fat: 12, serving: '100g' },
    'beef': { calories: 250, protein: 26, carbs: 0, fat: 15, serving: '100g' },
    'tofu': { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, serving: '100g' },
    'paneer': { calories: 265, protein: 18, carbs: 1.2, fat: 20, serving: '100g' },
    'dal': { calories: 198, protein: 14, carbs: 34, fat: 1, serving: '1 cup' },
    'lentils': { calories: 230, protein: 18, carbs: 40, fat: 0.8, serving: '1 cup' },

    // Grains
    'rice': { calories: 206, protein: 4.3, carbs: 45, fat: 0.4, serving: '1 cup cooked' },
    'bread': { calories: 79, protein: 2.7, carbs: 15, fat: 1, serving: '1 slice' },
    'toast': { calories: 79, protein: 2.7, carbs: 15, fat: 1, serving: '1 slice' },
    'roti': { calories: 120, protein: 3, carbs: 18, fat: 3.7, serving: '1 piece' },
    'chapati': { calories: 120, protein: 3, carbs: 18, fat: 3.7, serving: '1 piece' },
    'oatmeal': { calories: 154, protein: 5, carbs: 27, fat: 2.6, serving: '1 cup' },
    'oats': { calories: 154, protein: 5, carbs: 27, fat: 2.6, serving: '1 cup' },
    'pasta': { calories: 220, protein: 8, carbs: 43, fat: 1.3, serving: '1 cup cooked' },
    'noodles': { calories: 220, protein: 7, carbs: 40, fat: 3.3, serving: '1 cup' },

    // Fruits
    'banana': { calories: 105, protein: 1.3, carbs: 27, fat: 0.4, serving: '1 medium' },
    'apple': { calories: 95, protein: 0.5, carbs: 25, fat: 0.3, serving: '1 medium' },
    'orange': { calories: 62, protein: 1.2, carbs: 15, fat: 0.2, serving: '1 medium' },
    'mango': { calories: 99, protein: 1.4, carbs: 25, fat: 0.6, serving: '1 cup' },

    // Dairy
    'milk': { calories: 103, protein: 8, carbs: 12, fat: 2.4, serving: '1 cup' },
    'yogurt': { calories: 100, protein: 17, carbs: 6, fat: 0.7, serving: '1 cup' },
    'curd': { calories: 98, protein: 11, carbs: 4.7, fat: 4.3, serving: '1 cup' },
    'cheese': { calories: 113, protein: 7, carbs: 0.4, fat: 9, serving: '1 slice' },
    'butter': { calories: 102, protein: 0.1, carbs: 0, fat: 12, serving: '1 tbsp' },

    // Beverages
    'orange juice': { calories: 112, protein: 1.7, carbs: 26, fat: 0.5, serving: '1 cup' },
    'coffee': { calories: 2, protein: 0.3, carbs: 0, fat: 0, serving: '1 cup black' },
    'tea': { calories: 2, protein: 0, carbs: 0.5, fat: 0, serving: '1 cup' },
    'smoothie': { calories: 230, protein: 4, carbs: 44, fat: 4, serving: '1 cup' },
    'protein shake': { calories: 200, protein: 25, carbs: 10, fat: 5, serving: '1 scoop + milk' },

    // Vegetables
    'salad': { calories: 20, protein: 1.5, carbs: 3.5, fat: 0.2, serving: '1 cup' },
    'broccoli': { calories: 55, protein: 3.7, carbs: 11, fat: 0.6, serving: '1 cup' },
    'spinach': { calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, serving: '1 cup raw' },
    'potato': { calories: 161, protein: 4.3, carbs: 37, fat: 0.2, serving: '1 medium' },

    // Snacks
    'almonds': { calories: 164, protein: 6, carbs: 6, fat: 14, serving: '1 oz (23 nuts)' },
    'peanut butter': { calories: 94, protein: 4, carbs: 3, fat: 8, serving: '1 tbsp' },
    'granola bar': { calories: 190, protein: 3, carbs: 29, fat: 7, serving: '1 bar' },
    'chocolate': { calories: 155, protein: 1.4, carbs: 17, fat: 9, serving: '1 oz' },

    // Indian foods
    'biryani': { calories: 350, protein: 12, carbs: 45, fat: 14, serving: '1 plate' },
    'idli': { calories: 39, protein: 2, carbs: 8, fat: 0.2, serving: '1 piece' },
    'dosa': { calories: 133, protein: 4, carbs: 19, fat: 5, serving: '1 piece' },
    'sambar': { calories: 85, protein: 4, carbs: 12, fat: 2.5, serving: '1 cup' },
    'upma': { calories: 210, protein: 5, carbs: 30, fat: 8, serving: '1 cup' },
    'poha': { calories: 180, protein: 4, carbs: 35, fat: 3, serving: '1 cup' },
    'paratha': { calories: 260, protein: 5, carbs: 36, fat: 10, serving: '1 piece' },
    'naan': { calories: 262, protein: 9, carbs: 45, fat: 5, serving: '1 piece' },
    'curry': { calories: 243, protein: 15, carbs: 16, fat: 14, serving: '1 cup' },
  };

  const detected = [];

  // Extract quantity patterns
  const quantityPattern = /(\d+)\s*(scrambled\s+eggs?|eggs?|pieces?\s+of\s+\w+|cups?\s+of\s+\w+|slices?\s+of\s+\w+|pieces?|cups?|glasses?\s+of\s+\w+|bowls?\s+of\s+\w+)/gi;
  const matches = [...lowerText.matchAll(quantityPattern)];

  // Check each food item
  for (const [name, nutrition] of Object.entries(foodDatabase)) {
    if (lowerText.includes(name)) {
      // Try to find quantity
      let qty = 1;
      const qtyMatch = matches.find(m => m[0].toLowerCase().includes(name.split(' ')[0]));
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1]) || 1;
      } else {
        // Check for number before food name
        const numPattern = new RegExp(`(\\d+)\\s+(?:${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
        const numMatch = lowerText.match(numPattern);
        if (numMatch) qty = parseInt(numMatch[1]) || 1;
      }

      detected.push({
        name,
        quantity: qty,
        serving: nutrition.serving,
        nutrition: {
          calories: Math.round(nutrition.calories * qty),
          protein: Math.round(nutrition.protein * qty * 10) / 10,
          carbs: Math.round(nutrition.carbs * qty * 10) / 10,
          fat: Math.round(nutrition.fat * qty * 10) / 10,
        }
      });
    }
  }

  return detected;
}

function estimateNutrition(foods) {
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  foods.forEach(f => {
    total.calories += f.nutrition.calories;
    total.protein += f.nutrition.protein;
    total.carbs += f.nutrition.carbs;
    total.fat += f.nutrition.fat;
  });
  return {
    calories: Math.round(total.calories),
    protein: Math.round(total.protein * 10) / 10,
    carbs: Math.round(total.carbs * 10) / 10,
    fat: Math.round(total.fat * 10) / 10,
    fiber: 0 // TODO: add fiber data
  };
}

function generateNutritionSuggestions(foods) {
  const total = estimateNutrition(foods);
  const suggestions = [];

  if (total.protein < 15) suggestions.push('Consider adding a protein source (eggs, chicken, tofu, or dal).');
  if (total.carbs > 60 && total.protein < 20) suggestions.push('This meal is carb-heavy. Balance with more protein.');
  if (total.fat > 30) suggestions.push('This meal is high in fat. Consider lighter cooking methods.');
  if (foods.length === 0) suggestions.push('I couldn\'t identify specific foods. Try being more specific, e.g., "2 eggs with toast and orange juice".');
  if (total.calories < 300) suggestions.push('This seems like a light meal. Make sure you\'re eating enough throughout the day.');
  if (total.calories > 800) suggestions.push('This is a calorie-dense meal. Consider lighter options for other meals today.');

  return suggestions;
}

module.exports = {
  callHuggingFace,
  extractMedicalEntities,
  generateHealthResponse,
  analyzeSentiment,
  calculateHealthRisk,
  correlateHealthData,
  analyzeNutritionText,
  extractEntitiesFallback,
  buildProfileContext
};
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
