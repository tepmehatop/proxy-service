import express, { Request, Response } from 'express';
import axios from 'axios';
import { URL } from 'url';

const app = express();
const PORT = 3000;

// Хранилище для конфигурации (в памяти)
const sessions = new Map<string, { targetUrl: string; token: string }>();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Главная страница с формой
app.get('/', (req: Request, res: Response) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Proxy Service</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
        }
        
        h1 {
          color: #333;
          margin-bottom: 30px;
          text-align: center;
          font-size: 28px;
        }
        
        .form-group {
          margin-bottom: 25px;
        }
        
        label {
          display: block;
          margin-bottom: 8px;
          color: #555;
          font-weight: 600;
          font-size: 14px;
        }
        
        input {
          width: 100%;
          padding: 12px 15px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.3s ease;
        }
        
        input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }
        
        button:active {
          transform: translateY(0);
        }
        
        .info {
          margin-top: 25px;
          padding: 15px;
          background: #f0f4ff;
          border-radius: 10px;
          border-left: 4px solid #667eea;
        }
        
        .info p {
          color: #555;
          font-size: 13px;
          margin-bottom: 5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Proxy Service</h1>
        
        <form id="proxyForm">
          <div class="form-group">
            <label for="url">Целевая ссылка:</label>
            <input 
              type="url" 
              id="url" 
              name="url" 
              placeholder="https://example.com/dashboard" 
              required
            >
          </div>
          
          <div class="form-group">
            <label for="token">Токен авторизации:</label>
            <input 
              type="text" 
              id="token" 
              name="token" 
              placeholder="Bearer your-token-here" 
              required
            >
          </div>
          
          <button type="submit">Поехали! 🎯</button>
        </form>
        
        <div class="info">
          <p><strong>Как это работает:</strong></p>
          <p>После нажатия "Поехали!" вы будете перенаправлены на целевую страницу через прокси.</p>
          <p>Все запросы автоматически получат ваш токен авторизации.</p>
        </div>
      </div>
      
      <script>
        const form = document.getElementById('proxyForm');
        
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const url = document.getElementById('url').value;
          const token = document.getElementById('token').value;
          
          try {
            const response = await fetch('/create-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url, token })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              // Перенаправляем на проксированную страницу
              window.location.href = data.proxyUrl;
            } else {
              alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
          } catch (error) {
            alert('Ошибка: ' + error.message);
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Создание сессии и возврат URL прокси
app.post('/create-session', (req: Request, res: Response) => {
    const { url, token } = req.body;

    if (!url || !token) {
        return res.status(400).json({ error: 'URL и токен обязательны' });
    }

    try {
        // Проверка валидности URL
        const parsedUrl = new URL(url);

        // Генерируем уникальный ID сессии
        const sessionId = Math.random().toString(36).substring(2, 15);

        // Сохраняем конфигурацию
        sessions.set(sessionId, {
            targetUrl: parsedUrl.origin,
            token: token
        });

        // Формируем URL для прокси
        const proxyPath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
        const proxyUrl = `/p/${sessionId}${proxyPath}`;

        res.json({
            success: true,
            proxyUrl: proxyUrl
        });
    } catch (error) {
        res.status(400).json({ error: 'Некорректный URL' });
    }
});

// Прокси для всех запросов
app.use('/p/:sessionId', async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Сессия не найдена</h1>
          <p>Вернитесь на <a href="/">главную страницу</a> и создайте новую сессию.</p>
        </body>
      </html>
    `);
    }

    // Получаем путь после /p/:sessionId
    const path = req.originalUrl.replace(`/p/${sessionId}`, '');
    const fullUrl = session.targetUrl + path;

    try {
        // Копируем заголовки из оригинального запроса
        const headers: any = {};

        // Копируем важные заголовки
        if (req.headers['accept']) headers['accept'] = req.headers['accept'];
        if (req.headers['accept-language']) headers['accept-language'] = req.headers['accept-language'];
        if (req.headers['user-agent']) headers['user-agent'] = req.headers['user-agent'];
        if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
        if (req.headers['referer']) {
            // Заменяем referer на целевой домен
            headers['referer'] = session.targetUrl;
        }

        // Добавляем токен авторизации
        headers['authorization'] = session.token;

        // Делаем запрос к целевому серверу
        const response = await axios({
            method: req.method,
            url: fullUrl,
            headers: headers,
            data: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            responseType: 'arraybuffer',
            validateStatus: () => true,
            maxRedirects: 0
        });

        // Обрабатываем редиректы
        if (response.status >= 300 && response.status < 400 && response.headers['location']) {
            const redirectUrl = response.headers['location'];

            // Если редирект относительный или на тот же домен
            if (redirectUrl.startsWith('/') || redirectUrl.startsWith(session.targetUrl)) {
                const newPath = redirectUrl.startsWith('/') ? redirectUrl : redirectUrl.replace(session.targetUrl, '');
                res.redirect(response.status, `/p/${sessionId}${newPath}`);
                return;
            }
        }

        // Копируем заголовки ответа
        Object.keys(response.headers).forEach(key => {
            if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
                res.setHeader(key, response.headers[key]);
            }
        });

        // Если это HTML, заменяем ссылки
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            let html = response.data.toString('utf-8');

            // Заменяем абсолютные URL на проксированные
            const urlPattern = new RegExp(session.targetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            html = html.replace(urlPattern, `http://localhost:${PORT}/p/${sessionId}`);

            // Заменяем относительные URL
            html = html.replace(
                /(href|src|action)="(\/[^"]+)"/g,
                `$1="http://localhost:${PORT}/p/${sessionId}$2"`
            );

            // Добавляем base tag для правильной обработки относительных путей
            html = html.replace(
                '<head>',
                `<head><base href="http://localhost:${PORT}/p/${sessionId}/">`
            );

            res.status(response.status).send(html);
        } else {
            // Для других типов контента просто возвращаем как есть
            res.status(response.status).send(response.data);
        }

    } catch (error: any) {
        console.error('Proxy error:', error.message);
        res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Ошибка прокси</h1>
          <p>${error.message}</p>
          <p><a href="/">Вернуться на главную</a></p>
        </body>
      </html>
    `);
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║     🚀 PROXY SERVICE ЗАПУЩЕН 🚀      ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`📍 Откройте в браузере: \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
    console.log('Для остановки нажмите Ctrl+C\n');
});