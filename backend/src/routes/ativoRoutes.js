import express from 'express';
import { criar, listar, deletar } from '../controllers/ativoController.js';
import { auth } from '../middlewares/auth.js';

const router = express.Router();

router.use(auth);

router.post('/', criar);
router.get('/', listar);
router.delete('/:id', deletar);

export default router;