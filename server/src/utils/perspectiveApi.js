const toxicity = require('@tensorflow-models/toxicity');
const logger = require('./logger');

const TOXICITY_THRESHOLD = 0.5;
let model = null;

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
 * perspectiveApi.js — TensorFlow based
 * Analyzes text for toxicity using local TensorFlow model.
 */
async function analyzeWithPerspective(text) {
  const toxicityModel = await initModel();
  if (!toxicityModel) {
    return { score: 0, severity: 'LOW', flagged_attributes: [] };
  }

  try {
    const predictions = await toxicityModel.classify([text]);
    let maxScore = 0;
    let flaggedAttributes = [];
    let severity = 'LOW';

    predictions.forEach(p => {
      const score = p.results[0].probabilities[1];
      if (score > maxScore) maxScore = score;
      
      if (p.results[0].match || score > TOXICITY_THRESHOLD) {
        flaggedAttributes.push(p.label);
      }
    });

    if (maxScore > 0.8) {
      severity = 'HIGH';
    } else if (maxScore > 0.6) {
      severity = 'MEDIUM';
    }

    return {
      score: maxScore,
      severity,
      flagged_attributes: flaggedAttributes
    };
  } catch (err) {
    logger.error('Toxicity analysis failed — falling back to keyword check', { error: err.message });
    
    // Minimal fallback: if AI fails, at least we have the keyword layer in safety.service
    // but we return LOW here to not block incorrectly if AI is just broken.
    return { score: 0, severity: 'LOW', flagged_attributes: [] };
  }
}

module.exports = {
  analyzeWithPerspective
};
