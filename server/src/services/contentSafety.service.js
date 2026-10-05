const toxicity = require('@tensorflow-models/toxicity');
const logger = require('../utils/logger');
const { query } = require('../config/db.config');

const TOXICITY_THRESHOLD = 0.5;
let model = null;
let moderationRulesCache = [];
let moderationRulesLoadedAt = 0;
const MODERATION_RULES_CACHE_MS = 15000;

const abusiveKeywords = [
  // English Profanity & Abuse
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'bastard', 'slut', 'whore',
  'faggot', 'nigger', 'retard',
  'stupid', 'idiot', 'dumb', 'loser', 'pathetic', 'shut up', 'hate you', 'worthless',
  'useless', 'moron', 'fool', 'trash', 'garbage', 'disgusting', 'you suck', 'go to hell',
  'freak', 'creep',
  // Threats & Self Harm
  'suicide', 'kill myself', 'end my life', 'want to die', 'hurt myself', 'self harm',
  'murder', 'kill you', 'find you', 'hunt you down', 'hurt you', 'beat you', 'destroy you',

  // Roman Urdu Profanity & Abuse
  'chutiya', 'madarchod', 'bhenchod', 'gandu', 'bhosdike', 'raand', 'kamina', 'kameena',
  'harami', 'bakwaas', 'ullu', 'pagal', 'baigharat', 'ganda', 'badtameez', 'jhootha',
  'jhoothi', 'besharam', 'beghairat', 'kutta', 'suar', 'donkey', 'nalayak', 'nikamma',
  'ghatiya', 'bekar', 'lanat', 'chup kar', 'teri aukat nahi', 'akal nahi hai',
  // Roman Urdu Threats & Self Harm
  'khud ko maar lunga', 'marna chahta hoon', 'jeena nahi chahta', 'mar jana chahta hoon',
  'maar dunga', 'khatam kar dunga', 'dekh lunga', 'nahi chodunga', 'barbad kar dunga',
  'thok dunga', 'jan se maar dunga', 'khoon kar dunga'
];
/*
  const highSeverityKeywords = [
    'suicide', 'kill myself', 'end my life', 'want to die', 'hurt myself', 'self harm',
    'cutting myself', 'overdose', 'no reason to live', 'better off dead', 'end it all',
    'khud ko maar lunga', 'khud ko khatam kar lunga', 'marna chahta hoon',
    'marna chahti hoon', 'jeena nahi chahta', 'jeena nahi chahti',
    'zindagi khatam karna chahta hoon', 'apni jaan dena chahta hoon',
    'mar jana chahta hoon', 'khud ko hurt karunga', 'zindagi se tang aa gaya hoon',
    'jina nahi chahta', 'خود کو مارنا', 'مرنا چاہتا ہوں', 'زندگی ختم کرنا',
    'جینا نہیں چاہتا', 'خود کو نقصان',
    'murder', 'kill you', 'find you', 'hunt you down', 'hurt you', 'beat you',
    'destroy you', 'end you', 'come for you', 'make you pay', 'you will regret',
    'i will get you', 'watch your back',
    'maar dunga', 'maar dungi', 'khatam kar dunga', 'khatam kar dungi',
    'dekh lunga', 'dekh lungi', 'nahi chodunga', 'nahi chodungi', 'barbad kar dunga',
    'barbad kar dungi', 'thok dunga', 'utha lunga', 'ghar aa jaunga',
    'address pata hai mujhe', 'chhod nahi dunga', 'tang karunga', 'laat marunga',
    'pitai karunga', 'jan se maar dunga', 'khoon kar dunga', 'dekh lena',
    'bura hoga tera', 'مار دوں گا', 'ختم کر دوں گا', 'دیکھ لوں گا',
    'نہیں چھوڑوں گا', 'برباد کر دوں گا',
    'i know where you live', 'i will follow you', 'send me pictures',
    'meet me alone', 'dont tell anyone', 'keep it secret', 'you owe me',
    'do what i say', 'address bata', 'ghar bata', 'akele milna',
    'kisi ko mat batana', 'photo bhejo', 'tasveer bhejo', 'meri baat mano',
    'kuch nahi kahunga', 'tera pata hai mere paas', 'main jaanta hoon tujhe',
    'chup rehna warna', 'kisi ko bataya toh', 'گھر بتاؤ', 'اکیلے ملنا',
    'کسی کو مت بتانا', 'تصویر بھیجو', 'چپ رہنا'
  ];

*/
const highSeverityKeywords = [
  'suicide', 'kill myself', 'end my life', 'want to die', 'hurt myself', 'self harm',
  'cutting myself', 'overdose', 'no reason to live', 'better off dead', 'end it all',
  'khud ko maar lunga', 'khud ko khatam kar lunga', 'marna chahta hoon',
  'marna chahti hoon', 'jeena nahi chahta', 'jeena nahi chahti',
  'zindagi khatam karna chahta hoon', 'apni jaan dena chahta hoon',
  'mar jana chahta hoon', 'khud ko hurt karunga', 'zindagi se tang aa gaya hoon',
  'jina nahi chahta', 'خود کو مارنا', 'مرنا چاہتا ہوں', 'زندگی ختم کرنا',
  'جینا نہیں چاہتا', 'خود کو نقصان',
  'murder', 'kill you', 'find you', 'hunt you down', 'hurt you', 'beat you',
  'destroy you', 'end you', 'come for you', 'make you pay', 'you will regret',
  'i will get you', 'watch your back',
  'maar dunga', 'maar dungi', 'khatam kar dunga', 'khatam kar dungi',
  'dekh lunga', 'dekh lungi', 'nahi chodunga', 'nahi chodungi', 'barbad kar dunga',
  'barbad kar dungi', 'thok dunga', 'utha lunga', 'ghar aa jaunga',
  'address pata hai mujhe', 'chhod nahi dunga', 'tang karunga', 'laat marunga',
  'pitai karunga', 'jan se maar dunga', 'khoon kar dunga', 'dekh lena',
  'bura hoga tera', 'مار دوں گا', 'ختم کر دوں گا', 'دیکھ لوں گا',
  'نہیں چھوڑوں گا', 'برباد کر دوں گا',
  'i know where you live', 'i will follow you', 'send me pictures',
  'meet me alone', 'dont tell anyone', 'keep it secret', 'you owe me',
  'do what i say', 'address bata', 'ghar bata', 'akele milna',
  'kisi ko mat batana', 'photo bhejo', 'tasveer bhejo', 'meri baat mano',
  'kuch nahi kahunga', 'tera pata hai mere paas', 'main jaanta hoon tujhe',
  'chup rehna warna', 'kisi ko bataya toh', 'گھر بتاؤ', 'اکیلے ملنا',
  'کسی کو مت بتانا', 'تصویر بھیجو', 'چپ رہنا'
];
const detectableKeywords = [...new Set([...abusiveKeywords, ...highSeverityKeywords])];

