/**
 * Medical Knowledge Base
 * Comprehensive healthcare data for AI features
 * Sources: WHO, NIH, Mayo Clinic, FDA, PubMed
 */

// â”€â”€â”€ DRUG/SUPPLEMENT INTERACTIONS DATABASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SUPPLEMENT_INTERACTIONS = [
  // Vitamin interactions
  { pair: ['Vitamin K', 'Warfarin'], severity: 'Severe', description: 'Vitamin K counteracts Warfarin\'s blood-thinning effect', recommendation: 'Monitor INR closely. Consult doctor before taking Vitamin K supplements.' },
  { pair: ['Vitamin E', 'Warfarin'], severity: 'Severe', description: 'Vitamin E may increase bleeding risk when combined with Warfarin', recommendation: 'Limit Vitamin E to under 400 IU/day. Monitor for unusual bleeding.' },
  { pair: ['Vitamin C', 'Iron'], severity: 'Mild', description: 'Vitamin C enhances iron absorption â€” this is a beneficial interaction', recommendation: 'Take together for better iron absorption. Good combination.' },
  { pair: ['Vitamin D', 'Calcium'], severity: 'Mild', description: 'Vitamin D enhances calcium absorption â€” beneficial interaction', recommendation: 'Take together for better calcium uptake. Recommended combination.' },
  { pair: ['Vitamin B6', 'Levodopa'], severity: 'Severe', description: 'Vitamin B6 can reduce the effectiveness of Levodopa for Parkinson\'s', recommendation: 'Avoid high-dose B6 supplements. Consult neurologist.' },
  { pair: ['Vitamin A', 'Retinoids'], severity: 'Severe', description: 'Combining may cause Vitamin A toxicity (hypervitaminosis A)', recommendation: 'Do not supplement Vitamin A while on retinoid therapy.' },
  { pair: ['Vitamin E', 'Aspirin'], severity: 'Moderate', description: 'Both thin the blood â€” increased bleeding risk', recommendation: 'Monitor for bruising and bleeding. Take at least 2 hours apart.' },

  // Mineral interactions
  { pair: ['Calcium', 'Iron'], severity: 'Moderate', description: 'Calcium inhibits iron absorption by 50-60%', recommendation: 'Take at least 2 hours apart for optimal absorption.' },
  { pair: ['Calcium', 'Thyroid medication'], severity: 'Severe', description: 'Calcium blocks thyroid hormone absorption', recommendation: 'Take thyroid medication 4 hours before calcium supplements.' },
  { pair: ['Calcium', 'Zinc'], severity: 'Moderate', description: 'High calcium doses can reduce zinc absorption', recommendation: 'Take at different meals or 2+ hours apart.' },
  { pair: ['Magnesium', 'Antibiotics'], severity: 'Moderate', description: 'Magnesium can reduce absorption of certain antibiotics', recommendation: 'Take antibiotics 2 hours before or 6 hours after magnesium.' },
  { pair: ['Zinc', 'Copper'], severity: 'Moderate', description: 'High zinc intake can cause copper deficiency', recommendation: 'If taking zinc long-term, add a small copper supplement (2mg).' },
  { pair: ['Iron', 'Antacids'], severity: 'Moderate', description: 'Antacids reduce iron absorption significantly', recommendation: 'Take iron 2 hours before or 4 hours after antacids.' },
  { pair: ['Potassium', 'ACE Inhibitors'], severity: 'Severe', description: 'Can cause dangerously high potassium levels (hyperkalemia)', recommendation: 'Monitor potassium levels regularly. Consult cardiologist.' },

  // Herbal interactions
  { pair: ['St. John\'s Wort', 'Antidepressants'], severity: 'Severe', description: 'Can cause serotonin syndrome â€” potentially life-threatening', recommendation: 'Never combine. Stop St. John\'s Wort 2 weeks before starting antidepressants.' },
  { pair: ['St. John\'s Wort', 'Birth Control'], severity: 'Severe', description: 'Reduces effectiveness of oral contraceptives', recommendation: 'Use alternative contraception. Consult doctor.' },
  { pair: ['St. John\'s Wort', 'Warfarin'], severity: 'Severe', description: 'Reduces Warfarin effectiveness, increasing clot risk', recommendation: 'Avoid combination. Consult hematologist.' },
  { pair: ['Ginkgo Biloba', 'Blood Thinners'], severity: 'Severe', description: 'Ginkgo has blood-thinning properties â€” doubles bleeding risk', recommendation: 'Stop ginkgo 36 hours before surgery. Monitor for bleeding.' },
  { pair: ['Ginkgo Biloba', 'Aspirin'], severity: 'Moderate', description: 'Increased bleeding risk from combined antiplatelet effects', recommendation: 'Monitor for unusual bruising or bleeding.' },
  { pair: ['Garlic', 'Blood Thinners'], severity: 'Moderate', description: 'Garlic has mild anticoagulant properties', recommendation: 'Moderate garlic supplement use. Monitor INR if on warfarin.' },
  { pair: ['Ginseng', 'Diabetes medication'], severity: 'Moderate', description: 'Ginseng may lower blood sugar, compounding diabetes medication effects', recommendation: 'Monitor blood sugar closely. Adjust medication if needed.' },
  { pair: ['Ginseng', 'Warfarin'], severity: 'Moderate', description: 'May reduce Warfarin effectiveness', recommendation: 'Monitor INR. Consult doctor before combining.' },
  { pair: ['Echinacea', 'Immunosuppressants'], severity: 'Severe', description: 'Echinacea stimulates the immune system, counteracting immunosuppressants', recommendation: 'Avoid if on immunosuppressive therapy (organ transplant, autoimmune).' },
  { pair: ['Kava', 'Sedatives'], severity: 'Severe', description: 'Combined sedative effects can cause extreme drowsiness', recommendation: 'Never combine. Risk of respiratory depression.' },
  { pair: ['Valerian', 'Benzodiazepines'], severity: 'Moderate', description: 'Additive sedative effects', recommendation: 'Reduce valerian dose or avoid combining.' },
  { pair: ['Turmeric', 'Blood Thinners'], severity: 'Moderate', description: 'Curcumin has mild anticoagulant properties', recommendation: 'Use culinary amounts only. Avoid high-dose supplements with blood thinners.' },
  { pair: ['Green Tea Extract', 'Warfarin'], severity: 'Moderate', description: 'Green tea contains Vitamin K which counteracts Warfarin', recommendation: 'Keep green tea intake consistent. Inform your doctor.' },
  { pair: ['Melatonin', 'Blood Pressure medication'], severity: 'Moderate', description: 'Melatonin can affect blood pressure regulation', recommendation: 'Monitor blood pressure. Take melatonin at bedtime only.' },
  { pair: ['Fish Oil', 'Blood Thinners'], severity: 'Moderate', description: 'Omega-3s have mild blood-thinning properties', recommendation: 'Limit to 2g/day of omega-3 with blood thinners. Monitor bleeding.' },
  { pair: ['Probiotics', 'Antibiotics'], severity: 'Mild', description: 'Antibiotics may kill probiotic bacteria', recommendation: 'Take probiotics 2-3 hours after antibiotics. Continue probiotics after course ends.' },
  { pair: ['CoQ10', 'Statins'], severity: 'Mild', description: 'Statins reduce CoQ10 levels â€” supplementing is beneficial', recommendation: 'CoQ10 supplementation is recommended with statin therapy.' },
  { pair: ['CoQ10', 'Blood Thinners'], severity: 'Moderate', description: 'CoQ10 may reduce blood thinner effectiveness', recommendation: 'Monitor INR closely. Consult doctor.' },

  // Common medication interactions
  { pair: ['Melatonin', 'Sedatives'], severity: 'Moderate', description: 'Additive drowsiness effects', recommendation: 'Use lower melatonin dose (0.5-1mg). Avoid driving.' },
  { pair: ['5-HTP', 'Antidepressants'], severity: 'Severe', description: 'Risk of serotonin syndrome', recommendation: 'Never combine 5-HTP with SSRIs, SNRIs, or MAOIs.' },
  { pair: ['SAMe', 'Antidepressants'], severity: 'Severe', description: 'Can trigger serotonin syndrome or mania', recommendation: 'Do not combine without medical supervision.' },
  { pair: ['Chromium', 'Diabetes medication'], severity: 'Moderate', description: 'May enhance blood sugar lowering, risking hypoglycemia', recommendation: 'Monitor blood sugar closely. May need medication dose adjustment.' },
  { pair: ['Folic Acid', 'Methotrexate'], severity: 'Moderate', description: 'Folic acid can reduce methotrexate effectiveness for cancer', recommendation: 'Only take folic acid if prescribed by oncologist with methotrexate.' },
  { pair: ['Biotin', 'Lab Tests'], severity: 'Moderate', description: 'High biotin can falsify thyroid, cardiac, and hormone lab results', recommendation: 'Stop biotin 72 hours before blood tests.' },
];

