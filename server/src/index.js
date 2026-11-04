import express from 'express';
import cors from 'cors';
const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'KENTY API' }));
app.get('/', (_req, res) => res.send('KENTY API is running'));
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`KENTY API listening on ${port}`));
