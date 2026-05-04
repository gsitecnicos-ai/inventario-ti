import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

export const register = async (req, res) => {
  const { nome, email, senha, empresa } = req.body;

  const hash = await bcrypt.hash(senha, 10);

  const novaEmpresa = await prisma.empresa.create({
    data: { nome: empresa }
  });

  const user = await prisma.usuario.create({
    data: {
      nome,
      email,
      senha: hash,
      empresaId: novaEmpresa.id
    }
  });

  res.json(user);
};

export const login = async (req, res) => {
  const { email, senha } = req.body;

  const user = await prisma.usuario.findUnique({
    where: { email }
  });

  if (!user) {
    return res.status(404).json({ erro: 'Usuário não encontrado' });
  }

  const valid = await bcrypt.compare(senha, user.senha);

  if (!valid) {
    return res.status(401).json({ erro: 'Senha inválida' });
  }

  const token = jwt.sign(
    { userId: user.id, empresaId: user.empresaId },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({ token });
};