// â”€â”€â”€ SYMPTOM â†’ CONDITION MAPPING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SYMPTOM_CONDITIONS = [
  {
    symptoms: ['headache', 'fever', 'body ache', 'fatigue', 'chills'],
    condition: 'Influenza (Flu)',
    urgency: 'medium',
    specialty: 'General Practice',
    description: 'Viral infection affecting the respiratory system'
  },
  {
    symptoms: ['headache', 'fever', 'stiff neck', 'sensitivity to light', 'confusion'],
    condition: 'Meningitis',
    urgency: 'emergency',
    specialty: 'Neurology',
    description: 'Inflammation of brain and spinal cord membranes â€” seek immediate care'
  },
  {
    symptoms: ['chest pain', 'shortness of breath', 'sweating', 'nausea', 'arm pain'],
    condition: 'Possible Heart Attack',
    urgency: 'emergency',
    specialty: 'Cardiology',
    description: 'Potential cardiac emergency â€” call emergency services immediately'
  },
  {
    symptoms: ['chest pain', 'shortness of breath', 'cough', 'fever'],
    condition: 'Pneumonia',
    urgency: 'high',
    specialty: 'General Practice',
    description: 'Lung infection requiring prompt medical attention'
  },
  {
    symptoms: ['frequent urination', 'increased thirst', 'fatigue', 'blurred vision', 'weight loss'],
    condition: 'Diabetes Mellitus',
    urgency: 'medium',
    specialty: 'Endocrinology',
    description: 'Metabolic disorder affecting blood sugar regulation'
  },
  {
    symptoms: ['joint pain', 'swelling', 'stiffness', 'reduced range of motion'],
    condition: 'Arthritis',
    urgency: 'low',
    specialty: 'Orthopedics',
    description: 'Joint inflammation â€” consult for proper diagnosis and management'
  },
  {
    symptoms: ['persistent sadness', 'loss of interest', 'sleep changes', 'fatigue', 'difficulty concentrating'],
    condition: 'Major Depressive Disorder',
    urgency: 'medium',
    specialty: 'Psychiatry',
    description: 'Mental health condition requiring professional support'
  },
  {
    symptoms: ['anxiety', 'restlessness', 'rapid heartbeat', 'sweating', 'trembling'],
    condition: 'Generalized Anxiety Disorder',
    urgency: 'medium',
    specialty: 'Psychiatry',
    description: 'Anxiety disorder â€” treatable with therapy and/or medication'
  },
  {
    symptoms: ['abdominal pain', 'bloating', 'diarrhea', 'constipation', 'gas'],
    condition: 'Irritable Bowel Syndrome (IBS)',
    urgency: 'low',
    specialty: 'Gastroenterology',
    description: 'Functional gastrointestinal disorder'
  },
  {
    symptoms: ['abdominal pain', 'nausea', 'vomiting', 'fever', 'loss of appetite'],
    condition: 'Appendicitis',
    urgency: 'high',
    specialty: 'Surgery',
    description: 'Inflammation of appendix â€” may require surgical intervention'
  },
  {
    symptoms: ['rash', 'itching', 'redness', 'dry skin', 'swelling'],
    condition: 'Dermatitis / Eczema',
    urgency: 'low',
    specialty: 'Dermatology',
    description: 'Skin inflammation â€” manageable with proper treatment'
  },
  {
    symptoms: ['back pain', 'leg numbness', 'tingling', 'weakness', 'difficulty walking'],
    condition: 'Herniated Disc / Sciatica',
    urgency: 'medium',
    specialty: 'Orthopedics',
    description: 'Spinal disc problem causing nerve compression'
  },
  {
    symptoms: ['cough', 'wheezing', 'shortness of breath', 'chest tightness'],
    condition: 'Asthma',
    urgency: 'medium',
    specialty: 'General Practice',
    description: 'Chronic airway inflammation â€” requires ongoing management'
  },
  {
    symptoms: ['sore throat', 'difficulty swallowing', 'fever', 'swollen lymph nodes'],
    condition: 'Pharyngitis / Tonsillitis',
    urgency: 'low',
    specialty: 'General Practice',
    description: 'Throat infection â€” may be viral or bacterial'
  },
  {
    symptoms: ['burning urination', 'frequent urination', 'pelvic pain', 'cloudy urine'],
    condition: 'Urinary Tract Infection (UTI)',
    urgency: 'medium',
    specialty: 'Urology',
    description: 'Bacterial infection of the urinary system'
  },
  {
    symptoms: ['weight gain', 'fatigue', 'cold sensitivity', 'dry skin', 'hair loss'],
    condition: 'Hypothyroidism',
    urgency: 'medium',
    specialty: 'Endocrinology',
    description: 'Underactive thyroid gland'
  },
  {
    symptoms: ['weight loss', 'rapid heartbeat', 'anxiety', 'tremor', 'heat sensitivity'],
    condition: 'Hyperthyroidism',
    urgency: 'medium',
    specialty: 'Endocrinology',
    description: 'Overactive thyroid gland'
  },
  {
    symptoms: ['severe headache', 'visual changes', 'nausea', 'sensitivity to light', 'aura'],
    condition: 'Migraine',
    urgency: 'medium',
    specialty: 'Neurology',
    description: 'Neurological condition causing severe recurring headaches'
  },
  {
    symptoms: ['blood in stool', 'abdominal pain', 'weight loss', 'fatigue', 'change in bowel habits'],
    condition: 'Inflammatory Bowel Disease / Colorectal concerns',
    urgency: 'high',
    specialty: 'Gastroenterology',
    description: 'GI condition requiring prompt evaluation'
  },
  {
    symptoms: ['excessive snoring', 'daytime sleepiness', 'morning headaches', 'difficulty concentrating'],
    condition: 'Sleep Apnea',
    urgency: 'medium',
    specialty: 'General Practice',
    description: 'Sleep disorder affecting breathing during sleep'
  },
  {
    symptoms: ['dizziness', 'vertigo', 'nausea', 'balance problems', 'hearing loss'],
    condition: 'Vestibular Disorder / Vertigo',
    urgency: 'medium',
    specialty: 'Neurology',
    description: 'Inner ear or nervous system condition affecting balance'
  },
  {
    symptoms: ['eye pain', 'blurred vision', 'halos around lights', 'headache', 'nausea'],
    condition: 'Glaucoma',
    urgency: 'high',
    specialty: 'General Practice',
    description: 'Eye condition with increased intraocular pressure â€” needs prompt treatment'
  },
];

