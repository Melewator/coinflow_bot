import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { prisma } from './db';
import { parseExpenseMessage, fallbackParse } from './services/aiParser';
import * as dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error('BOT_TOKEN must be provided in .env!');
}

export const bot = new Telegraf(token);

// Глобальный обработчик ошибок (Отказоустойчивость)
bot.catch((err, ctx) => {
    console.error(`❌ Глобальная ошибка Telegram для обновления типа ${ctx.updateType}:`, err);
    ctx.reply("⚠️ Временная техническая неполадка. Попробуйте чуть позже.").catch(() => { });
});

// Защита от спама и DDoS (Rate Limiter)
const userLimits = new Map<string, { count: number, lastMessage: number, warned: boolean, bannedUntil: number }>();

bot.use(async (ctx, next) => {
    if (!ctx.from) return next();

    const userId = ctx.from.id.toString();
    const now = Date.now();
    const limitWindow = 1500; // 1.5 секунды окно
    const banDuration = 30 * 1000; // 30 секунд бан при злоупотреблении

    let userState = userLimits.get(userId);

    if (!userState) {
        userState = { count: 1, lastMessage: now, warned: false, bannedUntil: 0 };
        userLimits.set(userId, userState);
        return next();
    }

    if (now < userState.bannedUntil) {
        return; // Игнорируем пользователя в бане (защита базы и Gemini)
    }

    if (now - userState.lastMessage < limitWindow) {
        userState.count++;
        // Если флудит очень быстро (> 3 сообщений подряд)
        if (userState.count > 3) {
            userState.bannedUntil = now + banDuration;
            userState.count = 0;
            await ctx.reply("⛔️ Вы отправляете сообщения слишком быстро! Временная блокировка на 30 секунд для защиты от спама.").catch(() => /* игнор ошибок reply */ { });
            return;
        }

        if (!userState.warned) {
            userState.warned = true;
            await ctx.reply("⚠️ Пожалуйста, не отправляйте запросы так часто (максимум 1 запрос в 1.5 секунды).").catch(() => { });
        }
        return; // Прерываем цепочку обработки
    }

    // Сброс лимитов 
    userState.count = 1;
    userState.lastMessage = now;
    userState.warned = false;
    return next();
});

interface PendingTransaction {
    parsed: any;
    userId: string;
    workspaceId: string;
    categoryId: string;
    rawText: string;
    categoryIcon: string;
}
const pendingTransactions = new Map<string, PendingTransaction>();

bot.start(async (ctx) => {
    const fromId = ctx.from.id.toString();
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;

    try {
        let user = await prisma.user.findUnique({
            where: { id: fromId },
            include: { workspaces: true }
        });

        const welcomeText = `👋 Привет! Я CoinFlow — твой карманный финансовый ассистент.\n\n` +
            `⚡️ <b>Быстрая запись на ходу:</b>\n` +
            `Просто пиши мне в чат сумму и комментарий обычным языком:\n` +
            `• <code>5 кофе</code>\n` +
            `• <code>14.5 такси в аэропорт</code>\n` +
            `• <code>2500 RUB продукты супермаркет</code>\n\n` +
            `По умолчанию валюта — USD, но ты всегда можешь дописать RUB.\n\n` +
            `📱 <b>Интерактивный дашборд:</b>\n` +
            `Нажми кнопку ниже, чтобы открыть полноэкранное приложение. В нем можно:\n` +
            `• Смотреть баланс и детальную историю\n` +
            `• Менять категории и суммы трат в один клик\n` +
            `• Фильтровать и искать по комментариям\n` +
            `• Выбирать стильные темы оформления`;

        const welcomeMarkup = Markup.inlineKeyboard([
            Markup.button.webApp('🚀 Открыть дашборд', process.env.WEBAPP_URL || 'https://google.com')
        ]);

        if (!user) {
            // Создаем пользователя и дефолтный Workspace
            user = await prisma.user.create({
                data: {
                    id: fromId,
                    username,
                    firstName,
                    workspaces: {
                        create: {
                            role: 'OWNER',
                            workspace: {
                                create: {
                                    name: `Личные финансы ${firstName}`,
                                    inviteCode: randomBytes(8).toString('hex'),
                                    defaultCurrency: 'USD',
                                }
                            }
                        }
                    }
                },
                include: { workspaces: true }
            });
            await ctx.reply(welcomeText, { parse_mode: 'HTML', reply_markup: welcomeMarkup.reply_markup });
        } else {
            await ctx.reply(`С возвращением, ${firstName}!\n\n${welcomeText}`, { parse_mode: 'HTML', reply_markup: welcomeMarkup.reply_markup });
        }
    } catch (e) {
        console.error("Registration Error:", e);
        await ctx.reply("Произошла ошибка при регистрации. Пожалуйста, попробуйте позже.");
    }
});

