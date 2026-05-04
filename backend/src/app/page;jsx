'use client';

import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [ativos, setAtivos] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.push('/login');
      return;
    }

    carregar();
  }, []);

  const carregar = async () => {
    const res = await api.get('/ativos');
    setAtivos(res.data);
  };

  const criar = async () => {
    await api.post('/ativos', {
      nome: 'Novo ativo'
    });

    carregar();
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Ativos</h1>

      <button onClick={criar}>
        Criar Ativo
      </button>

      <ul>
        {ativos.map((a) => (
          <li key={a.id}>{a.nome}</li>
        ))}
      </ul>
    </div>
  );
}