// â”€â”€â”€ SYMPTOM â†’ SPECIALTY ROUTING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SPECIALTY_ROUTING = {
  'General Practice': ['fever', 'cold', 'cough', 'flu', 'fatigue', 'general pain', 'sore throat', 'ear pain', 'minor injury'],
  'Cardiology': ['chest pain', 'heart palpitations', 'rapid heartbeat', 'shortness of breath', 'high blood pressure', 'swollen legs', 'dizziness with exertion'],
  'Dermatology': ['rash', 'acne', 'skin lesion', 'mole changes', 'itching', 'hair loss', 'nail problems', 'skin discoloration'],
  'Endocrinology': ['weight changes', 'excessive thirst', 'frequent urination', 'fatigue', 'heat/cold sensitivity', 'hormone issues', 'thyroid problems'],
  'Gastroenterology': ['abdominal pain', 'heartburn', 'nausea', 'vomiting', 'diarrhea', 'constipation', 'bloating', 'blood in stool', 'difficulty swallowing'],
  'Neurology': ['headache', 'migraine', 'seizures', 'numbness', 'tingling', 'tremor', 'memory problems', 'dizziness', 'vertigo', 'vision changes'],
  'Orthopedics': ['joint pain', 'back pain', 'bone fracture', 'muscle injury', 'sports injury', 'stiffness', 'swollen joints', 'difficulty walking'],
  'Pediatrics': ['child fever', 'child rash', 'growth concerns', 'vaccination', 'child development', 'child behavioral issues'],
  'Psychiatry': ['depression', 'anxiety', 'panic attacks', 'mood swings', 'insomnia', 'stress', 'eating disorder', 'substance abuse', 'PTSD'],
  'Radiology': ['imaging needed', 'X-ray', 'MRI', 'CT scan', 'ultrasound'],
  'Surgery': ['hernia', 'appendicitis', 'gallstones', 'tumor removal', 'surgical consultation'],
  'Urology': ['urinary problems', 'kidney stones', 'blood in urine', 'prostate issues', 'urinary incontinence', 'bladder problems'],
};

