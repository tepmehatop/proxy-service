import express from 'express';
import axios from 'axios';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const STAND_URLS: Record<string, string> = {
  mock: 'http://localhost:4000',
  test: 'https://test.example.com',
  dev: 'https://dev.example.com',
  load: 'https://load.example.com'
};

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

interface Session {
  targetUrl: string;
  token: string;
  user: string;
  role: string;
  stand: string;
  createdAt: number;
}

const SESSIONS_FILE = './sessions.json';
const SESSION_TTL = 10 * 24 * 60 * 60 * 1000; // 10 дней

function loadSessions(): Map<string, Session> {
  try {
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    const data: Record<string, Session> = JSON.parse(raw);
    const now = Date.now();
    const map = new Map<string, Session>();
    for (const [sid, s] of Object.entries(data)) {
      if (now - s.createdAt < SESSION_TTL) {
        map.set(sid, s);
      }
    }
    console.log(`📂 Загружено сессий: ${map.size}`);
    return map;
  } catch {
    return new Map<string, Session>();
  }
}

function saveSessions() {
  try {
    const obj = Object.fromEntries(sessions);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('⚠️ Не удалось сохранить сессии:', e);
  }
}

const sessions = loadSessions();

function getProxySid(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === 'proxy-sid') return part.slice(eq + 1).trim() || null;
  }
  return null;
}

// Главная страница
app.get('/', (req, res) => {
  const users = Object.keys(USER_TOKENS);

  res.send(`<!DOCTYPE html>
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
    <form id="form">
      <div class="form-group">
        <label for="stand">Стенд:</label>
        <select id="stand" required>
          <option value="">Выберите стенд</option>
          <option value="mock">Mock (localhost:4000)</option>
          <option value="test">Тест</option>
          <option value="dev">Разработка</option>
          <option value="load">Нагрузка</option>
        </select>
      </div>
      <div class="form-group">
        <label for="user">Имя:</label>
        <select id="user" required>
          <option value="">Выберите пользователя</option>
          ${users.map(u => `<option value="${u}">${u}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="role">Роль:</label>
        <select id="role" required disabled>
          <option value="">Сначала выберите пользователя</option>
        </select>
      </div>
      <button type="submit" id="btn" disabled>Поехали! 🎯</button>
    </form>
    <div class="info">
      <p><strong>Инструкция:</strong></p>
      <p>1. Выберите стенд</p>
      <p>2. Выберите пользователя</p>
      <p>3. Выберите роль</p>
      <p>4. Нажмите "Поехали!"</p>
    </div>
  </div>
  <script>
    const tokens = ${JSON.stringify(USER_TOKENS)};
    const stand = document.getElementById('stand');
    const user = document.getElementById('user');
    const role = document.getElementById('role');
    const btn = document.getElementById('btn');
    const form = document.getElementById('form');
    
    user.addEventListener('change', () => {
      role.innerHTML = '<option value="">Выберите роль</option>';
      if (user.value && tokens[user.value]) {
        Object.keys(tokens[user.value]).forEach(r => {
          const opt = document.createElement('option');
          opt.value = r;
          opt.textContent = r;
          role.appendChild(opt);
        });
        role.disabled = false;
      } else {
        role.disabled = true;
      }
      validate();
    });
    
    function validate() {
      btn.disabled = !(stand.value && user.value && role.value);
    }
    
    stand.addEventListener('change', validate);
    role.addEventListener('change', validate);
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Загрузка...';
      
      try {
        const resp = await fetch('/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stand: stand.value,
            user: user.value,
            role: role.value
          })
        });
        
        const data = await resp.json();
        
        if (resp.ok) {
          window.location.href = data.url;
        } else {
          alert('Ошибка: ' + data.error);
          btn.disabled = false;
          btn.textContent = 'Поехали! 🎯';
        }
      } catch (err) {
        alert('Ошибка: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Поехали! 🎯';
      }
    });
  </script>
