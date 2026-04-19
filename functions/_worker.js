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
        const userFirstName = reqBody.message?.from?.first_name || 'کاربر';
        const userLanguage = detectLanguage(messageText || reqBody.message?.from?.language_code || 'en');
        
        if (messageText === '/start') {
          const welcomeMessage = getWelcomeMessage(userFirstName);
          await sendTelegramMessage(chatId, welcomeMessage, env.TELEGRAM_TOKEN);
          
          return new Response('OK', {
            status: 200,
            headers: corsHeaders
          });
        }
        
        if (messageText === '/help') {
          const helpMessage = getHelpMessage(userLanguage);
          await sendTelegramMessage(chatId, helpMessage, env.TELEGRAM_TOKEN);
          
          return new Response('OK', {
            status: 200,
            headers: corsHeaders
          });
        }
        
        if (messageText === '/about') {
          const aboutMessage = getAboutMessage(userLanguage);
          await sendTelegramMessage(chatId, aboutMessage, env.TELEGRAM_TOKEN);
          
          return new Response('OK', {
            status: 200,
            headers: corsHeaders
          });
        }
        
        if (messageText && !messageText.startsWith('/')) {
          if (!isValidUrl(messageText)) {
            const errorMessage = getBilingualMessage(
              '❌ <b>خطا</b>: آدرس نامعتبر\n\nلطفاً یک لینک معتبر فایل ارسال کنید.',
              '❌ <b>Error</b>: Invalid URL\n\nPlease send a valid file URL.',
              userLanguage
            );

            await sendTelegramMessage(chatId, errorMessage, env.TELEGRAM_TOKEN);
            return new Response('OK', { 
              status: 200,
              headers: corsHeaders
            });
          }

          try {
            const MAX_FILE_SIZE = 49.9 * 1024 * 1024;
            const processingMessage = getBilingualMessage(
              '🔍 <b>در حال بررسی لینک...</b>',
              '🔍 <b>Analyzing link...</b>',
              userLanguage
            );
            
            const processingMsgResponse = await sendTelegramMessage(chatId, processingMessage, env.TELEGRAM_TOKEN);
            const processingMsgId = processingMsgResponse.result.message_id;

            const response = await fetch(messageText, { 
              method: 'HEAD',
              headers: {
                'User-Agent': 'Telegram-File-Downloader-Bot/1.0'
              }
            });

            if (!response.ok) {
              throw new Error(userLanguage === 'fa' ? 'دسترسی به فایل ممکن نیست' : 'Failed to access file');
            }

            const contentType = response.headers.get('content-type') || 'application/octet-stream';
            const fileSize = parseInt(response.headers.get('content-length'));
            
            if (!fileSize) {
              throw new Error(userLanguage === 'fa' ? 'تعیین حجم فایل ممکن نیست' : 'Could not determine file size');
            }

            const fileName = getFileNameFromURL(messageText) || 'downloaded_file';
            const fileSizeInMB = fileSize / (1024 * 1024);
            const fileSizeFormatted = formatFileSize(fileSize);

            const fileInfoMessage = getBilingualMessage(
              `🔎 <b>اطلاعات فایل:</b>\n\n📄 نام: <b>${fileName}</b>\n📊 حجم: <b>${fileSizeFormatted}</b>\n📋 نوع: <b>${contentType}</b>\n\n<i>در حال بررسی سازگاری...</i>`,
              `🔎 <b>File information:</b>\n\n📄 Name: <b>${fileName}</b>\n📊 Size: <b>${fileSizeFormatted}</b>\n📋 Type: <b>${contentType}</b>\n\n<i>Checking compatibility...</i>`,
              userLanguage
            );
            
            await updateTelegramMessage(chatId, processingMsgId, fileInfoMessage, env.TELEGRAM_TOKEN);

            if (fileSize > MAX_FILE_SIZE) {
              const sizeErrorMessage = getBilingualMessage(
                `❌ <b>خطا</b>: حجم فایل بیش از حد مجاز\n\nحداکثر حجم مجاز 49.9 مگابایت است.\nحجم فایل شما <b>${fileSizeInMB.toFixed(2)}</b> مگابایت است.`,
                `❌ <b>Error</b>: File too large\n\nMaximum allowed size is 49.9 MB.\nYour file is <b>${fileSizeInMB.toFixed(2)}</b> MB.`,
                userLanguage
              );

              await updateTelegramMessage(chatId, processingMsgId, sizeErrorMessage, env.TELEGRAM_TOKEN);
              return new Response('OK', {
                status: 200,
                headers: corsHeaders
              });
            }

            const downloadStartMessage = getBilingualMessage(
              `⏳ <b>در حال دانلود:</b> ${fileName}\n\n<b>حجم:</b> ${fileSizeFormatted}\n<b>وضعیت:</b> 0% ⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪`,
              `⏳ <b>Downloading:</b> ${fileName}\n\n<b>Size:</b> ${fileSizeFormatted}\n<b>Status:</b> 0% ⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪`,
              userLanguage
            );
            
            await updateTelegramMessage(chatId, processingMsgId, downloadStartMessage, env.TELEGRAM_TOKEN);

            const fileResponse = await fetch(messageText, {
              headers: {
                'User-Agent': 'Telegram-File-Downloader-Bot/1.0'
              }
            });
              
            if (!fileResponse.ok) {
              throw new Error(userLanguage === 'fa' ? 'دانلود فایل با مشکل مواجه شد' : 'Failed to download file');
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            const progress30Message = getBilingualMessage(
              `⏳ <b>در حال دانلود:</b> ${fileName}\n\n<b>حجم:</b> ${fileSizeFormatted}\n<b>وضعیت:</b> 30% 🔴🔴🔴⚪⚪⚪⚪⚪⚪⚪`,
              `⏳ <b>Downloading:</b> ${fileName}\n\n<b>Size:</b> ${fileSizeFormatted}\n<b>Status:</b> 30% 🔴🔴🔴⚪⚪⚪⚪⚪⚪⚪`,
              userLanguage
            );
            await updateTelegramMessage(chatId, processingMsgId, progress30Message, env.TELEGRAM_TOKEN);

            await new Promise(resolve => setTimeout(resolve, 500));
            const progress70Message = getBilingualMessage(
              `⏳ <b>در حال دانلود:</b> ${fileName}\n\n<b>حجم:</b> ${fileSizeFormatted}\n<b>وضعیت:</b> 70% 🟡🟡🟡🟡🟡🟡🟡⚪⚪⚪`,
              `⏳ <b>Downloading:</b> ${fileName}\n\n<b>Size:</b> ${fileSizeFormatted}\n<b>Status:</b> 70% 🟡🟡🟡🟡🟡🟡🟡⚪⚪⚪`,
              userLanguage
            );
            await updateTelegramMessage(chatId, processingMsgId, progress70Message, env.TELEGRAM_TOKEN);

            const fileData = await fileResponse.arrayBuffer();

            const progress100Message = getBilingualMessage(
              `✅ <b>دانلود کامل شد!</b>\n\n<b>فایل:</b> ${fileName}\n<b>حجم:</b> ${fileSizeFormatted}\n<b>وضعیت:</b> 100% 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢\n\n<i>در حال ارسال به شما...</i>`,
              `✅ <b>Download complete!</b>\n\n<b>File:</b> ${fileName}\n<b>Size:</b> ${fileSizeFormatted}\n<b>Status:</b> 100% 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢\n\n<i>Sending to you...</i>`,
              userLanguage
            );
            await updateTelegramMessage(chatId, processingMsgId, progress100Message, env.TELEGRAM_TOKEN);

            await sendFileToTelegram(chatId, fileData, fileName, env.TELEGRAM_TOKEN);

            const successMessage = getBilingualMessage(
              `✅ <b>فایل با موفقیت ارسال شد!</b>\n\n📄 <b>نام:</b> ${fileName}\n📊 <b>حجم:</b> ${fileSizeFormatted}\n\n🔄 برای دانلود فایل دیگر، لینک جدیدی ارسال کنید.\n📋 برای مشاهده راهنما، دستور /help را ارسال کنید.`,
              `✅ <b>File sent successfully!</b>\n\n📄 <b>Name:</b> ${fileName}\n📊 <b>Size:</b> ${fileSizeFormatted}\n\n🔄 To download another file, send a new link.\n📋 To view instructions, send /help command.`,
              userLanguage
            );
            await updateTelegramMessage(chatId, processingMsgId, successMessage, env.TELEGRAM_TOKEN);

          } catch (error) {
            console.error('Download error:', error);
            
            const errorMessage = getBilingualMessage(
              `❌ <b>خطا:</b> ${error.message}\n\nلطفاً دوباره تلاش کنید یا لینک دیگری ارسال نمایید.`,
              `❌ <b>Error:</b> ${error.message}\n\nPlease try again or send another link.`,
              userLanguage
            );

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

async function updateTelegramMessage(chatId, messageId, text, token) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`Failed to update message: ${JSON.stringify(error)}`);
    return false;
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

function getFileNameFromURL(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];
    
    if (lastSegment && lastSegment.includes('.')) {
      return decodeURIComponent(lastSegment);
    }
    
    const params = urlObj.searchParams;
    for (const [key, value] of params.entries()) {
      if (key.toLowerCase().includes('file') || key.toLowerCase().includes('name')) {
        if (value && value.includes('.')) {
          return decodeURIComponent(value);
        }
      }
    }
    
    return lastSegment || 'downloaded_file';
  } catch (_) {
    return 'downloaded_file';
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function detectLanguage(text) {
  if (!text) return 'en';
  
  const persianPattern = /[\u0600-\u06FF]/;
  return persianPattern.test(text) ? 'fa' : 'en';
}

function getBilingualMessage(persianText, englishText, language = 'en') {
  const separator = '\n\n------------------\n\n';
  return language === 'fa' ? 
    persianText + separator + englishText : 
    englishText + separator + persianText;
}

function getWelcomeMessage(userName) {
  return `
🌟 <b>به ربات دانلودر فایل خوش آمدید ${userName}!</b> 🌟

این ربات می‌تواند فایل‌های کوچک شما را دانلود و ارسال کند.

📝 <b>راهنمای استفاده</b>:
• لینک مستقیم فایل را ارسال کنید
• ربات فایل را دانلود و برای شما ارسال می‌کند

⚙️ <b>دستورات</b>:
• /help - نمایش راهنما
• /about - درباره ربات

⚠️ <b>محدودیت‌ها</b>:
• حداکثر حجم فایل: 49.9 مگابایت

------------------

🌟 <b>Welcome to File Grabber Bot, ${userName}!</b> 🌟

This bot can download and send your small files directly to you.

📝 <b>Instructions</b>:
• Send a direct file URL
• Bot will download and send the file to you

⚙️ <b>Commands</b>:
• /help - Show help
• /about - About this bot

⚠️ <b>Limitations</b>:
• Maximum file size: 49.9 MB`;
}

function getHelpMessage(language) {
  const faHelp = `
📋 <b>راهنمای ربات دانلودر فایل</b>

<b>چگونه از این ربات استفاده کنیم؟</b>

1️⃣ <b>یافتن لینک فایل:</b>
• روی فایل کلیک راست کنید و "کپی آدرس لینک" را انتخاب کنید
• لینک باید مستقیما به فایل اشاره کند

2️⃣ <b>ارسال لینک به ربات:</b>
• لینک را به این چت بفرستید
• ربات به طور خودکار شروع به دانلود و ارسال فایل می‌کند

3️⃣ <b>محدودیت‌ها:</b>
• حداکثر حجم فایل: 49.9 مگابایت
• فقط لینک‌های مستقیم پشتیبانی می‌شوند

4️⃣ <b>دستورات مفید:</b>
• /start - شروع مجدد ربات
• /help - نمایش این راهنما
• /about - اطلاعات درباره ربات

5️⃣ <b>پشتیبانی شده:</b>
• انواع فایل‌ها: PDF، تصاویر، ویدیوها، فایل‌های صوتی، اسناد و غیره`;

  const enHelp = `
📋 <b>File Grabber Bot Help</b>

<b>How to use this bot?</b>

1️⃣ <b>Find a file link:</b>
• Right-click on a file and select "Copy link address"
• Link should point directly to the file

2️⃣ <b>Send the link to the bot:</b>
• Send the link to this chat
• Bot will automatically start downloading and send the file

3️⃣ <b>Limitations:</b>
• Maximum file size: 49.9 MB
• Only direct links are supported

4️⃣ <b>Useful commands:</b>
• /start - Restart the bot
• /help - Show this help
• /about - Information about the bot

5️⃣ <b>Supported:</b>
• File types: PDFs, images, videos, audio files, documents, etc.`;

  return language === 'fa' ? 
    faHelp + '\n\n------------------\n\n' + enHelp : 
    enHelp + '\n\n------------------\n\n' + faHelp;
}

function getAboutMessage(language) {
  const faAbout = `
ℹ️ <b>درباره ربات دانلودر فایل</b>

این ربات به شما امکان می‌دهد فایل‌های کوچک را از لینک‌های مستقیم دانلود کنید و مستقیماً در تلگرام دریافت نمایید.

<b>ویژگی‌ها:</b>
• دانلود فایل از لینک‌های مستقیم
• پشتیبانی از فایل‌های تا 49.9 مگابایت
• رابط کاربری دو زبانه (فارسی/انگلیسی)
• طراحی تمیز و کاربرپسند
• بدون تبلیغات
• دانلود سریع و قابل اعتماد
• ساخته شده بر روی شبکه جهانی Cloudflare

<b>لینک مفید:</b>
• توسعه‌دهنده: @BXAMbot`;

  const enAbout = `
ℹ️ <b>About File Grabber Bot</b>

This bot allows you to download small files from direct links and receive them directly in Telegram.

<b>Features:</b>
• Download files from direct URLs
• Support for files up to 49.9 MB
• Bilingual interface (Persian/English)
• Clean and user-friendly design
• No ads
• Fast and reliable file downloading
• Built on Cloudflare's global network

<b>Useful links:</b>
• Developer: @BXAMbot`;

  return language === 'fa' ? 
    faAbout + '\n\n------------------\n\n' + enAbout : 
    enAbout + '\n\n------------------\n\n' + faAbout;
}