// â”€â”€â”€ ORGAN â†’ RISK FACTOR MAPPING (for Body Insights) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ORGAN_RISK_FACTORS = {
  heart: {
    name: 'Heart',
    riskFactors: ['smoking', 'high BMI', 'sedentary lifestyle', 'high blood pressure', 'diabetes', 'high cholesterol', 'family history of heart disease', 'stress', 'excessive alcohol'],
    conditions: ['Hypertension', 'Coronary Artery Disease', 'Heart Failure', 'Arrhythmia', 'Heart Attack'],
    healthTips: ['Exercise 150 min/week', 'Maintain healthy BMI', 'Limit sodium intake', 'Manage stress', 'Don\'t smoke'],
    relatedMetrics: ['Weight', 'Activity', 'Stress']
  },
  lungs: {
    name: 'Lungs',
    riskFactors: ['smoking', 'air pollution exposure', 'occupational hazards', 'asthma history', 'family history of lung disease'],
    conditions: ['Asthma', 'COPD', 'Pneumonia', 'Bronchitis', 'Lung Cancer'],
    healthTips: ['Don\'t smoke', 'Exercise regularly', 'Avoid air pollution', 'Practice deep breathing', 'Get flu vaccine'],
    relatedMetrics: ['Activity', 'Energy']
  },
  liver: {
    name: 'Liver',
    riskFactors: ['excessive alcohol', 'obesity', 'hepatitis exposure', 'certain medications', 'high-fat diet'],
    conditions: ['Fatty Liver Disease', 'Hepatitis', 'Cirrhosis', 'Liver Cancer'],
    healthTips: ['Limit alcohol', 'Maintain healthy weight', 'Eat balanced diet', 'Get hepatitis vaccines', 'Be careful with medications'],
    relatedMetrics: ['Weight', 'Water']
  },
  kidneys: {
    name: 'Kidneys',
    riskFactors: ['diabetes', 'high blood pressure', 'dehydration', 'excessive NSAID use', 'family history'],
    conditions: ['Chronic Kidney Disease', 'Kidney Stones', 'UTI', 'Nephritis'],
    healthTips: ['Stay hydrated', 'Control blood sugar', 'Limit sodium', 'Avoid excessive painkillers', 'Regular check-ups'],
    relatedMetrics: ['Water', 'Weight']
  },
  brain: {
    name: 'Brain',
    riskFactors: ['poor sleep', 'chronic stress', 'sedentary lifestyle', 'head injuries', 'substance abuse', 'social isolation'],
    conditions: ['Migraine', 'Depression', 'Anxiety', 'Stroke', 'Dementia'],
    healthTips: ['Sleep 7-9 hours', 'Exercise regularly', 'Stay socially active', 'Manage stress', 'Continuous learning'],
    relatedMetrics: ['Sleep', 'Mood', 'Stress', 'Energy']
  },
  stomach: {
    name: 'Stomach & GI',
    riskFactors: ['poor diet', 'stress', 'excessive alcohol', 'smoking', 'irregular eating patterns', 'high processed food intake'],
    conditions: ['GERD', 'Gastritis', 'Peptic Ulcer', 'IBS', 'Gastroparesis'],
    healthTips: ['Eat regular meals', 'Limit spicy/acidic foods', 'Manage stress', 'Chew thoroughly', 'Stay hydrated'],
    relatedMetrics: ['Water', 'Mood', 'Stress']
  },
  bones: {
    name: 'Bones & Joints',
    riskFactors: ['low calcium intake', 'vitamin D deficiency', 'sedentary lifestyle', 'smoking', 'excessive alcohol', 'aging'],
    conditions: ['Osteoporosis', 'Arthritis', 'Fractures', 'Osteomalacia'],
    healthTips: ['Get enough calcium and Vitamin D', 'Weight-bearing exercise', 'Don\'t smoke', 'Limit alcohol', 'Maintain healthy weight'],
    relatedMetrics: ['Activity', 'Weight']
  },
  skin: {
    name: 'Skin',
    riskFactors: ['sun exposure', 'poor hydration', 'smoking', 'poor diet', 'lack of sleep', 'stress'],
    conditions: ['Eczema', 'Psoriasis', 'Acne', 'Skin Cancer', 'Premature Aging'],
    healthTips: ['Use sunscreen daily', 'Stay hydrated', 'Eat antioxidant-rich foods', 'Don\'t smoke', 'Sleep well'],
    relatedMetrics: ['Water', 'Sleep']
  },
  eyes: {
    name: 'Eyes',
    riskFactors: ['screen time', 'diabetes', 'UV exposure', 'smoking', 'poor nutrition', 'aging'],
    conditions: ['Myopia', 'Glaucoma', 'Cataracts', 'Macular Degeneration', 'Diabetic Retinopathy'],
    healthTips: ['Follow 20-20-20 rule', 'Wear sunglasses', 'Eat leafy greens', 'Regular eye exams', 'Limit screen time'],
    relatedMetrics: ['Sleep', 'Energy']
  },
  thyroid: {
    name: 'Thyroid',
    riskFactors: ['family history', 'autoimmune conditions', 'iodine imbalance', 'radiation exposure', 'stress'],
    conditions: ['Hypothyroidism', 'Hyperthyroidism', 'Thyroid Nodules', 'Thyroiditis'],
    healthTips: ['Get regular thyroid checks', 'Ensure iodine intake', 'Manage stress', 'Monitor energy levels', 'Check family history'],
    relatedMetrics: ['Energy', 'Weight', 'Mood']
  },
};

