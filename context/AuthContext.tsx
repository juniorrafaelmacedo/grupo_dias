import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  usersList: User[]; // Lista de usuários para o admin gerenciar
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  addUser: (user: User) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Refs para controle de inatividade
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutos em milissegundos

  // Load Session and Listen for Changes
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // If we already have the user loaded and the ID matches, we might skip fetching, 
        // but fetching ensures roles are up to date.
        // We do not set loading to true here to avoid flashing, as fetchProfile handles it gracefully.
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- LÓGICA DE INATIVIDADE ---
  useEffect(() => {
    if (!user) return; // Só monitora se estiver logado

    const handleLogoutInactivity = () => {
      logout();
      alert("Sessão encerrada por inatividade (10 minutos). Por favor, faça login novamente.");
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleLogoutInactivity, INACTIVITY_LIMIT);
    };

    // Eventos que reiniciam o timer
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Throttle simples para evitar chamar resetTimer excessivamente no mousemove
    let isThrottled = false;
    const handleActivity = () => {
      if (!isThrottled) {
        resetTimer();
        isThrottled = true;
        setTimeout(() => { isThrottled = false; }, 1000); // Só reseta a cada 1 segundo no máximo
      }
    };

    // Adiciona listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Inicia o timer
    resetTimer();

    // Cleanup ao desmontar ou deslogar
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [user]); // Recria o listener quando o user muda (log in/out)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        setUser({
          id: data.id,
          username: data.username,
          name: data.name,
          role: data.role
        });
        
        // Se for admin, carrega a lista de todos usuários
        if (data.role === 'admin') {
            fetchAllUsers();
        }
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
        setUsersList(data.map(p => ({
            id: p.id,
            username: p.username,
            name: p.name,
            role: p.role
        })));
    }
  };

  const login = async (username: string, password: string) => {
    // TRUQUE: Supabase pede email, mas seu sistema usa username.
    // Vamos padronizar um sufixo de email fake para login transparente.
    const email = username.includes('@') ? username : `${username}@dias.com.br`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // CRITICAL FIX: Ensure profile is loaded before returning success
    // This prevents the UI from redirecting before the 'user' state is populated
    if (data.session) {
      await fetchProfile(data.session.user.id);
    }

    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    if (timerRef.current) clearTimeout(timerRef.current);
    setUser(null);
  };

  const addUser = async (newUser: User) => {
    // ATENÇÃO: A criação de usuários no Supabase via Client-Side requer que o Auto Confirm esteja ligado
    // ou que o usuário verifique o email.
    // Para um admin criando outro user, o ideal é usar uma Supabase Edge Function, 
    // mas aqui faremos um signUp secundário (o que pode deslogar o admin se não configurado com cuidado)
    // OU simplesmente inserimos na tabela de profiles e pedimos pro usuário se cadastrar.
    //
    // Solução Simplificada para este demo: 
    // O Admin cria apenas o registro no banco 'profiles' e instruímos uso do painel Supabase para Auth,
    // OU usamos signUp que funciona se "Enable Email Confirm" estiver OFF no Supabase.
    
    const email = `${newUser.username}@dias.com.br`;
    
    // Isso é um hack de front-end. O correto seria uma API route.
    // Vamos alertar o usuário.
    alert("Em uma arquitetura segura, a criação de usuários deve ser feita no Painel do Supabase ou via API Backend.\n\n" + 
          `Crie o usuário no Supabase com email: ${email}\n` +
          `A senha: ${newUser.password}`);
  };

  const removeUser = async (id: string) => {
    // Frontend não pode deletar usuário do Auth sem service_role key.
    // Apenas deletamos do profile
    await supabase.from('profiles').delete().eq('id', id);
    setUsersList(prev => prev.filter(u => u.id !== id));
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    // Atualiza Profile
    const { error } = await supabase
      .from('profiles')
      .update({
         name: updates.name,
         role: updates.role,
         username: updates.username
      })
      .eq('id', id);

    if (!error) {
        setUsersList(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
        if (user?.id === id) {
            setUser(prev => prev ? { ...prev, ...updates } : null);
        }
    }
    
    if (updates.password) {
        if (user?.id === id) {
             await supabase.auth.updateUser({ password: updates.password });
        } else {
             alert("A alteração de senha de OUTROS usuários deve ser feita pelo Painel do Supabase.");
        }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, usersList, login, logout, addUser, removeUser, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};