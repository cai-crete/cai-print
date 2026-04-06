import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

// CORS 설정 미들웨어 추가
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

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

// 이미지 라이브러리 목록 API 추가 (유형 분석 로직 확장)
app.get('/api/list-images', (req, res) => {
    const LIB_DIR = path.join(__dirname, 'public', 'image library');
    const categories = ['A', 'B', 'C', 'D'];
    const result: Record<string, any[]> = {};

    try {
        categories.forEach(cat => {
            const dirPath = path.join(LIB_DIR, cat);
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                const items = files
                    .filter(file => /\.(png|jpe?g|webp)$/i.test(file))
                    .map(file => {
                        const lowFile = file.toLowerCase();
                        let type = 'Image';
                        let tag = '[TAG: DIA]';
                        let priority = 99;

                        if (lowFile.includes('bird') || lowFile.includes('birdseye') || lowFile.includes('조감도')) {
                            type = 'Bird\'s Eye View'; tag = '[TAG: BEV]'; priority = 1;
                        } else if (lowFile.includes('perspective view') || lowFile.includes('투시도')) {
                            type = 'Perspective View'; tag = '[TAG: FPV]'; priority = 2;
                        } else if (lowFile.includes('eye level') || lowFile.includes('eyelevel')) {
                            type = 'Eye Level View'; tag = '[TAG: FPV]'; priority = 2;
                        } else if (lowFile.includes('low angle') || lowFile.includes('lowangle')) {
                            type = 'Low Angle View'; tag = '[TAG: LAV]'; priority = 2;
                        } else if (lowFile.includes('plan') || lowFile.includes('floor') || lowFile.includes('평면')) {
                            type = 'Floor Plan'; tag = '[TAG: PLN]'; priority = 3;
                        } else if (lowFile.includes('elevation') || lowFile.includes('입면')) {
                            type = 'Elevation'; tag = '[TAG: ELV]'; priority = 3;
                        } else if (lowFile.includes('section') || lowFile.includes('단면')) {
                            type = 'Section'; tag = '[TAG: SEC]'; priority = 3;
                        } else if (lowFile.includes('diagram') || lowFile.includes('다이어그램')) {
                            type = 'Diagram'; tag = '[TAG: DIA]'; priority = 4;
                        } else if (lowFile.includes('perspective image') || lowFile.includes('내부투시')) {
                            type = 'Perspective Image'; tag = '[TAG: INT]'; priority = 5;
                        } else if (lowFile.includes('site') || lowFile.includes('master') || lowFile.includes('배치')) {
                            type = 'Master Plan'; tag = '[TAG: MST]'; priority = 3;
                        }

                        return {
                            src: `/image library/${cat}/${file}`,
                            type: type,
                            tag: tag,
                            priority: priority
                        };
                    });
                
                // 정렬: 우선순위(조감도->뷰->도면->다이어그램->내부투시) 순, 그 다음 파일명 순
                items.sort((a, b) => a.priority - b.priority || a.src.localeCompare(b.src));
                result[cat] = items;
            } else {
                result[cat] = [];
            }
        });
        res.json(result);
    } catch (error) {
        console.error('Failed to list images:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
