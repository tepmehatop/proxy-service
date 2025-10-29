import express, { Request, Response } from 'express';
import axios from 'axios';
import { URL } from 'url';

const app = express();
const PORT = 3000;

// ============================================
// КОНФИГУРАЦИЯ - РЕДАКТИРУЙТЕ ЗДЕСЬ
// ============================================

// Ссылки на стенды
const STAND_URLS: Record<string, string> = {
  'test': 'https://test.example.com',
  'dev': 'https://dev.example.com',
  'load': 'https://load.example.com'
};

// Токены для каждого пользователя и роли
const USER_TOKENS: Record<string, Record<string, string>> = {
  'Алексей': {
    'Администратор': 'Bearer token_alexey_admin_123',
    'Менеджер': 'Bearer token_alexey_manager_456',
    'Пользователь': 'Bearer token_alexey_user_789'
  },
  'Мария': {
    'Администратор': 'Bearer token_maria_admin_123',
    'Менеджер': 'Bearer token_maria_manager_456',
    'Аналитик': 'Bearer token_maria_analyst_789'
  },
  'Дмитрий': {
    'Менеджер': 'Bearer token_dmitry_manager_123',
    'Разработчик': 'Bearer token_dmitry_dev_456',
    'Пользователь': 'Bearer token_dmitry_user_789'
  },
  'Екатерина': {
    'Администратор': 'Bearer token_ekaterina_admin_123',
    'Аналитик': 'Bearer token_ekaterina_analyst_456',
    'Пользователь': 'Bearer token_ekaterina_user_789'
  },
  'Иван': {
    'Разработчик': 'Bearer token_ivan_dev_123',
    'Менеджер': 'Bearer token_ivan_manager_456',
    'Пользователь': 'Bearer token_ivan_user_789'
  }
};

// ============================================
// КОНЕЦ КОНФИГУРАЦИИ
// ============================================

interface Session {
  targetUrl: string;
  token: string;
}

