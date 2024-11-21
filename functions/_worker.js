export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (!env.TELEGRAM_TOKEN) {
      return new Response('TELEGRAM_TOKEN is not configured', {
        status: 500,
        headers: corsHeaders
      });
    }

    try {
      if (request.method === 'POST') {
        const reqBody = await request.json();
        console.log('Incoming webhook:', JSON.stringify(reqBody, null, 2));

        const chatId = reqBody.message?.chat?.id;
        if (!chatId) {
          throw new Error('Chat ID not found in request');
        }

        const messageText = reqBody.message?.text || '';
        
        if (messageText === '/start') {
          const welcomeMessage = `
🌟 <b>به ربات دانلودر فایل خوش آمدید</b> 🌟

این ربات می‌تواند فایل‌های شما را دانلود و ارسال کند.

📝 <b>راهنمای استفاده</b>:
1. لینک فایل را ارسال کنید
2. ربات فایل را دانلود و ارسال می‌کند
3. فایل‌های بزرگ به چند بخش تقسیم می‌شوند
4. دستورالعمل ترکیب فایل‌ها ارائه خواهد شد

⚠️ <b>محدودیت‌ها</b>:
• حداکثر حجم فایل: 1.5 گیگابایت
• حجم هر بخش: 45 مگابایت

------------------

🌟 <b>Welcome to File Grabber Bot</b> 🌟

This bot can download and send your files.

📝 <b>Instructions</b>:
1. Send a file URL
2. Bot will download and send the file
3. Large files will be split into parts
4. Merge instructions will be provided

⚠️ <b>Limitations</b>:
• Maximum file size: 1.5 GB
• Each part: 45 MB`;

          await sendTelegramMessage(chatId, welcomeMessage, env.TELEGRAM_TOKEN);
          
          return new Response('OK', {
            status: 200,
            headers: corsHeaders
          });
        }
        
        if (messageText && messageText !== '/start') {
          if (!isValidUrl(messageText)) {
            const errorMessage = `
❌ <b>خطا</b>: آدرس نامعتبر

لطفاً یک لینک معتبر فایل ارسال کنید.

------------------

❌ <b>Error</b>: Invalid URL

Please send a valid file URL.`;

            await sendTelegramMessage(chatId, errorMessage, env.TELEGRAM_TOKEN);
            return new Response('OK', { 
              status: 200,
              headers: corsHeaders
            });
          }

          try {
            const MAX_FILE_SIZE = 1500 * 1024 * 1024; // 1.5 GB
            const CHUNK_SIZE = 45 * 1024 * 1024; // 45 MB

            const response = await fetch(messageText, { 
              method: 'HEAD',
              headers: {
                'User-Agent': 'Telegram-File-Downloader-Bot/1.0'
              }
            });

            if (!response.ok) {
              throw new Error('Failed to access file');
            }

            const fileSize = parseInt(response.headers.get('content-length'));
            if (!fileSize) {
              throw new Error('Could not determine file size');
            }

            const fileName = new URL(messageText).pathname.split('/').pop() || 'downloaded_file';
            const fileSizeInMB = fileSize / (1024 * 1024);

            if (fileSize > MAX_FILE_SIZE) {
              const sizeErrorMessage = `
❌ <b>خطا</b>: حجم فایل بیش از حد مجاز

حداکثر حجم مجاز 1.5 گیگابایت است. حجم فایل شما ${fileSizeInMB.toFixed(2)} مگابایت است.

------------------

❌ <b>Error</b>: File too large

Maximum allowed size is 1.5 GB. Your file is ${fileSizeInMB.toFixed(2)} MB.`;

              await sendTelegramMessage(chatId, sizeErrorMessage, env.TELEGRAM_TOKEN);
              return new Response('OK', {
                status: 200,
                headers: corsHeaders
              });
            }

            const downloadStartMessage = `
⏳ در حال دانلود <b>${fileName}</b>
حجم: ${fileSizeInMB.toFixed(2)} مگابایت

------------------

⏳ Downloading <b>${fileName}</b>
Size: ${fileSizeInMB.toFixed(2)} MB`;

            await sendTelegramMessage(chatId, downloadStartMessage, env.TELEGRAM_TOKEN);

            if (fileSize <= CHUNK_SIZE) {
              const fileResponse = await fetch(messageText, {
                headers: {
                  'User-Agent': 'Telegram-File-Downloader-Bot/1.0'
                }
              });
              
              if (!fileResponse.ok) {
                throw new Error('Failed to download file');
              }

              const fileData = await fileResponse.arrayBuffer();
              await sendFileToTelegram(chatId, fileData, fileName, env.TELEGRAM_TOKEN);

              const successMessage = `
✅ فایل با موفقیت ارسال شد!

------------------

✅ File sent successfully!`;

              await sendTelegramMessage(chatId, successMessage, env.TELEGRAM_TOKEN);
            } else {
              const chunks = Math.ceil(fileSize / CHUNK_SIZE);
              const fileNameBase = fileName.replace(/\.[^/.]+$/, '');
              const fileExt = fileName.split('.').pop() || '';

              const splitMessage = `
📦 فایل به ${chunks} قسمت تقسیم خواهد شد

------------------

📦 File will be split into ${chunks} parts`;

              await sendTelegramMessage(chatId, splitMessage, env.TELEGRAM_TOKEN);

              for (let i = 0; i < chunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

                const chunkResponse = await fetch(messageText, {
                  headers: {
                    'Range': `bytes=${start}-${end}`,
                    'User-Agent': 'Telegram-File-Downloader-Bot/1.0'
                  }
                });

                if (!chunkResponse.ok) {
                  throw new Error(`Failed to download part ${i + 1}`);
                }

                const chunkData = await chunkResponse.arrayBuffer();
                const partFileName = `${fileNameBase}_part${i + 1}of${chunks}${fileExt ? '.' + fileExt : ''}`;

                await sendFileToTelegram(chatId, chunkData, partFileName, env.TELEGRAM_TOKEN);

                if (i < chunks - 1) {
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
              }

              const mergeInstructions = `
📝 <b>راهنمای ترکیب فایل‌ها</b>

🪟 <b>ویندوز</b>:
1. تمام فایل‌ها را در یک پوشه قرار دهید
2. این دستور را در CMD اجرا کنید:
<code>copy /b ${fileNameBase}_part*of${chunks}${fileExt ? '.' + fileExt : ''} "${fileName}"</code>

🐧 <b>لینوکس/مک</b>:
1. تمام فایل‌ها را در یک پوشه قرار دهید
2. این دستور را در ترمینال اجرا کنید:
<code>cat ${fileNameBase}_part*of${chunks}${fileExt ? '.' + fileExt : ''} > "${fileName}"</code>

------------------

📝 <b>File Merge Instructions</b>

🪟 <b>Windows</b>:
1. Put all files in one folder
2. Run in CMD:
<code>copy /b ${fileNameBase}_part*of${chunks}${fileExt ? '.' + fileExt : ''} "${fileName}"</code>

🐧 <b>Linux/Mac</b>:
1. Put all files in one folder
2. Run in terminal:
<code>cat ${fileNameBase}_part*of${chunks}${fileExt ? '.' + fileExt : ''} > "${fileName}"</code>`;

              await sendTelegramMessage(chatId, mergeInstructions, env.TELEGRAM_TOKEN);
            }
          } catch (error) {
            console.error('Download error:', error);
            
            const errorMessage = `
❌ <b>خطا</b>: ${error.message}

لطفاً دوباره تلاش کنید.

------------------

❌ <b>Error</b>: ${error.message}

Please try again.`;

            await sendTelegramMessage(chatId, errorMessage, env.TELEGRAM_TOKEN);
          }
        }

        return new Response('OK', {
          status: 200,
          headers: corsHeaders
        });
      }

      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders
      });
    } catch (error) {
      console.error('Request error:', error);
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
};

async function sendTelegramMessage(chatId, text, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function sendFileToTelegram(chatId, fileData, fileName, token) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', new Blob([fileData]), fileName);

  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to send file: ${JSON.stringify(error)}`);
  }

  return response.json();
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}