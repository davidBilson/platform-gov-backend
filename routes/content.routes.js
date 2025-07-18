import express from 'express';
import { fetchAllCategoriesAndItems } from '../controllers/content.controller.js';
import { getDocumentByType } from '../controllers/legalContent.controller.js';

const router = express.Router();

router.get('/categories', fetchAllCategoriesAndItems);
router.get('/get-legal-content-by-type/:documentType', getDocumentByType);

export default router;