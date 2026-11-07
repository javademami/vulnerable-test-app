// ==========================================
// ⚠️ WARNING: THIS IS A DELIBERATELY VULNERABLE APP FOR TESTING ⚠️
// ==========================================

import React, { useState } from 'react';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

// [BUG 1: Hardcoded Secret in Frontend]
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret_key_here";
const supabase = createClient("https://xyz.supabase.co", SUPABASE_SERVICE_KEY);

const app = express();
app.use(express.json());

// ==========================================
// 🏗️ BACKEND: SPAGHETTI CODE & SECURITY FLAWS
// ==========================================

// [BUG 2: SQL Injection & Missing Auth]
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  // This is vulnerable to SQL Injection because it concatenates strings directly
  const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
  const { data, error } = await supabase.rpc('execute_raw_sql', { query_string: query });
  
  if (error) return res.status(500).json({ error: error.message });
  
  // [BUG 3: Hardcoded Admin Credentials]
  if (email === "admin@site.com" && password === "SuperSecret123!") {
    return res.json({ role: "admin", token: "hardcoded-jwt-token" });
  }
  
  res.json({ data });
});

// [BUG 4: Insecure Direct Object Reference (IDOR)]
app.get('/api/user/:id', async (req, res) => {
  // Anyone can change the ID in the URL and see other users' data
  const { data, error } = await supabase.from('users').select('*').eq('id', req.params.id).single();
  res.json(data);
});

// [BUG 5: Remote Code Execution (RCE)]
app.post('/api/calculate', (req, res) => {
  const { formula } = req.body;
  try {
    // Using eval on user input is extremely dangerous
    const result = eval(formula); 
    res.json({ result });
  } catch (e) {
    res.status(400).json({ error: "Invalid formula" });
  }
});

// [BUG 6: Command Injection]
app.post('/api/export', (req, res) => {
  const { filename } = req.body;
  const { exec } = require('child_process');
  // Passing unsanitized input to shell
  exec(`tar -czf /tmp/${filename}.tar.gz /var/www/data`, (err, stdout) => {
    if (err) return res.status(500).send("Export failed");
    res.send("Exported successfully");
  });
});

// ==========================================
// 🎨 FRONTEND: HUGE UI FILE & LOGIC FLAWS
// ==========================================

export default function Dashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userData, setUserData] = useState(null);
  const [searchId, setSearchId] = useState('');
  const [formula, setFormula] = useState('2+2');
  const [result, setResult] = useState(null);
  
  // [BUG 7: XSS Vulnerability]
  const renderWelcomeMessage = () => {
    // Using dangerouslySetInnerHTML with unsanitized input
    return <div dangerouslySetInnerHTML={{ __html: `Welcome back, ${email}!` }} />;
  };

  const handleLogin = async () => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    setUserData(data);
  };

  const handleSearch = async () => {
    const res = await fetch(`/api/user/${searchId}`);
    const data = await res.json();
    setUserData(data);
  };

  const handleCalculate = async () => {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formula })
    });
    const data = await res.json();
    setResult(data.result);
  };

  // [BUG 8: Spaghetti Code / God Component]
  // This component is doing way too much. It handles Auth, Search, API calls, and UI.
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Login Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Login</h2>
          {renderWelcomeMessage()}
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 w-full mb-2"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full mb-2"
          />
          <button onClick={handleLogin} className="bg-blue-500 text-white p-2 rounded">Login</button>
        </div>

        {/* Search Section (IDOR) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Search User Data</h2>
          <input 
            type="text" 
            placeholder="Enter User ID" 
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="border p-2 w-full mb-2"
          />
          <button onClick={handleSearch} className="bg-green-500 text-white p-2 rounded">Search</button>
          {userData && <pre className="mt-4 bg-gray-100 p-4 rounded">{JSON.stringify(userData, null, 2)}</pre>}
        </div>

        {/* Calculator Section (RCE) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Calculator</h2>
          <input 
            type="text" 
            placeholder="Enter formula (e.g., 2+2)" 
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            className="border p-2 w-full mb-2"
          />
          <button onClick={handleCalculate} className="bg-purple-500 text-white p-2 rounded">Calculate</button>
          {result !== null && <div className="mt-4 font-bold text-xl">Result: {result}</div>}
        </div>

        {/* Lots of duplicated UI code to look like spaghetti */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Export Data</h2>
          <button className="bg-gray-800 text-white p-2 rounded">Export as ZIP</button>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">System Settings</h2>
          <p className="text-gray-500">Settings are not implemented yet.</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Activity Log</h2>
          <p className="text-gray-500">No activity recorded.</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Billing</h2>
          <p className="text-gray-500">Billing module under construction.</p>
        </div>

      </div>
    </div>
  );
}
