import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import ativoRoutes from './routes/ativoRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/ativos', ativoRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Servidor rodando');
});