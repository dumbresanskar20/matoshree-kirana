async function run() {
  try {
    // 1. Log in to get developer token
    const loginRes = await fetch('http://localhost:5000/api/developer/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'developer@mess.com',
        password: 'Developer@123'
      })
    });
    const { token } = await loginRes.json();
    
    // 2. Query the tables structural schema definition
    const tablesRes = await fetch('http://localhost:5000/api/developer/database/tables', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await tablesRes.json();
    console.log('STATUS:', tablesRes.status);
    console.log('Tables count:', data.tables?.length);
    if (data.tables?.length > 0) {
      console.log('Columns for first table:', data.tables[0].name, 'count:', data.tables[0].columns?.length);
    }
  } catch (err) {
    console.log('ERROR:', err.message);
  }
}
run();
