import app from './app';
import { initDatabase } from './db/schema';

const PORT = process.env.PORT || 3001;

initDatabase();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});