// â”€â”€â”€ BMI RISK THRESHOLDS (WHO) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BMI_CATEGORIES = {
  underweight: { min: 0, max: 18.5, risk: 'moderate', label: 'Underweight', color: '#60a5fa', risks: ['Nutrient deficiency', 'Weakened immune system', 'Osteoporosis risk'] },
  normal: { min: 18.5, max: 25, risk: 'low', label: 'Normal Weight', color: '#34d399', risks: ['Maintain current lifestyle'] },
  overweight: { min: 25, max: 30, risk: 'moderate', label: 'Overweight', color: '#fbbf24', risks: ['Type 2 Diabetes risk', 'Heart disease risk', 'Joint problems'] },
  obese1: { min: 30, max: 35, risk: 'high', label: 'Obese Class I', color: '#f97316', risks: ['Cardiovascular disease', 'Type 2 Diabetes', 'Sleep apnea', 'Hypertension'] },
  obese2: { min: 35, max: 40, risk: 'high', label: 'Obese Class II', color: '#ef4444', risks: ['Severe cardiovascular risk', 'Metabolic syndrome', 'Cancer risk increased'] },
  obese3: { min: 40, max: 100, risk: 'critical', label: 'Obese Class III', color: '#dc2626', risks: ['Life-threatening cardiovascular events', 'Multiple organ stress', 'Severely reduced life expectancy'] },
};