bot.help(async (ctx) => {
    const helpText = `🛠 <b>Помощь</b>\n\n` +
        `<b>Основной формат:</b>\n` +
        `Просто отправь мне текст сообщения: <i>"Сумма, на что и куда"</i>.\n` +
        `<i>Пример:</i> <code>7.5 кофе Starbucks</code>\n\n` +
        `Если искусственный интеллект перегружен, бот перейдет в ручной режим.\n` +
        `<b>Формат строгой (ручной) записи:</b>\n` +
        `<code>СУММА КАТЕГОРИЯ КОММЕНТАРИЙ</code>\n` +
        `<i>Пример:</i> <code>20 Еда вкусная пицца</code>\n\n` +
        `<b>Полезные команды:</b>\n` +
        `/app — Открыть приложение-дашборд\n` +
        `/stats — Получить быструю базу по категориям (в чат)\n` +
        `/help — Это меню`;
    return ctx.reply(helpText, { parse_mode: 'HTML' });
});

bot.command('app', async (ctx) => {
    return ctx.reply("📱 Нажмите на кнопку, чтобы открыть CoinFlow:", Markup.inlineKeyboard([
        Markup.button.webApp('🚀 Открыть дашборд', process.env.WEBAPP_URL || 'https://google.com')
    ]));
});

// Команда статистики за текущий месяц
bot.command('stats', async (ctx) => {
    const fromId = ctx.from.id.toString();

    const user = await prisma.user.findUnique({
        where: { id: fromId },
        include: {
            workspaces: {
                include: { workspace: true }
            }
        }
    });

    if (!user || user.workspaces.length === 0) {
        return ctx.reply("Для начала работы нажмите /start");
    }

    const activeWorkspace = user.workspaces[0].workspace;

    // Подготовка дат начала месяца
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
        const transactions = await prisma.transaction.findMany({
            where: {
                workspaceId: activeWorkspace.id,
                date: {
                    gte: startOfMonth
                }
            },
            include: {
                category: true
            }
        });

        if (transactions.length === 0) {
            return ctx.reply("В этом месяце трат еще не было.");
        }

        let totalAmount = 0;
        const categoryTotals: Record<string, { amount: number, icon: string }> = {};

        for (const tx of transactions) {
            totalAmount += tx.amount;
            const catName = tx.category.name;
            if (!categoryTotals[catName]) {
                categoryTotals[catName] = { amount: 0, icon: tx.category.icon };
            }
            categoryTotals[catName].amount += tx.amount;
        }

        let reply = `📊 *Статистика за текущий месяц:*\n`;
        reply += `Всего: ${totalAmount} ${activeWorkspace.defaultCurrency}\n\n`;
        reply += `По категориям:\n`;

        // Сортировка по убыванию суммы
        const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1].amount - a[1].amount);

        for (const [name, data] of sortedCategories) {
            reply += `${data.icon} ${name}: ${data.amount} ${activeWorkspace.defaultCurrency}\n`;
        }

        await ctx.replyWithMarkdown(reply);
    } catch (e) {
        console.error("Stats Error:", e);
        await ctx.reply("Произошла ошибка при загрузке статистики.");
    }
});

// Обработка кнопки подтверждения временной траты
bot.action(/^confirm_(.+)$/, async (ctx) => {
    const tempId = ctx.match[1];
    const data = pendingTransactions.get(tempId);

    if (!data) {
        return ctx.answerCbQuery("Время ожидания истекло или трата уже обработана", { show_alert: true });
    }

    try {
        const transaction = await prisma.transaction.create({
            data: {
                workspaceId: data.workspaceId,
                userId: data.userId,
                amount: data.parsed.amount,
                currency: data.parsed.currency,
                categoryId: data.categoryId,
                comment: data.parsed.comment || 'Без комментария',
                date: new Date(data.parsed.date),
                rawText: data.rawText
            }
        });

        pendingTransactions.delete(tempId);

        const replyText = `✅ <b>Трата записана!</b>\n\n` +
            `💵 Сумма: ${transaction.amount} ${transaction.currency}\n` +
            `🏷 Категория: ${data.categoryIcon} ${data.parsed.category}\n` +
            `💬 Комментарий: ${transaction.comment}\n` +
            `📅 Дата: ${data.parsed.date}`;

        const confirmedText = `${replyText}\n\n💾 <i>Сохранено в базу</i>`;

        await ctx.editMessageText(confirmedText, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] }
        });

        await ctx.answerCbQuery("Трата успешно сохранена");
    } catch (e) {
        console.error("DB Error on confirm:", e);
        await ctx.answerCbQuery("Ошибка при сохранении в БД", { show_alert: true });
    }
});

