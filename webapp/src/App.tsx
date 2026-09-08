import { useEffect, useState } from 'react';
import { Wallet, PieChart, ArrowUpRight } from 'lucide-react';
import WebApp from '@twa-dev/sdk';
import axios from 'axios';

interface Transaction {
    id: string;
    amount: number;
    currency: string;
    date: string;
    category: {
        name: string;
        icon: string;
    };
}

const mockTransactions: Transaction[] = [
    { id: '1', amount: 500, currency: 'RUB', date: new Date().toISOString(), category: { name: 'Кафе', icon: '☕' } },
    { id: '2', amount: 4500, currency: 'RUB', date: new Date(Date.now() - 86400000).toISOString(), category: { name: 'Покупки', icon: '🛒' } }
];

function App() {
    const user = WebApp.initDataUnsafe.user;
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                // В Telegram userId это число, приводим к строке. '12345' — fallback для десктопа
                const userId = user?.id?.toString() || '12345';
                const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

                const response = await axios.get(`${apiUrl}/transactions/${userId}`);
                setTransactions(response.data);
            } catch (err) {
                console.error("Fetch error:", err);
                // При ошибке покажем моковые данные для наглядности (чтобы UI не был пустым при отладке)
                setTransactions(mockTransactions);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [user?.id]);

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const displayAmount = totalAmount.toLocaleString('ru-RU');

    // Форматирование даты
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="min-h-screen bg-[var(--tg-theme-secondary-bg-color,#f3f4f6)] p-5 flex flex-col gap-6 font-sans">

            {/* Шапка */}
            <header className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-[var(--tg-theme-text-color,#111827)] text-2xl font-bold tracking-tight">
                        Мои финансы
                    </h1>
                    <p className="text-[var(--tg-theme-hint-color,#6b7280)] text-sm mt-0.5">
                        {user?.first_name ? `Привет, ${user.first_name}!` : 'Демо-режим'}
                    </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-tr from-[var(--tg-theme-button-color,#3b82f6)] to-[var(--tg-theme-button-color,#2563eb)] opacity-90 text-[var(--tg-theme-button-text-color,#ffffff)] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Wallet size={24} />
                </div>
            </header>

            {/* Карточка баланса */}
            <div className="bg-[var(--tg-theme-bg-color,#ffffff)] rounded-[24px] p-6 shadow-sm border border-[var(--tg-theme-hint-color,#e5e7eb)]/40 transition-all hover:shadow-md">
                <h2 className="text-[var(--tg-theme-hint-color,#6b7280)] text-sm font-medium mb-1">Траты в этом месяце</h2>
                <div className="text-4xl font-extrabold text-[var(--tg-theme-text-color,#111827)] mb-5 tracking-tight">
                    {displayAmount} {transactions[0]?.currency || '₽'}
                </div>

                {/* Заглушка графика */}
                <div className="h-28 bg-[var(--tg-theme-secondary-bg-color,#f8fafc)] rounded-2xl flex flex-col items-center justify-center text-[var(--tg-theme-hint-color,#94a3b8)] gap-2 border border-dashed border-[var(--tg-theme-hint-color,#cbd5e1)]/60">
                    <PieChart size={28} className="text-[var(--tg-theme-button-color,#3b82f6)] opacity-70" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-[var(--tg-theme-hint-color,#94a3b8)]">График в разработке</span>
                </div>
            </div>

            {/* Операции (С загрузочной заглушкой) */}
            <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[var(--tg-theme-text-color,#111827)] font-bold text-xl">История</h3>
                    <span className="text-[var(--tg-theme-link-color,#3b82f6)] text-sm font-semibold cursor-pointer active:opacity-70 transition-opacity">
                        Посмотреть всё
                    </span>
                </div>

                <div className="flex flex-col gap-3">
                    {loading ? (
                        <div className="text-center text-[var(--tg-theme-hint-color,#888)] py-4">Загрузка транзакций...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center text-[var(--tg-theme-hint-color,#888)] py-4">У вас пока нет трат.</div>
                    ) : (
                        transactions.map((tx) => (
                            <div key={tx.id} className="bg-[var(--tg-theme-bg-color,#ffffff)] rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-transparent active:border-[var(--tg-theme-hint-color,#e5e7eb)] transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-[16px] bg-[var(--tg-theme-secondary-bg-color,#f3f4f6)] flex items-center justify-center text-xl shadow-inner">
                                        {tx.category?.icon || '🏷️'}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-[var(--tg-theme-text-color,#111827)] text-base">{tx.category?.name || 'Без категории'}</span>
                                        <span className="text-[13px] text-[var(--tg-theme-hint-color,#6b7280)] font-medium">{formatDate(tx.date)}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="font-extrabold text-[17px] text-[var(--tg-theme-text-color,#111827)]">
                                        -{tx.amount} {tx.currency}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Кнопка добавления внизу */}
            <button className="mt-4 mb-2 w-full py-4 bg-[var(--tg-theme-button-color,#3b82f6)] text-[var(--tg-theme-button-text-color,#ffffff)] rounded-[20px] font-bold text-lg active:scale-[0.97] transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                <ArrowUpRight size={22} className="stroke-[3]" />
                Добавить транзакцию
            </button>

        </div>
    );
}

export default App;
