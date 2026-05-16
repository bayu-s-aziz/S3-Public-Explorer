import express from 'express';
const app = express();
const PORT = 3000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'minimal' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MINIMAL Server running on port ${PORT}`);
});
