import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const API_BASE = 'https://hrms-platform-ie92.onrender.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('hrms_token') || null);
  const [loading, setLoading] = useState(true);

  // Load profile on load if token exists
  useEffect(() => {
    async function loadMe() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setTenant(data.tenant);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Failed to load user profile on startup:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMe();
  }, [token]);

  // Login handler
  async function login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      localStorage.setItem('hrms_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setTenant(data.tenant);
      return data;
    } catch (err) {
      throw err;
    }
  }

  // Tenant + Admin register handler
  async function registerTenant(companyName, domain, adminName, adminEmail, adminPassword) {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, domain, adminName, adminEmail, adminPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      return data;
    } catch (err) {
      throw err;
    }
  }

  // Logout handler
  function logout() {
    localStorage.removeItem('hrms_token');
    setToken(null);
    setUser(null);
    setTenant(null);
  }

  // Configured fetch wrapper that auto-injects JWT headers
  async function apiCall(endpoint, options = {}) {
    const headers = options.headers || {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Default to JSON body parsing if object passed
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    
    if (response.status === 401 || response.status === 403) {
      // Automatic logout if credentials expired
      logout();
    }
    
    return response;
  }

  const value = {
    user,
    tenant,
    token,
    loading,
    login,
    registerTenant,
    logout,
    apiCall
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