</body>
</html>`);
});

// Создание сессии
app.post('/create-session', (req, res) => {
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
    return res.status(400).json({ error: 'Нет токена для этой роли' });
  }

  const sid = Math.random().toString(36).substr(2, 9) +
      Math.random().toString(36).substr(2, 9);

  sessions.set(sid, { targetUrl, token, user, role, stand, createdAt: Date.now() });
  saveSessions();

  console.log(`\n✅ Сессия создана:`);
  console.log(`   ID: ${sid}`);
  console.log(`   Пользователь: ${user}`);
  console.log(`   Роль: ${role}`);
  console.log(`   Стенд: ${stand}`);
  console.log(`   URL: ${targetUrl}\n`);

  res.cookie('proxy-sid', sid, {
    maxAge: Math.floor(SESSION_TTL / 1000),
    path: '/',
    sameSite: 'lax',
    httpOnly: false
  });
  res.json({ url: `/p/${sid}/` });
});

// Прокси
app.options('/p/:sid/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

app.all('/p/:sid/*', async (req, res) => {
  const sid = req.params.sid;
  const session = sessions.get(sid);

  if (!session) {
    return res.status(404).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Сессия не найдена</h1>
          <p><a href="/">Вернуться на главную</a></p>
        </body>
      </html>
    `);
  }

  // req.url содержит путь + query string, req.path — только путь
  const fullPath = req.url.replace(`/p/${sid}`, '');
  const url = session.targetUrl + fullPath;

  console.log(`📡 ${req.method} ${url}`);

  try {
    const headers: any = {
      'Authorization': session.token,
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
      'Accept': req.headers['accept'] || '*/*'
    };

    if (req.headers['accept-language']) {
      headers['Accept-Language'] = req.headers['accept-language'];
    }
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers['cookie']) {
      headers['Cookie'] = req.headers['cookie'];
    }
    if (req.headers['referer']) {
      headers['Referer'] = session.targetUrl;
    }

    const response = await axios({
      method: req.method as any,
      url: url,
      headers: headers,
      data: req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      maxRedirects: 5,
      timeout: 30000
    });

    console.log(`✅ ${response.status}`);

    // Редиректы
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      const loc = response.headers.location;
      if (loc.startsWith('/')) {
        return res.redirect(response.status, `/p/${sid}${loc}`);
      }
    }

    // Копируем заголовки
    const skip = ['content-encoding', 'transfer-encoding', 'connection',
      'content-security-policy', 'x-frame-options',
      'content-security-policy-report-only'];

    for (const key in response.headers) {
      if (!skip.includes(key.toLowerCase())) {
        try {
          res.setHeader(key, response.headers[key]);
        } catch (e) {
          // ignore
        }
      }
    }

    // Добавляем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

    const ct = response.headers['content-type'] || '';

    // Определяем хост динамически для Docker
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const proxyBase = `${protocol}://${host}`;

    // HTML
    if (ct.includes('text/html')) {
      let html = response.data.toString('utf-8');
      const origin = new URL(session.targetUrl).origin;

      // Замена абсолютных URL
      html = html.split(origin).join(`${proxyBase}/p/${sid}`);

      // Замена относительных путей
      html = html.replace(/href="\/([^"]*)"/g, `href="${proxyBase}/p/${sid}/$1"`);
      html = html.replace(/src="\/([^"]*)"/g, `src="${proxyBase}/p/${sid}/$1"`);
      html = html.replace(/action="\/([^"]*)"/g, `action="${proxyBase}/p/${sid}/$1"`);
      html = html.replace(/srcset="\/([^"]*)"/g, `srcset="${proxyBase}/p/${sid}/$1"`);

      // Замена url() в inline стилях
      html = html.replace(/url\(['"]?\/([^'")\s]+)['"]?\)/g, `url("${proxyBase}/p/${sid}/$1")`);

      // Base tag — используем regex чтобы не ловить '<base' внутри JS-кода/комментариев
      const base = `${proxyBase}/p/${sid}/`;
      if (!/<base[\s>]/i.test(html)) {
        html = html.replace('<head>', `<head><base href="${base}">`);
      }

      // Скрипт перехвата
      const script = `
<script>
(function() {
  const orig_fetch = window.fetch;
  const orig_xhr = XMLHttpRequest.prototype.open;
  const sid = '${sid}';
  const base = '${proxyBase}/p/' + sid;
  const target = '${origin}';
  const prefix = '/p/' + sid;

  // Убираем proxy prefix из location.pathname чтобы SPA-роутер видел обычные пути (/orders/ вместо /p/sid/orders/)
  var curPath = location.pathname;
  if (curPath.startsWith(prefix)) {
    var realPath = curPath.slice(prefix.length) || '/';
    history.replaceState(history.state, document.title, realPath + location.search + location.hash);
  }

  function fix(url) {
    if (!url) return url;
    url = String(url);
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('mailto:') || url.startsWith('#')) return url;
    if (url.startsWith(base)) return url;
    if (url.startsWith(target)) return url.replace(target, base);
    if (url.startsWith('/')) return base + url;
    if (!url.startsWith('http')) {
      try {
        const resolved = new URL(url, location.href).href;
        if (resolved.startsWith(base)) return resolved;
        if (resolved.startsWith(target)) return resolved.replace(target, base);
        return resolved;
      } catch(e) { return url; }
    }
    return url;
  }

  window.fetch = function(url, opts) {
    return orig_fetch.call(this, fix(url), opts);
  };

  XMLHttpRequest.prototype.open = function(method, url) {
    const args = Array.prototype.slice.call(arguments);
    args[1] = fix(url);
    return orig_xhr.apply(this, args);
  };
})();
</script>`;

      html = html.replace('</head>', script + '</head>');
      return res.status(response.status).send(html);
    }

    // CSS
    if (ct.includes('text/css')) {
      let css = response.data.toString('utf-8');
      const origin = new URL(session.targetUrl).origin;

      // Замена абсолютных URL
      css = css.split(origin).join(`${proxyBase}/p/${sid}`);

      // Замена url() в CSS
      css = css.replace(/url\(['"]?\/([^'")\s]+)['"]?\)/g, `url("${proxyBase}/p/${sid}/$1")`);

      return res.status(response.status).send(css);
    }

    // JS/JSON
    if (ct.includes('javascript') || ct.includes('json')) {
      let content = response.data.toString('utf-8');
      const origin = new URL(session.targetUrl).origin;
      content = content.split(origin).join(`${proxyBase}/p/${sid}`);
      return res.status(response.status).send(content);
    }

    // Шрифты и изображения (бинарные данные)
    if (ct.includes('font') || ct.includes('woff') || ct.includes('ttf') ||
        ct.includes('image') || ct.includes('png') || ct.includes('jpg') ||
        ct.includes('jpeg') || ct.includes('svg') || ct.includes('gif') ||
        ct.includes('ico') || ct.includes('webp')) {
      return res.status(response.status).send(response.data);
    }

    // Остальное
    res.status(response.status).send(response.data);

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Ошибка</h1>
          <p>${error.message}</p>
          <p><a href="/">Вернуться</a></p>
        </body>
      </html>
    `);
  }
});

// Catch-all: восстановление сессии по cookie при refresh/дубликате вкладки
app.all('*', (req, res) => {
  const sid = getProxySid(req.headers['cookie']);
  if (sid && sessions.has(sid)) {
    console.log(`🔄 Редирект ${req.url} → /p/${sid}${req.url}`);
    return res.redirect(302, `/p/${sid}${req.url}`);
  }
  return res.redirect(302, '/');
});

// Запуск
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     🚀 PROXY SERVICE ЗАПУЩЕН 🚀      ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`📍 http://localhost:${PORT}\n`);
  console.log(`📋 Стендов: ${Object.keys(STAND_URLS).length}`);
  console.log(`📋 Пользователей: ${Object.keys(USER_TOKENS).length}\n`);
});