// â”€â”€â”€ HEALTH RECOMMENDATIONS BY CATEGORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const HEALTH_RECOMMENDATIONS = {
  sleep: {
    low: ['Establish a consistent sleep schedule', 'Avoid screens 1 hour before bed', 'Create a dark, cool sleeping environment', 'Limit caffeine after 2 PM'],
    moderate: ['Your sleep is adequate. Try to be more consistent with timing.', 'Consider a brief power nap if needed (20 min max)'],
    good: ['Excellent sleep habits! Keep maintaining your routine.', 'Your body appreciates the consistent rest.']
  },
  hydration: {
    low: ['You\'re significantly under-hydrated. Aim for at least 2L today.', 'Set hourly water reminders', 'Keep a water bottle within reach at all times'],
    moderate: ['Good progress on hydration. Keep sipping throughout the day.', 'Try adding lemon or mint for variety'],
    good: ['Great hydration! You\'re meeting your daily targets.', 'Keep up the excellent habit!']
  },
  activity: {
    sedentary: ['Try to walk at least 5,000 steps daily', 'Take standing breaks every 30 minutes', 'Start with 10-minute walks after meals'],
    light: ['Good start! Aim to increase to 30 minutes of moderate activity', 'Try adding bodyweight exercises 2x per week'],
    moderate: ['Great activity level! Consider interval training for variety', 'Ensure rest days for recovery'],
    active: ['Excellent fitness routine! Ensure proper nutrition and recovery', 'Listen to your body for overtraining signs']
  },
  nutrition: {
    poor: ['Focus on adding more vegetables and fruits', 'Reduce processed food intake', 'Plan meals ahead to avoid fast food'],
    moderate: ['Consider tracking macros for better balance', 'Add more protein-rich foods', 'Increase fiber intake with whole grains'],
    good: ['Your nutrition is well-balanced!', 'Continue with diverse, whole food choices']
  }
};

