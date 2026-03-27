import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

const SAVE_DIR = 'C:\\Users\\Crete_\\Pictures\\cai-print';

app.post('/api/save-images', async (req, res) => {
  const { title, images, format } = req.body;

  try {
    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const folderName = `${title || 'document'}_${timestamp}`;
    const targetPath = path.join(SAVE_DIR, folderName);
    
    fs.mkdirSync(targetPath, { recursive: true });

    for (let i = 0; i < images.length; i++) {
        const base64Data = images[i].replace(/^data:image\/\w+;base64,/, "");
        const fileName = `page_${i + 1}.${format || 'png'}`;
        fs.writeFileSync(path.join(targetPath, fileName), base64Data, 'base64');
    }

    console.log(`Saved ${images.length} images to ${targetPath}`);
    res.json({ success: true, path: targetPath });
  } catch (error) {
    console.error('Failed to save images:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Image save server running at http://localhost:${PORT}`);
});
