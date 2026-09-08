import { bot } from './bot';
import express from 'express';
import cors from 'cors';
import { prisma } from './db';

// Глобальная сериализация BigInt для Express
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const app = express();
app.use(cors({ origin: '*' })); // Разрешаем доступ со всех доменов (включая Netlify и ngrok)
app.use(express.json());

app.get('/api/transactions/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            include: { category: true } // Включаем информацию о категории для frontend'а
        });

        // Возвращаем пустой массив, а не ошибку, если пусто 
        res.status(200).json(transactions || []);
    } catch (e) {
        console.error("API error:", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const userId = req.query.userId as string;
        let whereClause: any = { isDefault: true };

        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { workspaces: true }
            });
            if (user && user.workspaces.length > 0) {
                whereClause = {
                    OR: [
                        { isDefault: true },
                        { workspaceId: user.workspaces[0].workspaceId }
                    ]
                };
            }
        }

        const categories = await prisma.category.findMany({ where: whereClause });
        res.json(categories);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const { userId, amount, categoryId, comment, date, currency = 'USD' } = req.body;

        let user = await prisma.user.findUnique({ where: { id: userId }, include: { workspaces: true } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: userId,
                    username: 'unknown',
                    firstName: 'WebApp User',
                    workspaces: {
                        create: {
                            role: 'OWNER',
                            workspace: {
                                create: {
                                    name: `Личные финансы`,
                                    // Генерация случайного кода приглашения
                                    inviteCode: Math.random().toString(36).substring(7),
                                    defaultCurrency: 'USD',
                                }
                            }
                        }
                    }
                }, include: { workspaces: true }
            });
        }

        const workspaceId = user.workspaces[0].workspaceId;

        const tx = await prisma.transaction.create({
            data: {
                userId,
                workspaceId,
                amount: parseFloat(amount),
                categoryId,
                comment: comment || '',
                date: date ? new Date(date) : new Date(),
                currency,
                rawText: comment || 'Added from WebApp'
            },
            include: { category: true }
        });
        res.status(201).json(tx);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Creation failed' });
    }
});

app.put('/api/transactions/:id', async (req, res) => {
    try {
        const { amount, categoryId, comment, currency } = req.body;
        const tx = await prisma.transaction.update({
            where: { id: req.params.id },
            data: {
                amount: amount ? parseFloat(amount) : undefined,
                categoryId,
                comment,
                currency
            },
            include: { category: true }
        });
        res.json(tx);
    } catch (e) {
        res.status(500).json({ error: 'Update failed' });
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try {
        await prisma.transaction.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Deletion failed' });
    }
});

const PORT = Number(process.env.PORT) || 3000;

function start() {
    console.log("Запуск API сервера и Telegram бота...");

    // Запускаем Express сервер до (или параллельно) бота
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 API сервер запущен на 0.0.0.0:${PORT}`);
    });

    // Запуск Telegram бота
    bot.launch()
        .then(() => console.log("🚀 Telegram бот успешно запущен и готов к работе!"))
        .catch(e => console.error("❌ Ошибка при запуске бота:", e));
}

start();

// Обработка корректного завершения (Graceful stop)
process.once('SIGINT', () => {
    console.log('Остановка бота (SIGINT)...');
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    console.log('Остановка бота (SIGTERM)...');
    bot.stop('SIGTERM');
    process.exit(0);
});
