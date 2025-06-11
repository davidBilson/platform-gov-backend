import express from 'express';
import { fetchAllCategoriesAndItems } from '../controllers/content.controller.js';

const router = express.Router();

router.get('/categories', fetchAllCategoriesAndItems);

export default router;