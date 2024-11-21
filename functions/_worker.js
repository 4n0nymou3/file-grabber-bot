export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method === 'POST') {
        const reqBody = await request.json();
        console.log('Request received:', { 
          method: request.method,
          body: JSON.stringify(reqBody, null, 2)
        });

        if (!env.TELEGRAM_TOKEN) {
          throw new Error('TELEGRAM_TOKEN environment variable is not set');
        }

        const chatId = reqBody.message?.chat?.id;
        if (!chatId) {
          throw new Error('Chat ID not found in request');
        }

        let botResponses = [];
        
        if (reqBody.message.text === '/start') {
          botResponses.push({
            type: 'text',
            content: `
🌟 *به ربات دانلودر فایل خوش آمدید* 🌟

این ربات می‌تواند فایل‌های شما را دانلود و ارسال کند\.

📝 *راهنمای استفاده*:
1\. لینک فایل را ارسال کنید
2\. ربات فایل را دانلود و ارسال می‌کند
3\. فایل‌های بزرگ به چند بخش تقسیم می‌شوند
4\. دستورالعمل ترکیب فایل‌ها ارائه خواهد شد

⚠️ *محدودیت‌ها*:
• حداکثر حجم فایل: 1\.5 گیگابایت
• حجم هر بخش: 45 مگابایت

\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-

🌟 *Welcome to File Grabber Bot* 🌟

This bot can download and send your files\.

📝 *Instructions*:
1\. Send a file URL
2\. Bot will download and send the file
3\. Large files will be split into parts
4\. Merge instructions will be provided

⚠️ *Limitations*:
• Maximum file size: 1\.5 GB
• Each part: 45 MB`
          });
        }
        else if (reqBody.message.text && reqBody.message.text !== '/start') {
          const fileUrl = reqBody.message.text;
          
          if (!isValidUrl(fileUrl)) {
            botResponses.push({
              type: 'text',
              content: `
❌ *خطا*: آدرس نامعتبر

لطفاً یک لینک معتبر فایل ارسال کنید\.

\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-

❌ *Error*: Invalid URL

Please send a valid file URL\.`
            });
          } else {
            try {
              const MAX_FILE_SIZE = 1500 * 1024 * 1024; // 1.5 GB
              const CHUNK_SIZE = 45 * 1024 * 1024; // 45 MB

              const response = await fetch(fileUrl, { method: 'HEAD' });
              
              if (!response.ok) {
                throw new Error('Failed to access file');
              }

              const fileSize = parseInt(response.headers.get('content-length'));
              if (!fileSize) {
                throw new Error('Could not determine file size');
              }

              const fileName = new URL(fileUrl).pathname.split('/').pop() || 'downloaded_file';
              const fileSizeInMB = fileSize / (1024 * 1024);

              if (fileSize > MAX_FILE_SIZE) {
                botResponses.push({
                  type: 'text',
                  content: `
❌ *خطا*: حجم فایل بیش از حد مجاز

حداکثر حجم مجاز 1\.5 گیگابایت است\. حجم فایل شما ${fileSizeInMB.toFixed(2)} مگابایت است\.

\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-

❌ *Error*: File too large

Maximum allowed size is 1\.5 GB\. Your file is ${fileSizeInMB.toFixed(2)} MB\.`
                });
                return await sendResponsesToTelegram(botResponses, chatId, env.TELEGRAM_TOKEN);
              }

              botResponses.push({
                type: 'text',
                content: `
⏳ در حال دانلود *${escapeTelegramText(fileName)}*
حجم: ${fileSizeInMB.toFixed(2)} مگابایت

\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-

⏳ Downloading *${escapeTelegramText(fileName)}*
Size: ${fileSizeInMB.toFixed(2)} MB`
              });

              await sendResponsesToTelegram(botResponses, chatId, env.TELEGRAM_TOKEN);
              botResponses = [];

              if (fileSize <= CHUNK_SIZE) {
                const fileResponse = await fetch(fileUrl);
                if (!fileResponse.ok) {
                  throw new Error('Failed to download file');
                }
                
                const fileData = await fileResponse.arrayBuffer();
                await sendFileToTelegram(chatId, fileData, fileName, env.TELEGRAM_TOKEN);
                
                botResponses.push({
                  type: 'text',
                  content: `
✅ فایل با موفقیت ارسال شد\!

\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-

✅ File sent successfully\!`
                });
              } else {
                const chunks = Math.ceil(fileSize / CHUNK_SIZE);
                const fileNameBase = fileName.replace(/\.[^/.]+$/, '');
                const fileExt = fileName.split('.').pop() || '';

                botResponses.push({
                  type: 'text',
                  content: `
📦 فایل به ${chunks} قسمت تقسیم خواهد شد

\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-

📦 File will be split into ${chunks} parts`
                });

                await sendResponsesToTelegram(botResponses, chatId, env.TELEGRAM_TOKEN);
                botResponses = [];

                for (let i = 0; i < chunks; i++) {
                  const start = i * CHUNK_SIZE;
                  const end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
                  
                  const chunkResponse = await fetch(fileUrl, {
                    headers: { 'Range': `bytes=${start}-${end}` }
                  });

                  if (!chunkResponse.ok) {
                    throw new Error(`Failed to download part ${i + 1}`);
                  }

                  const chunkData = await chunkResponse.arrayBuffer();
                  const partFileName = `${fileNameBase}_part${i + 1}of${chunks}${fileExt ? '.' + fileExt : ''}`;
                  
                  await sendFileToTelegram(chatId, chunkData, partFileName, env.TELEGRAM_TOKEN);
                  
                  // Avoid rate limiting
                  if (i < chunks - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                  }
                }

                botResponses.push({
                  type: 'text',
                  content: `
📝 *راهنمای ترکیب فایل‌ها*

🪟 *ویندوز*:
1\. تمام فایل‌ها را در یک پوشه قرار دهید
2\. این دستور را در CMD اجرا کنید:
\`copy /b ${fileNameBase}_part*of${chunks}${fileExt ? '.' + fileExt : ''} "${fileName}"\`

🐧 *لینوکس/مک*:
1\. تمام فایل‌ها را در یک پوشه قرار دهید
2\. این دستور را در ترمینال اجرا کنید:
\`cat ${fileNameBase}_part*of${chunks}${fileExt ? '.' + fileExt : ''} > "${fileName}"\`

\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-

📝 *File Merge Instructions*

🪟 *Windows*:
1\. Put all files in one folder
2\. Run in CMD:
\`copy /b ${fileNameBase}_part*of${chunks}${fileExt ? '.' + fileExt : ''} "${fileName}"\`

🐧 *Linux/Mac*:
1\. Put all files in one folder
2\. Run in terminal:
\`cat ${fileNameBase}_part*of${chunks}${fileExt ? '.' + fileExt : ''} > "${fileName}"\``
                });
              }
            } catch (error) {
              console.error('Download error:', error);
              botResponses.push({
                type: 'text',
                content: `
❌ *خطا*: ${escapeTelegramText(error.message)}

لطفاً دوباره تلاش کنید\.

\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-

❌ *Error*: ${escapeTelegramText(error.message)}

Please try again\.`
              });
            }
          }
        }

        if (botResponses.length > 0) {
          await sendResponsesToTelegram(botResponses, chatId, env.TELEGRAM_TOKEN);
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

async function sendResponsesToTelegram(responses, chatId, token) {
  for (const response of responses) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: response.content,
      parse_mode: 'MarkdownV2'
    };

    try {
      const result = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!result.ok) {
        const error = await result.json();
        throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
      }

      // Add a small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }
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

function escapeTelegramText(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
  }