// â”€â”€â”€ URGENCY LEVEL DEFINITIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const URGENCY_LEVELS = {
  low: { label: 'Low Urgency', color: '#34d399', emoji: 'ðŸŸ¢', action: 'Schedule a routine appointment within 1-2 weeks' },
  medium: { label: 'Moderate Urgency', color: '#fbbf24', emoji: 'ðŸŸ¡', action: 'See a doctor within 2-3 days' },
  high: { label: 'High Urgency', color: '#f97316', emoji: 'ðŸŸ ', action: 'Seek medical attention within 24 hours' },
  emergency: { label: 'Emergency', color: '#ef4444', emoji: 'ðŸ”´', action: 'Call emergency services (911) or go to ER immediately' },
};

// â”€â”€â”€ HELPER FUNCTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Find supplement interactions for a given pair
 */
function findInteractions(supplement1, supplement2) {
  const s1 = supplement1.toLowerCase();
  const s2 = supplement2.toLowerCase();

  return SUPPLEMENT_INTERACTIONS.filter(interaction => {
    const p1 = interaction.pair[0].toLowerCase();
    const p2 = interaction.pair[1].toLowerCase();
    return (
      (s1.includes(p1) || p1.includes(s1) || s1.includes(p2) || p2.includes(s1)) &&
      (s2.includes(p1) || p1.includes(s2) || s2.includes(p2) || p2.includes(s2)) &&
      !(s1.includes(p1) && s2.includes(p1)) // avoid matching same item
    );
  });
}

/**
 * Match symptoms to conditions
 */
function matchSymptoms(userSymptoms) {
  const normalizedSymptoms = userSymptoms.map(s => s.toLowerCase().trim());

  const matches = SYMPTOM_CONDITIONS.map(condition => {
    const matchedSymptoms = condition.symptoms.filter(s =>
      normalizedSymptoms.some(us => us.includes(s) || s.includes(us))
    );
    const matchScore = matchedSymptoms.length / condition.symptoms.length;
    return {
      ...condition,
      matchedSymptoms,
      matchScore,
      confidence: Math.round(matchScore * 100)
    };
  }).filter(m => m.matchScore > 0.2) // At least 20% match
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  return matches;
}

/**
 * Route symptoms to medical specialty
 */
