const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const url = `${env.SUPABASE_URL}/rest/v1/?apikey=${env.SUPABASE_KEY}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const spec = JSON.parse(data);
      fs.writeFileSync(path.join(__dirname, 'openapi_spec.json'), JSON.stringify(spec, null, 2));
      console.log("Successfully wrote OpenAPI spec. Paths available:");
      console.log(Object.keys(spec.paths).filter(p => p.startsWith('/rpc/')));
    } catch (e) {
      console.error("Failed to parse OpenAPI spec:", e);
      console.log("Raw data:", data);
    }
  });
}).on('error', (err) => {
  console.error("Error fetching spec:", err);
});
