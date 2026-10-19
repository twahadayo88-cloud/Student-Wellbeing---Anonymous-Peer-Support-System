const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { randomUUID } = require('crypto');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const env = require('../../config/env.config');
const resourcesService = require('./resources.service');

const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads/resources');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXTENSIONS = new Map([
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
]);
const MIME_ALLOWED_EXTENSIONS = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
]);

const resourceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${MIME_EXTENSIONS.get(file.mimetype)}`),
  }),
  limits: { fileSize: env.maxFileSize, files: 1 },
  fileFilter: (_req, file, callback) => {
    const expectedExtensions = MIME_ALLOWED_EXTENSIONS.get(file.mimetype) || [MIME_EXTENSIONS.get(file.mimetype)];
    const actualExtension = path.extname(file.originalname).toLowerCase();
    if (!MIME_EXTENSIONS.has(file.mimetype) || !expectedExtensions.includes(actualExtension)) {
      return callback(AppError.badRequest('Unsupported file type. Upload PDF, TXT, DOCX, PPTX, XLSX, JPG, or PNG.'));
    }
    return callback(null, true);
  },
});

const uploadResource = (req, res, next) => {
  resourceUpload.single('file')(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `File exceeds the ${env.maxFileSize}-byte upload limit.`
        : 'Upload must contain one supported file at most.';
      return next(AppError.badRequest(message));
    }
    return next(error);
  });
};

function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw AppError.badRequest('Invalid resource ID.');
  return id;
}

async function rejectUpload(req, message) {
  if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
  throw AppError.badRequest(message);
}

async function hasValidFileSignature(file) {
  const content = await fs.promises.readFile(file.path);
  switch (file.mimetype) {
    case 'application/pdf':
      return content.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'image/png':
      return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/jpeg':
      return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
    case 'text/plain':
      return !content.includes(0) && new TextDecoder('utf-8', { fatal: true }).decode(content) !== undefined;
    default:
      return content.length >= 4 && content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  }
}

const createResource = asyncHandler(async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const semester = typeof req.body.semester === 'string' ? req.body.semester.trim() : '';
  const externalUrl = typeof req.body.external_url === 'string' ? req.body.external_url.trim() : '';

  if (title.length < 3 || title.length > 160) await rejectUpload(req, 'Title must be 3 to 160 characters.');
  if (description.length < 10 || description.length > 3000) await rejectUpload(req, 'Description must be 10 to 3000 characters.');
  if (!category || category.length > 50) await rejectUpload(req, 'A category of 1 to 50 characters is required.');
  if (subject.length > 100 || semester.length > 30) await rejectUpload(req, 'Subject or semester is too long.');
  if (!req.file && !externalUrl) await rejectUpload(req, 'Upload a file or provide a resource link.');
  if (req.file && externalUrl) await rejectUpload(req, 'Provide either a file or a link, not both.');

  if (req.file) {
    let validSignature = false;
    try { validSignature = await hasValidFileSignature(req.file); } catch {
      validSignature = false;
    }
    if (!validSignature) {
      await rejectUpload(req, 'The uploaded file content does not match its declared type.');
    }
  }

  if (externalUrl) {
    let parsed;
    try { parsed = new URL(externalUrl); } catch { await rejectUpload(req, 'Resource link must be a valid HTTP or HTTPS URL.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) await rejectUpload(req, 'Resource link must use HTTP or HTTPS.');
  }

  try {
    const resource = await resourcesService.createResource(req.user.user_id, {
      title, description, category, subject, semester, externalUrl: externalUrl || null,
    }, req.file ? {
      path: req.file.path,
      originalname: path.basename(req.file.originalname),
      mimetype: req.file.mimetype,
      size: req.file.size,
    } : null);
    return res.status(201).json({ success: true, data: resource });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    throw error;
  }
});

const listResources = asyncHandler(async (req, res) => {
  const filters = {
    subject: typeof req.query.subject === 'string' ? req.query.subject.trim() : '',
    semester: typeof req.query.semester === 'string' ? req.query.semester.trim() : '',
    category: typeof req.query.category === 'string' ? req.query.category.trim() : '',
    search: typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '',
  };
  const data = await resourcesService.listApprovedResources(filters, req.user.user_id);
  return res.status(200).json({ success: true, data });
});

const getRecommendations = asyncHandler(async (req, res) => {
  const data = await resourcesService.getRecommendations(req.user.user_id);
  return res.status(200).json({ success: true, data });
});

const getMine = asyncHandler(async (req, res) => {
  const data = await resourcesService.getMyResources(req.user.user_id);
  return res.status(200).json({ success: true, data });
});

const getFacultyQueue = asyncHandler(async (_req, res) => {
  const data = await resourcesService.getFacultyQueue();
  return res.status(200).json({ success: true, data });
});

const reviewResource = asyncHandler(async (req, res) => {
  const id = positiveId(req.params.id);
  const { status, note, relevance_score: relevanceScore, quality_score: qualityScore } = req.body;
  await resourcesService.reviewResource(
    id, req.user.user_id, status, note, Number(relevanceScore), Number(qualityScore)
  );
  return res.status(200).json({ success: true, message: `Resource ${status}.` });
});

const addReview = asyncHandler(async (req, res) => {
  const rating = Number(req.body.rating);
  const review = typeof req.body.review === 'string' ? req.body.review.trim() : '';
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw AppError.badRequest('Rating must be an integer from 1 to 5.');
  if (review.length > 1000) throw AppError.badRequest('Review must be 1000 characters or fewer.');
  await resourcesService.addReview(positiveId(req.params.id), req.user.user_id, rating, review);
  return res.status(201).json({ success: true, message: 'Review saved.' });
});

const getReviews = asyncHandler(async (req, res) => {
  const data = await resourcesService.getReviews(positiveId(req.params.id));
  return res.status(200).json({ success: true, data });
});

const getBookmarks = asyncHandler(async (req, res) => {
  const data = await resourcesService.getBookmarks(req.user.user_id);
  return res.status(200).json({ success: true, data });
});

const addBookmark = asyncHandler(async (req, res) => {
  await resourcesService.addBookmark(positiveId(req.params.id), req.user.user_id);
  return res.status(200).json({ success: true });
});

const removeBookmark = asyncHandler(async (req, res) => {
  await resourcesService.removeBookmark(positiveId(req.params.id), req.user.user_id);
  return res.status(200).json({ success: true });
});

const downloadResource = asyncHandler(async (req, res) => {
  const resource = await resourcesService.getDownload(positiveId(req.params.id), req.user.user_id, req.user.role);
  return res.download(resource.file_path, resource.original_file_name);
});

module.exports = {
  uploadResource,
  createResource,
  listResources,
  getRecommendations,
  getMine,
  getFacultyQueue,
  reviewResource,
  addReview,
  getReviews,
  getBookmarks,
  addBookmark,
  removeBookmark,
  downloadResource,
};