function routeToSpecialty(symptoms) {
  const normalizedSymptoms = symptoms.map(s => s.toLowerCase().trim());
  const specialtyCounts = {};

  for (const [specialty, keywords] of Object.entries(SPECIALTY_ROUTING)) {
    const matchCount = normalizedSymptoms.filter(symptom =>
      keywords.some(kw => symptom.includes(kw) || kw.includes(symptom))
    ).length;
    if (matchCount > 0) {
      specialtyCounts[specialty] = matchCount;
    }
  }

  const sorted = Object.entries(specialtyCounts)
    .sort((a, b) => b[1] - a[1]);

  return sorted.length > 0 ? sorted[0][0] : 'General Practice';
}

/**
 * Get BMI category and risks
 */
function getBMICategory(bmi) {
  for (const [key, cat] of Object.entries(BMI_CATEGORIES)) {
    if (bmi >= cat.min && bmi < cat.max) {
      return { category: key, ...cat };
    }
  }
  return BMI_CATEGORIES.normal;
}

/**
 * Calculate organ risk score based on user profile
 */
function calculateOrganRisk(organ, healthProfile) {
  const organData = ORGAN_RISK_FACTORS[organ];
  if (!organData) return null;

  let riskScore = 0;
  let riskFactorsPresent = [];
  const profile = healthProfile || {};

  // BMI risk
  if (profile.bmi) {
    if (profile.bmi >= 30) { riskScore += 20; riskFactorsPresent.push('High BMI'); }
    else if (profile.bmi >= 25) { riskScore += 10; riskFactorsPresent.push('Elevated BMI'); }
    else if (profile.bmi < 18.5) { riskScore += 10; riskFactorsPresent.push('Low BMI'); }
  }

  // Smoking
  if (profile.smokingHabit === 'Regular') { riskScore += 25; riskFactorsPresent.push('Regular smoking'); }
  else if (profile.smokingHabit === 'Occasional') { riskScore += 10; riskFactorsPresent.push('Occasional smoking'); }

  // Alcohol
  if (profile.alcoholConsumption === 'Regular' && ['liver', 'brain', 'stomach'].includes(organ)) {
    riskScore += 20; riskFactorsPresent.push('Regular alcohol consumption');
  }

  // Sedentary lifestyle
  if (profile.activityLevel === 'Sedentary') { riskScore += 15; riskFactorsPresent.push('Sedentary lifestyle'); }

  // Poor sleep
  if (profile.sleepHours && profile.sleepHours < 6 && ['brain', 'heart'].includes(organ)) {
    riskScore += 15; riskFactorsPresent.push('Insufficient sleep');
  }

  // Age factor
  if (profile.age && profile.age > 50) { riskScore += 10; riskFactorsPresent.push('Age over 50'); }
  else if (profile.age && profile.age > 65) { riskScore += 20; riskFactorsPresent.push('Age over 65'); }

  // Existing conditions
  if (profile.conditions && Array.isArray(profile.conditions)) {
    const relevantConditions = organData.conditions.filter(c =>
      profile.conditions.some(uc => uc.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(uc.toLowerCase()))
    );
    if (relevantConditions.length > 0) {
      riskScore += relevantConditions.length * 15;
      riskFactorsPresent.push(`Existing conditions: ${relevantConditions.join(', ')}`);
    }
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  const riskLevel = riskScore < 20 ? 'low' : riskScore < 45 ? 'moderate' : riskScore < 70 ? 'high' : 'critical';

  return {
    organ: organData.name,
    riskScore,
    riskLevel,
    riskFactorsPresent,
    conditions: organData.conditions,
    healthTips: organData.healthTips,
    relatedMetrics: organData.relatedMetrics
  };
}

module.exports = {
  SUPPLEMENT_INTERACTIONS,
  SYMPTOM_CONDITIONS,
  SPECIALTY_ROUTING,
  ORGAN_RISK_FACTORS,
  BMI_CATEGORIES,
  HEALTH_RECOMMENDATIONS,
  URGENCY_LEVELS,
  findInteractions,
  matchSymptoms,
  routeToSpecialty,
  getBMICategory,
  calculateOrganRisk
};
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 

// minor tweak for clarity

// minor tweak for clarity

// minor tweak for clarity


// minor tweak for clarity