// Обработка отмены временной траты
bot.action(/^cancel_(.+)$/, async (ctx) => {
    const tempId = ctx.match[1];

    if (pendingTransactions.has(tempId)) {
        pendingTransactions.delete(tempId);
    }

    const oldText = ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message ? ctx.callbackQuery.message.text : "Трата отменена";
    const strikeText = `<s>${oldText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</s>\n\n<i>❌ Отменено</i>`;

    try {
        await ctx.editMessageText(strikeText, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] }
        });
        await ctx.answerCbQuery("Отменено");
    } catch (e) {
        console.error("Cancel Error:", e);
        await ctx.answerCbQuery();
    }
});

// Обработка кнопки удаления сохраненной траты
bot.action(/^del_(.+)$/, async (ctx) => {
    const transactionId = ctx.match[1];

    try {
        await prisma.transaction.delete({
            where: { id: transactionId }
        });

        const oldText = ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message ? ctx.callbackQuery.message.text : "Трата удалена";
        const strikeText = `<s>${oldText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</s>\n\n<i>🗑 Удалено</i>`;

        await ctx.editMessageText(strikeText, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] }
        });
        await ctx.answerCbQuery("Трата успешно удалена");
    } catch (e) {
        console.error("Delete Error:", e);
        await ctx.answerCbQuery("Ошибка при удалении", { show_alert: true });
    }
});

// Обработка кнопки изменения траты
bot.action(/^edit_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Функция редактирования скоро появится!', { show_alert: true });
});

bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
});

bot.on('successful_payment', async (ctx) => {
    const paymentInfo = ctx.message.successful_payment;
    try {
        const payload = JSON.parse(paymentInfo.invoice_payload);
        const userId = payload.userId;

        await prisma.user.update({
            where: { id: userId },
            data: { isPro: true }
        });

        await prisma.payment.create({
            data: {
                userId,
                telegramPaymentChargeId: paymentInfo.telegram_payment_charge_id,
                amount: paymentInfo.total_amount,
                currency: paymentInfo.currency
            }
        });

        await ctx.reply("🎉 Поздравляем! Доступ к CoinFlow PRO успешно активирован!");
    } catch (e) {
        console.error("Payment error:", e);
        await ctx.reply("Произошла ошибка при обработке платежа. Пожалуйста, свяжитесь с поддержкой.");
    }
});

