import { prisma } from '../config/prisma.js';

export const criar = async (req, res) => {
  const { empresaId } = req.user;

  const ativo = await prisma.ativo.create({
    data: {
      ...req.body,
      empresaId
    }
  });

  res.json(ativo);
};

export const listar = async (req, res) => {
  const { empresaId } = req.user;

  const ativos = await prisma.ativo.findMany({
    where: { empresaId }
  });

  res.json(ativos);
};

export const deletar = async (req, res) => {
  const { id } = req.params;
  const { empresaId } = req.user;

  await prisma.ativo.deleteMany({
    where: { id, empresaId }
  });

  res.json({ ok: true });
};