async function getCustomModerationRules() {
  if (Date.now() - moderationRulesLoadedAt < MODERATION_RULES_CACHE_MS) return moderationRulesCache;
  try {
    const [rows] = await query('SELECT term, severity FROM moderation_rules WHERE enabled = 1');
    moderationRulesCache = rows.map(rule => ({ term: rule.term.toLowerCase(), severity: rule.severity.toLowerCase() }));
    moderationRulesLoadedAt = Date.now();
  } catch (err) {
    logger.warn('Custom moderation rules unavailable; using built-in rules', { error: err.message });
    moderationRulesCache = [];
    moderationRulesLoadedAt = Date.now();
  }
  return moderationRulesCache;
}

function invalidateModerationRulesCache() {
  moderationRulesLoadedAt = 0;
}

async function initModel() {
  if (model) return model;
  try {
    const labelsToInclude = ['identity_attack', 'insult', 'threat', 'sexual_explicit', 'toxicity', 'severe_toxicity'];
    model = await toxicity.load(TOXICITY_THRESHOLD, labelsToInclude);
    logger.info('✓ Safety Monitor: TensorFlow Toxicity Model loaded');
    return model;
  } catch (err) {
    logger.error('Failed to load Toxicity Model', { error: err.message });
    return null;
  }
}

/**
 * Checks text against abusive keywords and TensorFlow.js toxicity model.
 * @param {string} text 
 * @returns {Promise<{isFlagged: boolean, severity: 'low'|'medium'|'high', matchedTerms: string[], sentimentScore: number}>}
 */
async function analyzeContent(text) {
  const content = typeof text === 'string' ? text : '';
  if (!content.trim()) {
    return { isFlagged: false, severity: 'low', matchedTerms: [], sentimentScore: 0 };
  }

  const lowerText = content.toLowerCase();
  const matchedTerms = [];
  const customRules = await getCustomModerationRules();
  let customHighSeverityMatch = false;
  let customMediumSeverityMatch = false;

  for (const word of detectableKeywords) {
    if (lowerText.includes(word)) {
      matchedTerms.push(word);
    }
  }
  for (const rule of customRules) {
    if (lowerText.includes(rule.term)) {
      if (!matchedTerms.includes(rule.term)) matchedTerms.push(rule.term);
      if (rule.severity === 'high') customHighSeverityMatch = true;
      else customMediumSeverityMatch = true;
    }
  }

  let isFlagged = matchedTerms.length > 0;
  let severity = 'low';

  let sentimentScore = 0;
  
  const toxicityModel = await initModel();
  if (toxicityModel) {
    try {
      const predictions = await toxicityModel.classify([content]);
      
      predictions.forEach(p => {
        const score = p.results[0].probabilities[1];
        if (score > sentimentScore) sentimentScore = score;
        
        if (p.results[0].match || score > TOXICITY_THRESHOLD) {
          isFlagged = true;
          if (!matchedTerms.includes(p.label)) {
            matchedTerms.push(`ai_flag_${p.label}`);
          }
        }
      });
    } catch (err) {
      logger.error('Toxicity analysis failed', { error: err.message });
    }
  }

  const matchedKeywordTerms = matchedTerms.filter(term => !term.startsWith('ai_flag_'));
  const hasHighSeverityKeyword = matchedKeywordTerms.some(term =>
    highSeverityKeywords.includes(term)
  );

  if (hasHighSeverityKeyword || customHighSeverityMatch) {
    severity = 'high';
  } else if (matchedKeywordTerms.length > 0 || customMediumSeverityMatch) {
    severity = 'medium';
  } else if (sentimentScore > 0.8) {
    severity = 'high';
  } else if (sentimentScore > 0.6) {
    severity = 'medium';
  }

  return {
    isFlagged,
    severity,
    matchedTerms,
    sentimentScore
  };
}

module.exports = {
  analyzeContent,
  invalidateModerationRulesCache,
};