const sessions = new Map<string, Session>();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Главная страница
app.get('/', (req: Request, res: Response) => {
  const userNames = Object.keys(USER_TOKENS);

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Proxy Service</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
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
        .form-group { margin-bottom: 25px; }
        label {
          display: block;
          margin-bottom: 8px;
          color: #555;
          font-weight: 600;
          font-size: 14px;
        }
        select {
          width: 100%;
          padding: 12px 15px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        select:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
          opacity: 0.6;
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
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
            <label for="stand">Стенд:</label>
            <select id="stand" name="stand" required>
              <option value="">Выберите стенд</option>
              <option value="test">Тест</option>
              <option value="dev">Разработка</option>
              <option value="load">Нагрузка</option>
            </select>
          </div>
          <div class="form-group">
            <label for="user">Имя:</label>
            <select id="user" name="user" required>
              <option value="">Выберите пользователя</option>
              ${userNames.map(name => `<option value="${name}">${name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="role">Роль:</label>
            <select id="role" name="role" required disabled>
              <option value="">Сначала выберите пользователя</option>
            </select>
          </div>
          <button type="submit" id="submitBtn" disabled>Поехали! 🎯</button>
        </form>
        <div class="info">
          <p><strong>Как это работает:</strong></p>
          <p>1. Выберите стенд для работы</p>
          <p>2. Выберите своё имя</p>
          <p>3. Выберите роль</p>
          <p>4. Нажмите "Поехали!"</p>
        </div>
      </div>
      <script>
        const userTokens = ${JSON.stringify(USER_TOKENS)};
        const standSelect = document.getElementById('stand');
        const userSelect = document.getElementById('user');
        const roleSelect = document.getElementById('role');
        const submitBtn = document.getElementById('submitBtn');
        const form = document.getElementById('proxyForm');
        
        userSelect.addEventListener('change', () => {
          const selectedUser = userSelect.value;
          roleSelect.innerHTML = '<option value="">Выберите роль</option>';
          if (selectedUser && userTokens[selectedUser]) {
            const roles = Object.keys(userTokens[selectedUser]);
            roles.forEach(role => {
              const option = document.createElement('option');
              option.value = role;
              option.textContent = role;
              roleSelect.appendChild(option);
            });
            roleSelect.disabled = false;
          } else {
            roleSelect.disabled = true;
          }
          validateForm();
        });
        
        function validateForm() {
          const isValid = standSelect.value && userSelect.value && roleSelect.value;
          submitBtn.disabled = !isValid;
        }
        
        standSelect.addEventListener('change', validateForm);
        roleSelect.addEventListener('change', validateForm);
        
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const stand = standSelect.value;
          const user = userSelect.value;
          const role = roleSelect.value;
          submitBtn.disabled = true;
          submitBtn.textContent = 'Загрузка...';
          try {
            const response = await fetch('/create-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stand, user, role })
            });
            const data = await response.json();
            if (response.ok) {
              window.location.href = data.proxyUrl;
            } else {
              alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
              submitBtn.disabled = false;
              submitBtn.textContent = 'Поехали! 🎯';
            }
          } catch (error) {
            alert('Ошибка: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Поехали! 🎯';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Создание сессии
app.post('/create-session', (req: Request, res: Response) => {
  const { stand, user, role } = req.body;

  if (!stand || !user || !role) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  const targetUrl = STAND_URLS[stand];
  if (!targetUrl) {
    return res.status(400).json({ error: 'Неизвестный стенд' });
  }

  if (!USER_TOKENS[user]) {
    return res.status(400).json({ error: 'Неизвестный пользователь' });
  }

  const token = USER_TOKENS[user][role];
  if (!token) {
    return res.status(400).json({ error: 'У пользователя нет доступа к этой роли' });
  }

  const sessionId = Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

  sessions.set(sessionId, { targetUrl, token });

  console.log(`\n✅ Создана новая сессия:`);
  console.log(`   Пользователь: ${user}`);
  console.log(`   Роль: ${role}`);
  console.log(`   Стенд: ${stand}`);
  console.log(`   URL: ${targetUrl}`);
  console.log(`   Session ID: ${sessionId}\n`);

  res.json({ success: true, proxyUrl: `/p/${sessionId}/` });
});
// // Прокси для HTTP запросов
// app.options('/p/:sessionId*', (req: Request, res: Response) => {
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
//   res.setHeader('Access-Control-Allow-Headers', '*');
//   res.setHeader('Access-Control-Max-Age', '86400');
//   res.status(200).end();
// });
// Прокси - ИСПРАВЛЕНА ОБРАБОТКА ПУТЕЙ
app.all('/p/:sessionId*', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Сессия не найдена</h1>
          <p>Вернитесь на <a href="/">главную страницу</a></p>
        </body>
      </html>
    `);
  }

  // ИСПРАВЛЕНИЕ: правильное извлечение пути
  // req.params[0] содержит всё после /p/:sessionId включая /
  const pathAfterSession = req.params[0] || '';
  const fullPath = pathAfterSession.startsWith('/') ? pathAfterSession : '/' + pathAfterSession;

  const fullUrl = session.targetUrl + fullPath;
  console.log(`📡 ${req.method} ${fullUrl}`);

  try {
    const headers: any = {
      'Authorization': session.token,
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
      'Accept': req.headers['accept'] || '*/*'
      // 'Accept-Encoding': 'identity'
    };

    if (req.headers['accept-language']) headers['Accept-Language'] = req.headers['accept-language'];
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers['cookie']) headers['Cookie'] = req.headers['cookie'];
    // if (req.headers['referer']) {
    //   // Заменяем referer на целевой домен
    //   headers['Referer'] = session.targetUrl;
    // }
    // if (req.headers['origin']) {
    //   headers['Origin'] = new URL(session.targetUrl).origin;
    // }
    console.log(`🔑 Authorization: ${session.token.substring(0, 30)}...`);

    const response = await axios({
      method: req.method,
      url: fullUrl,
      headers: headers,
      data: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      maxRedirects: 0,
      timeout: 30000
    });

    console.log(`✅ ${response.status} ${response.statusText}`);

    // Обработка редиректов
    if (response.status >= 300 && response.status < 400 && response.headers['location']) {
      const redirectUrl = response.headers['location'];
      try {
        const redirectParsed = new URL(redirectUrl, session.targetUrl);
        const targetOrigin = new URL(session.targetUrl).origin;
        if (redirectParsed.origin === targetOrigin) {
          const newPath = redirectParsed.pathname + redirectParsed.search + redirectParsed.hash;
          return res.redirect(response.status, `/p/${sessionId}${newPath}`);
        }
      } catch (e) {
        if (redirectUrl.startsWith('/')) {
          return res.redirect(response.status, `/p/${sessionId}${redirectUrl}`);
        }
      }
    }

    // Устанавливаем заголовки
    Object.keys(response.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      const skipHeaders = ['content-encoding', 'transfer-encoding', 'connection',
        'content-security-policy', 'x-frame-options',
        'content-security-policy-report-only'];
      if (!skipHeaders.includes(lowerKey)) {
        try {
          res.setHeader(key, response.headers[key]);
        } catch (e) {
          // Игнорируем ошибки
        }
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const contentType = response.headers['content-type'] || '';

    // Обработка HTML
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');
      const targetOrigin = new URL(session.targetUrl).origin;

      // Заменяем абсолютные URL
      html = html.split(targetOrigin).join(`http://localhost:${PORT}/p/${sessionId}`);

      // Заменяем относительные пути с /
      html = html.replace(/href="\/([^"]*)"/g, `href="http://localhost:${PORT}/p/${sessionId}/$1"`);
      html = html.replace(/src="\/([^"]*)"/g, `src="http://localhost:${PORT}/p/${sessionId}/$1"`);
      html = html.replace(/action="\/([^"]*)"/g, `action="http://localhost:${PORT}/p/${sessionId}/$1"`);

      // Добавляем base tag для корректной работы
      const currentPath = new URL(fullUrl).pathname;
      const baseDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
      const baseHref = `http://localhost:${PORT}/p/${sessionId}${baseDir}`;

      if (html.indexOf('<base') === -1) {
        html = html.replace('<head>', `<head><base href="${baseHref}">`);
      }

      // Инжектим скрипт перехвата
      const script = `
<script>
(function() {
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const sid = '${sessionId}';
  const base = 'http://localhost:${PORT}/p/' + sid;
  const target = '${targetOrigin}';
  
  function fixUrl(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith(base)) return url;
    if (url.startsWith(target)) return url.replace(target, base);
    if (url.startsWith('/')) return base + url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const p = window.location.pathname;
      const d = p.substring(0, p.lastIndexOf('/') + 1);
      return base + d + url;
    }
    return url;
  }
  
  window.fetch = function(url, opts) {
    const fixed = fixUrl(url);
    console.log('Fetch:', url, '->', fixed);
    return originalFetch(fixed, opts || {});
  };
  
  XMLHttpRequest.prototype.open = function(method, url) {
    const fixed = fixUrl(url);
    console.log('XHR:', url, '->', fixed);
    const args = [method, fixed];
    for (let i = 2; i < arguments.length; i++) args.push(arguments[i]);
    return originalOpen.apply(this, args);
  };
})();
</script>`;

      html = html.replace('</head>', script + '</head>');

      return res.status(response.status).send(html);
    }

    // Обработка JavaScript/JSON
    if (contentType.includes('javascript') || contentType.includes('json')) {
      let content = response.data.toString('utf-8');
      const targetOrigin = new URL(session.targetUrl).origin;
      content = content.split(targetOrigin).join(`http://localhost:${PORT}/p/${sessionId}`);
      return res.status(response.status).send(content);
    }

    // Все остальное
    res.status(response.status).send(response.data);

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    const errorPage = `
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Ошибка прокси</h1>
          <p>${error.message}</p>
          <p><a href="/">Вернуться на главную</a></p>
        </body>
      </html>
    `;
    res.status(500).send(errorPage);
  }
});

// Запуск
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     🚀 PROXY SERVICE ЗАПУЩЕН 🚀      ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`📍 Откройте: \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
  console.log('📋 Конфигурация:');
  console.log(`   Стендов: ${Object.keys(STAND_URLS).length}`);
  console.log(`   Пользователей: ${Object.keys(USER_TOKENS).length}\n`);
  console.log('Для остановки нажмите Ctrl+C\n');
});