bot.on(message('text'), async (ctx) => {
    const text = ctx.message.text;

    // Игнорируем команды (они обрабатываются в bot.command)
    if (text.startsWith('/')) return;

    const fromId = ctx.from.id.toString();

    const user = await prisma.user.findUnique({
        where: { id: fromId },
        include: {
            workspaces: {
                include: { workspace: true }
            }
        }
    });

    if (!user || user.workspaces.length === 0) {
        return ctx.reply("Сначала нажмите /start для регистрации.");
    }

    // Берем первую группу (Workspace) пользователя как активную
    const activeWorkspace = user.workspaces[0].workspace;

    // Получаем глобальные и специфичные категории
    const categories = await prisma.category.findMany({
        where: {
            OR: [
                { workspaceId: activeWorkspace.id },
                { isDefault: true }
            ]
        }
    });
    const categoryNames = categories.map(c => c.name);

    if (categoryNames.length === 0) {
        return ctx.reply("В базе нет доступных категорий. Сидинг БД еще не выполнен.");
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length > 1) {
        // Пакетный режим
        const loadingMsg = await ctx.reply("🔄 Обрабатываю список трат...");

        const parsings = await Promise.all(lines.map(async line => {
            let parsed;
            try {
                parsed = await parseExpenseMessage(line, {
                    categories: categoryNames,
                    defaultCurrency: user.defaultCurrency as "RUB" | "USD",
                    currentDate: new Date()
                });
                if (!parsed) throw new Error("Fallback please");
            } catch (e) {
                parsed = fallbackParse(line, categoryNames, user.defaultCurrency as "RUB" | "USD");
            }
            return { line, parsed };
        }));

        let totalAmountBase = 0;
        const insertedData = [];
        let summaryLines: string[] = [];

        for (const item of parsings) {
            const parsed = item.parsed;
            if (!parsed) continue;

            let category = categories.find(c => c.name === parsed.category);
            if (!category) category = categories.find(c => c.name === 'Другое');
            if (!category) category = categories[0];

            const amount = parsed.amount;
            const currency = parsed.currency || user.defaultCurrency;
            const commentStr = parsed.comment ? ` (${parsed.comment})` : '';

            insertedData.push({
                workspaceId: activeWorkspace.id,
                userId: user.id,
                amount: amount,
                currency: currency,
                categoryId: category.id,
                comment: parsed.comment || '',
                date: new Date(),
                rawText: item.line || ''
            });

            // Конвертируем в базовую валюту для итога (упрощенно)
            let sumAmount = amount;
            if (currency !== user.defaultCurrency) {
                if (currency === 'RUB' && user.defaultCurrency === 'USD') sumAmount = amount / 90;
                else if (currency === 'USD' && user.defaultCurrency === 'RUB') sumAmount = amount * 90;
            }
            totalAmountBase += sumAmount;
            summaryLines.push(`• ${amount} ${currency} — ${category.name}${commentStr}`);
        }

        if (insertedData.length === 0) {
            return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, "К сожалению, не удалось распознать ни одну трату из списка.");
        }

        await prisma.transaction.createMany({
            data: insertedData
        });

        const reply = `✅ Успешно записано трат: ${insertedData.length}\n\n${summaryLines.join('\n')}\n\n💵 Итого добавлено: ~${totalAmountBase.toFixed(2)} ${user.defaultCurrency}`;

        return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, reply);
    }

    // Запускаем парсинг
    let parsed;
    let isFallback = false;
    try {
        parsed = await parseExpenseMessage(text, {
            categories: categoryNames,
            defaultCurrency: user.defaultCurrency as "RUB" | "USD",
            currentDate: new Date()
        });
        if (!parsed) throw new Error("Fallback");
    } catch (e) {
        console.error("AI Error:", e);
        // Если AI упал (например 503 High Demand), применяем fallback-регулярки
        parsed = fallbackParse(text, categoryNames, user.defaultCurrency as "RUB" | "USD");
        isFallback = true;
    }

    if (!parsed) {
        const catsBulletMap = categoryNames.map(c => `• ${c}`).join('\n');
        const fallbackMessage = `⚠️ <b>${isFallback ? "ИИ временно недоступен" : "Не удалось распознать трату"}</b>.\n\n` +
            `Вы можете записать трату вручную по формату:\n` +
            `<code>СУММА КАТЕГОРИЯ КОММЕНТАРИЙ</code>\n\n` +
            `💡 <b>Пример:</b>\n` +
            `<code>9 Развлечения кино вдвоем</code>\n` +
            `<code>15 Еда пицца с сыром</code>\n\n` +
            `<b>Множественный ввод (каждая с новой строки):</b>\n` +
            `<code>5 Еда яблоки\n3 Транспорт автобус</code>\n\n` +
            `<b>Доступные категории:</b>\n${catsBulletMap}`;

        return ctx.reply(fallbackMessage, { parse_mode: 'HTML' });
    }

    // Сопоставляем результат со строкой из БД
    const category = categories.find(c => c.name === parsed.category) || categories.find(c => c.name === 'Другое') || categories[0];

    // Создаем временную транзакцию
    const tempId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
    pendingTransactions.set(tempId, {
        parsed,
        userId: user.id,
        workspaceId: activeWorkspace.id,
        categoryId: category.id,
        rawText: text,
        categoryIcon: category.icon
    });

    // Отправляем на подтверждение
    const fallbackPrefix = isFallback ? "⚠️ <i>Распознано по строгим правилам (ИИ недоступен):</i>\n\n" : "";
    const replyText = `${fallbackPrefix}<b>Трата распознана, подтвердите сохранение:</b>\n\n` +
        `💵 Сумма: ${parsed.amount} ${parsed.currency}\n` +
        `🏷 Категория: ${category.icon} ${parsed.category}\n` +
        `💬 Комментарий: ${parsed.comment || 'Без комментария'}\n` +
        `📅 Дата: ${parsed.date}`;

    try {
        await ctx.reply(replyText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        Markup.button.callback('✅ Подтвердить', `confirm_${tempId}`),
                        Markup.button.callback('❌ Отмена', `cancel_${tempId}`)
                    ]
                ]
            }
        });
    } catch (e) {
        console.error("Reply Error:", e);
        await ctx.reply("Произошла ошибка при формировании сообщения.");
    }
});
